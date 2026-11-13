"""Windows Desktop Control Engine"""
import subprocess
import time
import os
import base64
import io
from typing import Optional
from pathlib import Path

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

try:
    from PIL import ImageGrab, Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import pyperclip
    PYPERCLIP_AVAILABLE = True
except ImportError:
    PYPERCLIP_AVAILABLE = False

from database import log_activity, save_action, update_action

# Configure PyAutoGUI safety
if PYAUTOGUI_AVAILABLE:
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0.2


def get_desktop_dir() -> Path:
    """Find the user's real Desktop directory (OneDrive or standard profile)."""
    home = Path(os.path.expanduser("~"))
    onedrive_desktop = home / "OneDrive" / "Desktop"
    if onedrive_desktop.exists():
        return onedrive_desktop
    std_desktop = home / "Desktop"
    if std_desktop.exists():
        return std_desktop
    docs = home / "Documents"
    if docs.exists():
        return docs
    return home


class DesktopController:
    """Controls Windows desktop via PyAutoGUI and system calls."""

    APP_MAP = {
        "notepad": "notepad.exe",
        "calculator": "calc.exe",
        "explorer": "explorer.exe",
        "chrome": "chrome.exe",
        "edge": "msedge.exe",
        "firefox": "firefox.exe",
        "word": "winword.exe",
        "excel": "excel.exe",
        "powerpoint": "powerpnt.exe",
        "vscode": "code.exe",
        "terminal": "wt.exe",
        "cmd": "cmd.exe",
        "powershell": "powershell.exe",
        "paint": "mspaint.exe",
        "settings": "ms-settings:",
        "task manager": "taskmgr.exe",
        "control panel": "control.exe",
        "file manager": "explorer.exe",
        "spotify": "spotify.exe",
        "discord": "discord.exe",
        "steam": "steam.exe",
        "obs": "obs64.exe",
        "vlc": "vlc.exe",
    }

    async def execute(self, action: dict) -> dict:
        """Execute a single action."""
        action_type = action.get("type", "")
        params = action.get("parameters", {})
        description = action.get("description", action_type)

        log_activity("action_start", f"Executing: {description}", {"action": action})

        try:
            result = await self._dispatch(action_type, params)
            log_activity("action_done", f"Done: {description}", {"result": result})
            return {"success": True, "result": result}
        except Exception as e:
            log_activity("action_error", f"Failed: {description} — {e}", {"error": str(e)})
            return {"success": False, "error": str(e)}

    async def _dispatch(self, action_type: str, params: dict) -> str:
        if action_type == "open_app":
            return await self.open_app(params.get("app_name", ""))
        elif action_type == "type_text":
            return await self.type_text(params.get("text", ""))
        elif action_type == "key_press":
            return await self.key_press(params.get("keys", ""))
        elif action_type == "mouse_click":
            return await self.mouse_click(params.get("x"), params.get("y"), params.get("button", "left"))
        elif action_type == "mouse_move":
            return await self.mouse_move(params.get("x"), params.get("y"))
        elif action_type == "screenshot":
            return await self.take_screenshot()
        elif action_type == "focus_window":
            return await self.focus_window(params.get("title", ""))
        elif action_type == "close_window":
            return await self.close_window(params.get("title", ""))
        elif action_type == "shell_command":
            return await self.shell_command(params.get("command", ""))
        elif action_type == "clipboard_copy":
            return await self.clipboard_copy(params.get("text", ""))
        elif action_type == "clipboard_paste":
            return await self.clipboard_paste()
        elif action_type == "scroll":
            return await self.scroll(params.get("direction", "down"), params.get("amount", 3))
        elif action_type == "wait":
            return await self.wait(params.get("seconds", 1))
        elif action_type == "speak":
            return "Speech handled by TTS engine"
        elif action_type == "answer":
            return "Answer provided"
        elif action_type == "delete_file":
            return await self.delete_file(params.get("path", ""))
        elif action_type == "search_web":
            return await self.search_web(params.get("query", ""))
        elif action_type == "open_url":
            return await self.open_url(params.get("url", ""))
        elif action_type == "new_tab":
            return await self.new_tab()
        elif action_type == "write_notepad":
            return await self.write_notepad(params.get("text", ""))
        else:
            return f"Unknown action type: {action_type}"

    async def open_app(self, app_name: str) -> str:
        app_lower = app_name.lower().strip()
        exe = self.APP_MAP.get(app_lower, app_name)

        try:
            if exe.startswith("ms-settings:"):
                os.startfile(exe)
            else:
                os.startfile(exe)
        except Exception as e:
            try:
                subprocess.Popen(f'start "" "{exe}"', shell=True)
            except Exception as e2:
                return f"Failed to open {app_name}: {e2}"

        time.sleep(0.5)
        return f"Opened {app_name}"

    async def open_url(self, url: str) -> str:
        """Open a URL in the default browser."""
        url = url.strip()
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
        try:
            os.startfile(url)
        except Exception:
            import webbrowser
            webbrowser.open(url, new=2)
        return f"Opened URL: {url}"

    async def new_tab(self) -> str:
        """Open a new tab in active browser."""
        if PYAUTOGUI_AVAILABLE:
            try:
                pyautogui.hotkey("ctrl", "t")
                return "Opened new browser tab"
            except Exception:
                pass
        import webbrowser
        webbrowser.open_new_tab("https://www.google.com")
        return "Opened new browser tab"

    async def write_notepad(self, text: str) -> str:
        """Write text into a new .txt file on Desktop and immediately launch Notepad with it."""
        # Normalize newlines
        clean_text = text.replace("\\n", "\n")

        # Copy to clipboard as well
        if PYPERCLIP_AVAILABLE:
            try:
                import pyperclip
                pyperclip.copy(clean_text)
            except Exception:
                pass

        # Write to desktop .txt file
        try:
            desktop_dir = get_desktop_dir()
            file_path = desktop_dir / "jarvis_example.txt"
            file_path.write_text(clean_text, encoding="utf-8")
            
            # Launch Notepad with this file
            subprocess.Popen(["notepad.exe", str(file_path)])
            time.sleep(1.0)
            return f"Created {file_path.name} on Desktop and opened in Notepad"
        except Exception as e:
            # Fallback to direct notepad launch
            subprocess.Popen(["notepad.exe"])
            time.sleep(1.5)
            if PYAUTOGUI_AVAILABLE:
                pyautogui.hotkey("ctrl", "v")
            return f"Opened Notepad and pasted content (fallback: {e})"

    async def type_text(self, text: str) -> str:
        """Type short text. For long/code text, use write_notepad instead."""
        if not PYAUTOGUI_AVAILABLE:
            raise RuntimeError("PyAutoGUI not installed")
        # For any text with special chars or over 40 chars, use clipboard
        if len(text) > 40 or any(ord(c) > 127 for c in text):
            if PYPERCLIP_AVAILABLE:
                import pyperclip
                pyperclip.copy(text)
                pyautogui.hotkey("ctrl", "v")
                return f"Pasted (clipboard): {text[:50]}"
        pyautogui.typewrite(text, interval=0.04)
        return f"Typed: {text[:50]}"

    async def key_press(self, keys: str) -> str:
        if not PYAUTOGUI_AVAILABLE:
            raise RuntimeError("PyAutoGUI not installed")
        key_list = [k.strip() for k in keys.split("+")]
        if len(key_list) > 1:
            pyautogui.hotkey(*key_list)
        else:
            pyautogui.press(key_list[0])
        return f"Pressed: {keys}"

    async def mouse_click(self, x: Optional[int], y: Optional[int], button: str = "left") -> str:
        if not PYAUTOGUI_AVAILABLE:
            raise RuntimeError("PyAutoGUI not installed")
        if x is not None and y is not None:
            pyautogui.click(x, y, button=button)
            return f"Clicked {button} at ({x}, {y})"
        else:
            pyautogui.click(button=button)
            return f"Clicked {button} at current position"

    async def mouse_move(self, x: int, y: int) -> str:
        if not PYAUTOGUI_AVAILABLE:
            raise RuntimeError("PyAutoGUI not installed")
        pyautogui.moveTo(x, y, duration=0.3)
        return f"Moved mouse to ({x}, {y})"

    async def take_screenshot(self, save_path: str = None) -> str:
        if not PIL_AVAILABLE:
            raise RuntimeError("Pillow not installed")
        img = ImageGrab.grab()

        screenshots_dir = Path("screenshots")
        screenshots_dir.mkdir(exist_ok=True)

        fname = f"screenshot_{int(time.time())}.png"
        fpath = screenshots_dir / fname
        img.save(fpath, "PNG")

        return str(fpath)

    async def take_screenshot_b64(self) -> str:
        """Take screenshot and return as base64 string."""
        if not PIL_AVAILABLE:
            raise RuntimeError("Pillow not installed")
        img = ImageGrab.grab()
        # Resize to reduce token usage with vision model
        img = img.resize((1280, 720), Image.LANCZOS)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    async def focus_window(self, title: str) -> str:
        import ctypes
        ctypes.windll.user32.ShowWindow(ctypes.windll.user32.FindWindowW(None, title), 9)
        return f"Focused window: {title}"

    async def close_window(self, title: str) -> str:
        subprocess.run(f'taskkill /FI "WINDOWTITLE eq {title}" /F', shell=True, capture_output=True)
        return f"Closed window: {title}"

    async def shell_command(self, command: str) -> str:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
        output = result.stdout or result.stderr
        return output[:500] if output else "Command executed"

    async def clipboard_copy(self, text: str) -> str:
        if PYPERCLIP_AVAILABLE:
            pyperclip.copy(text)
        elif PYAUTOGUI_AVAILABLE:
            pyautogui.hotkey("ctrl", "a")
            time.sleep(0.1)
        return f"Copied to clipboard: {text[:50]}"

    async def clipboard_paste(self) -> str:
        if PYAUTOGUI_AVAILABLE:
            pyautogui.hotkey("ctrl", "v")
        return "Pasted from clipboard"

    async def scroll(self, direction: str, amount: int = 3) -> str:
        if not PYAUTOGUI_AVAILABLE:
            raise RuntimeError("PyAutoGUI not installed")
        clicks = amount if direction == "up" else -amount
        pyautogui.scroll(clicks)
        return f"Scrolled {direction} by {amount}"

    async def wait(self, seconds: float) -> str:
        time.sleep(seconds)
        return f"Waited {seconds} seconds"

    async def delete_file(self, path: str) -> str:
        p = Path(path)
        if p.exists():
            p.unlink()
            return f"Deleted: {path}"
        return f"File not found: {path}"

    async def search_web(self, query: str) -> str:
        clean_query = query.strip()
        # If query is already a URL or domain, open it directly
        if clean_query.startswith("http://") or clean_query.startswith("https://") or any(clean_query.lower().endswith(ext) for ext in [".com", ".org", ".net", ".io", ".edu", ".gov"]):
            return await self.open_url(clean_query)
        
        import urllib.parse
        url = f"https://www.google.com/search?q={urllib.parse.quote_plus(clean_query)}"
        try:
            os.startfile(url)
        except Exception:
            import webbrowser
            webbrowser.open(url, new=2)
        return f"Searching for: {clean_query}"


# Singleton
_controller = DesktopController()


def get_controller() -> DesktopController:
    return _controller
