"""Ollama AI Brain for JARVIS"""
import httpx
import json
from typing import AsyncGenerator, Optional
from config import settings
from database import save_message, get_conversation_history, log_activity


SYSTEM_PROMPT = """You are JARVIS, an advanced AI desktop assistant running locally on Windows. You control the user's PC directly.

═══════════════════════════════════════════════
CRITICAL RULE — RESPONSE FORMAT
═══════════════════════════════════════════════
You MUST ALWAYS respond with valid JSON. Nothing else. No markdown. No explanation outside JSON.
Use this exact structure:

{
  "thought": "Your internal reasoning",
  "response": "What you say to the user (short, natural)",
  "actions": [ ...list of action objects... ],
  "needs_screenshot": false
}

═══════════════════════════════════════════════
RULE: WHEN TO WRITE TO NOTEPAD
═══════════════════════════════════════════════
If the user asks for ANY of these → write to Notepad:
- "show me an example"
- "give me code" / "write code"
- "give me an example of [topic]"
- "show bubble sort / quick sort / any algorithm"
- "demonstrate X"
- "write me a [script / program / example]"
- "can you type / write / show that"
- any request for code snippets, templates, or long text

═══════════════════════════════════════════════
RULE: WHEN TO WRITE TO NOTEPAD
═══════════════════════════════════════════════
If the user asks for ANY of these → use write_notepad:
- "show me an example"
- "give me code" / "write code"
- "give me an example of [algorithm/topic]" (e.g. bubble sort, quick sort)
- "demonstrate X"
- "write me a [script / program / example]"
- "can you type / write / show that"
- any request for code snippets, templates, or text files

Action to use:
- write_notepad: {"text": "complete formatted code or text"}
Followed optionally by:
- speak: {"text": "Done! I've opened Notepad with the example."}

NEVER put code or long text inside the "response" field. Keep "response" to a single polite sentence.

═══════════════════════════════════════════════
RULE: WHEN TO OPEN WEBSITES / TABS / SEARCH
═══════════════════════════════════════════════
- "open [website]" OR "open [website] in [browser]" (e.g. "open reddit.com in chrome", "open youtube", "open github.com") → ALWAYS use open_url: {"url": "https://reddit.com"}. Single action. NEVER use open_app or search_web for websites!
- "open a new tab" → new_tab: {}
- "search for X" (e.g. "search for cute cats") → search_web: {"query": "cute cats"}
- "open [desktop app]" (e.g. "open notepad", "open calculator", "open spotify", "open vs code") → open_app: {"app_name": "notepad"}
- "take a screenshot" → screenshot: {}
- "click on [position]" → mouse_click: {"x": 500, "y": 400}

═══════════════════════════════════════════════
RULE: WHEN TO JUST ANSWER (no desktop action)
═══════════════════════════════════════════════
- Questions about facts, definitions, general knowledge
- Conversations / chitchat
- Status checks ("are you ready?")
Use: actions: [{"type": "answer", "description": "answering", "parameters": {}, "requires_approval": false}]

═══════════════════════════════════════════════
AVAILABLE ACTIONS
═══════════════════════════════════════════════
- write_notepad: {"text": "..."} — writes text to jarvis_example.txt on Desktop and opens it in Notepad
- open_app: {"app_name": "chrome"} — opens an application (chrome, notepad, calculator, vscode, terminal)
- open_url: {"url": "https://..."} — opens website URL in browser
- new_tab: {} — opens a new tab in active browser
- search_web: {"query": "..."} — searches Google in browser
- type_text: {"text": "short text"} — types short text via keyboard
- key_press: {"keys": "ctrl+t"} — presses keyboard shortcuts
- mouse_click: {"x": 500, "y": 300, "button": "left"} — clicks at screen coordinates
- mouse_move: {"x": 500, "y": 300} — moves mouse
- screenshot: {} — takes a screenshot of the desktop
- focus_window: {"title": "Notepad"} — brings window to front
- close_window: {"title": "Notepad"} — closes a window
- shell_command: {"command": "..."} — runs a PowerShell command (requires_approval: true)
- delete_file: {"path": "..."} — deletes a file (requires_approval: true ALWAYS)
- clipboard_copy: {"text": "..."} — copies text to clipboard
- clipboard_paste: {} — pastes clipboard contents
- scroll: {"direction": "down", "amount": 3} — scrolls
- wait: {"seconds": 1} — pauses between actions
- speak: {"text": "..."} — speaks aloud to user
- answer: {} — just answer in chat, no desktop action

═══════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════
User: "show me bubble sort in python"
Response:
{
  "thought": "User wants a bubble sort code example. I will write it to a file and open it in Notepad.",
  "response": "Writing the bubble sort code to Notepad for you right now.",
  "actions": [
    {"type": "write_notepad", "description": "Writing bubble sort to Notepad", "parameters": {"text": "# Bubble Sort in Python\\n\\ndef bubble_sort(arr):\\n    n = len(arr)\\n    for i in range(n):\\n        for j in range(0, n-i-1):\\n            if arr[j] > arr[j+1]:\\n                arr[j], arr[j+1] = arr[j+1], arr[j]\\n    return arr\\n\\n# Example\\narr = [64, 34, 25, 12, 22, 11, 90]\\nprint(bubble_sort(arr))\\n# Output: [11, 12, 22, 25, 34, 64, 90]"}, "requires_approval": false},
    {"type": "speak", "description": "Confirming to user", "parameters": {"text": "Done! I've opened the bubble sort code in Notepad on your screen."}, "requires_approval": false}
  ],
  "needs_screenshot": false
}

User: "open a new tab and search for weather"
Response:
{
  "thought": "User wants to search the web in a new tab.",
  "response": "Searching for weather in a new tab.",
  "actions": [
    {"type": "search_web", "description": "Searching Google for weather", "parameters": {"query": "weather"}, "requires_approval": false}
  ],
  "needs_screenshot": false
}

User: "what is bubble sort?"
Response:
{
  "thought": "Simple question, just answer.",
  "response": "Bubble sort is a simple comparison-based sorting algorithm that repeatedly steps through the list, compares adjacent elements, and swaps them if they are in the wrong order. It has O(n²) time complexity.",
  "actions": [{"type": "answer", "description": "answering question", "parameters": {}, "requires_approval": false}],
  "needs_screenshot": false
}
"""



