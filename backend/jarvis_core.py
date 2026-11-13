"""JARVIS Core — orchestrates AI, desktop control, speech, and WebSocket events."""
import asyncio
import json
import time
from typing import Optional

from config import settings
from database import (save_message, get_conversation_history, save_action,
                      update_action, approve_action, log_activity, get_pending_approvals)
from ollama_client import get_ollama
from desktop_controller import get_controller
from speech_engine import get_speech
from ws_manager import manager


class JarvisCore:
    """Central orchestrator for JARVIS."""

    def __init__(self):
        self.status = "idle"
        self._pending_approvals: dict = {}   # action_id -> action dict
        self._voice_busy = False             # prevent overlapping voice sessions
        self._active_tasks: set = set()      # track background asyncio tasks

    # -------------------------------------------------------------------------
    # Wake word entry point
    # -------------------------------------------------------------------------
    async def on_wake_word(self):
        """Called when 'hey jarvis' is detected. Non-blocking — runs as a task."""
        task = asyncio.create_task(self._voice_session())
        self._active_tasks.add(task)
        task.add_done_callback(self._active_tasks.discard)

    async def _voice_session(self):
        """Full wake → listen → transcribe → respond → speak cycle."""
        if self._voice_busy:
            # Already in a session — give a quick busy signal
            asyncio.create_task(get_speech().speak("I'm already listening. One moment."))
            return

        self._voice_busy = True
        speech = get_speech()

        try:
            # 1. Acknowledge the wake
            await manager.send_activity("voice", "Wake word detected — listening...")
            await self._set_status("listening")
            asyncio.create_task(speech.speak("Yes?"))

            # 2. Record until silence
            audio = await speech.record_until_silence(
                silence_threshold=0.015,
                silence_duration=1.2,
                max_duration=30.0
            )

            if audio is None or len(audio) < 3200:  # < 0.2s — probably noise
                await self._set_status("idle")
                return

            # 3. Transcribe
            await self._set_status("transcribing")
            await manager.send_activity("voice", "Transcribing...")
            text = await speech.transcribe(audio)

            if not text:
                await self._set_status("idle")
                asyncio.create_task(speech.speak("Sorry, I didn't catch that."))
                return

            await manager.send_activity("voice", f"Heard: {text}")

            # 4. Process as a command (non-blocking — task can run in background)
            result = await self.process_command(text, include_screenshot=False)

            # 5. Speak the response
            response = result.get("response", "Done.")
            await speech.speak(response)

        except Exception as e:
            log_activity("error", f"Voice session error: {e}", {})
            await self._set_status("idle")
        finally:
            self._voice_busy = False

    # -------------------------------------------------------------------------
    # Main command entry point
    # -------------------------------------------------------------------------
    async def process_command(self, user_input: str, include_screenshot: bool = False) -> dict:
        """Process a user command end-to-end."""
        try:
            save_message("user", user_input)
            await manager.send_transcript("user", user_input)
            await self._set_status("thinking")

            # Optional screenshot context
            screenshot_b64 = None
            if include_screenshot:
                try:
                    screenshot_b64 = await get_controller().take_screenshot_b64()
                    await manager.send_activity("screenshot", "Taking screenshot for context")
                except Exception as e:
                    await manager.send_activity("warning", f"Screenshot failed: {e}")

            # Call Ollama
            history = get_conversation_history(limit=10)
            await manager.send_activity("thinking", "JARVIS is thinking...")
            result = await get_ollama().chat(user_input, history=history[:-1], screenshot_b64=screenshot_b64)

            if not result["success"]:
                error_msg = f"AI error: {result.get('error', 'Unknown')}"
                await manager.send_transcript("assistant", error_msg)
                await self._set_status("idle")
                return {"success": False, "error": error_msg}

            plan = result["plan"]
            response_text = plan.get("response", "I'll take care of that.")
            actions = plan.get("actions", [])
            thought = plan.get("thought", "")

            save_message("assistant", response_text, {"thought": thought, "actions": actions})
            await manager.send_transcript("assistant", response_text, {"thought": thought, "plan": actions})
            await manager.send_activity("plan", f"Plan ready: {len(actions)} action(s)", {"actions": actions})

            # Execute actions
            if actions:
                await self._execute_plan(actions)

            await self._set_status("idle")
            return {"success": True, "response": response_text, "plan": actions}

        except Exception as e:
            await manager.send_activity("error", f"JARVIS error: {e}")
            await self._set_status("error")
            return {"success": False, "error": str(e)}

    # -------------------------------------------------------------------------
    # Plan execution
    # -------------------------------------------------------------------------
    async def _execute_plan(self, actions: list):
        """Execute actions, pausing for approval when needed."""
        for action in actions:
            requires_approval = action.get("requires_approval", False)
            action_type = action.get("type", "")
            description = action.get("description", action_type)

            sensitive_types = {"delete_file", "shell_command", "format"}
            if action_type in sensitive_types:
                requires_approval = True

            if requires_approval:
                action_id = save_action(action_type, description, action.get("parameters", {}),
                                        requires_approval=True)
                action["id"] = action_id
                self._pending_approvals[action_id] = action

                await manager.send_approval_request(action_id, action)
                await manager.send_activity("approval_needed", f"Waiting for approval: {description}", action)

                approved = await self._wait_for_approval(action_id, timeout=60)
                if not approved:
                    update_action(action_id, "cancelled", "Not approved by user")
                    await manager.send_activity("cancelled", f"Action cancelled: {description}", action)
                    continue

            await manager.send_activity("executing", f"Executing: {description}", action)
            await self._set_status("acting")

            result = await get_controller().execute(action)

            if "id" in action:
                update_action(action["id"], "done" if result["success"] else "failed",
                              result.get("result") or result.get("error"))
            await manager.send_action_result(action, result)

            if action_type == "screenshot" and result["success"]:
                await manager.send_screenshot(result["result"])

            await asyncio.sleep(1.0)

    async def _wait_for_approval(self, action_id: int, timeout: float = 60) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            if action_id not in self._pending_approvals:
                return True
            await asyncio.sleep(0.5)
        return False

    async def approve_action_by_id(self, action_id: int):
        approve_action(action_id)
        self._pending_approvals.pop(action_id, None)
        await manager.send_activity("approved", f"Action #{action_id} approved", {"action_id": action_id})

    async def deny_action_by_id(self, action_id: int):
        self._pending_approvals.pop(action_id, None)
        update_action(action_id, "denied", "Denied by user")
        await manager.send_activity("denied", f"Action #{action_id} denied", {"action_id": action_id})

    # -------------------------------------------------------------------------
    # Push-to-talk (hotkey / button)
    # -------------------------------------------------------------------------
    async def start_push_to_talk(self):
        """Start recording until silence (triggered by hotkey or UI button)."""
        speech = get_speech()
        if not speech._initialized:
            speech.initialize()

        await self._set_status("listening")
        await manager.send_activity("voice", "Listening... speak now")

        audio = await speech.record_until_silence()
        if audio is None:
            await self._set_status("idle")
            return None

        await self._set_status("transcribing")
        await manager.send_activity("transcribing", "Transcribing speech...")
        text = await speech.transcribe(audio)

        if text:
            await manager.send_activity("voice", f"Heard: {text}")
            return text
        else:
            await self._set_status("idle")
            return None

    async def stop_listening(self):
        speech = get_speech()
        speech._stop_recording.set()
        await self._set_status("idle")

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------
    async def _set_status(self, status: str):
        self.status = status
        await manager.send_status(status)

    async def _speak_response(self, text: str):
        try:
            await self._set_status("speaking")
            await get_speech().speak(text)
            await self._set_status("idle")
        except Exception as e:
            log_activity("error", f"TTS error: {e}", {})
            await self._set_status("idle")

    async def take_screenshot_and_analyze(self) -> dict:
        try:
            b64 = await get_controller().take_screenshot_b64()
            fpath = await get_controller().take_screenshot()
            description = await get_ollama().describe_screenshot(b64)
            await manager.send_screenshot(fpath, description)
            return {"success": True, "filepath": fpath, "description": description}
        except Exception as e:
            return {"success": False, "error": str(e)}


# Singleton
_core = JarvisCore()


def get_core() -> JarvisCore:
    return _core