class OllamaClient:
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.vision_model = settings.ollama_vision_model
        self._client = httpx.AsyncClient(timeout=120.0)

    async def is_available(self) -> bool:
        try:
            resp = await self._client.get(f"{self.base_url}/api/tags")
            return resp.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list:
        try:
            resp = await self._client.get(f"{self.base_url}/api/tags")
            data = resp.json()
            return [m["name"] for m in data.get("models", [])]
        except Exception:
            return []

    async def chat(self, user_message: str, history: list = None, screenshot_b64: str = None) -> dict:
        """Send a message and get a structured response back."""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Add conversation history
        for h in (history or []):
            messages.append({"role": h["role"], "content": h["content"]})

        # Build user message (with optional image)
        if screenshot_b64:
            user_msg = {
                "role": "user",
                "content": user_message,
                "images": [screenshot_b64]
            }
            model = self.vision_model
        else:
            user_msg = {"role": "user", "content": user_message}
            model = self.model

        messages.append(user_msg)

        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.3,
                "top_p": 0.9,
                "num_predict": 2048,
            }
        }

        try:
            resp = await self._client.post(f"{self.base_url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data["message"]["content"]

            plan = self._parse_plan(content)
            return {"success": True, "plan": plan, "raw": content}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _parse_plan(self, content: str) -> dict:
        """Robustly parse the JSON plan from the LLM, repairing common syntax defects."""
        import re
        text = content.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        # 1. Direct load
        try:
            return json.loads(text)
        except Exception:
            pass

        # 2. Fix trailing commas before } or ]
        try:
            cleaned = re.sub(r',\s*([\]}])', r'\1', text)
            return json.loads(cleaned)
        except Exception:
            pass

        # 3. Robust Action Extraction
        actions = []
        idx = 0
        while True:
            pos = text.find('{"type"', idx)
            if pos == -1:
                pos = text.find('{"type "', idx)
            if pos == -1:
                break
            
            brace_count = 0
            end_pos = -1
            for i in range(pos, len(text)):
                if text[i] == '{':
                    brace_count += 1
                elif text[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_pos = i + 1
                        break
            
            if end_pos != -1:
                candidate = text[pos:end_pos]
                try:
                    obj = json.loads(candidate)
                    actions.append(obj)
                except Exception:
                    try:
                        obj = json.loads(re.sub(r',\s*([\]}])', r'\1', candidate))
                        actions.append(obj)
                    except Exception:
                        pass
                idx = end_pos
            else:
                idx = pos + 7

        thought_match = re.search(r'"thought"\s*:\s*"([^"]*)"', text)
        response_match = re.search(r'"response"\s*:\s*"([^"]*)"', text)

        if not actions:
            actions = [{"type": "answer", "description": "Responding to user", "parameters": {}, "requires_approval": False}]

        return {
            "thought": thought_match.group(1) if thought_match else "Parsed from response",
            "response": response_match.group(1) if response_match else "I'll take care of that.",
            "actions": actions,
            "needs_screenshot": False
        }

    async def stream_chat(self, user_message: str, history: list = None) -> AsyncGenerator[str, None]:
        """Stream a conversational response (no JSON format)."""
        messages = [{"role": "system", "content": "You are JARVIS, a helpful AI assistant. Respond naturally and concisely."}]
        for h in (history or []):
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": 0.7}
        }

        async with self._client.stream("POST", f"{self.base_url}/api/chat", json=payload) as resp:
            async for line in resp.aiter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]
                    except json.JSONDecodeError:
                        continue

    async def describe_screenshot(self, screenshot_b64: str) -> str:
        """Use vision model to describe a screenshot."""
        payload = {
            "model": self.vision_model,
            "messages": [{
                "role": "user",
                "content": "Describe what you see on this Windows desktop screenshot. List all visible apps, windows, text, and UI elements.",
                "images": [screenshot_b64]
            }],
            "stream": False,
        }
        try:
            resp = await self._client.post(f"{self.base_url}/api/chat", json=payload)
            data = resp.json()
            return data["message"]["content"]
        except Exception as e:
            return f"Could not describe screenshot: {e}"

    async def close(self):
        await self._client.aclose()


# Singleton
_ollama = OllamaClient()


def get_ollama() -> OllamaClient:
    return _ollama
