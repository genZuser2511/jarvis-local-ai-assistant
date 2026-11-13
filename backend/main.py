"""FastAPI main application — JARVIS backend server."""
import asyncio
import base64
import json
import os
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from config import settings
from database import (init_db, get_conversation_history, get_recent_activity,
                      get_pending_approvals, log_activity, save_setting, get_setting)
from ollama_client import get_ollama
from desktop_controller import get_controller
from speech_engine import get_speech
from jarvis_core import get_core
from ws_manager import manager


import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[*] JARVIS starting up...")
    init_db()
    log_activity("system", "JARVIS backend started", {})

    # Start hotkey listener
    asyncio.create_task(start_hotkey_listener())

    # Init speech + wake word in background (avoids blocking startup)
    asyncio.create_task(warm_speech_and_wake_word())

    yield

    # Shutdown
    get_speech().stop_wake_word_loop()
    log_activity("system", "JARVIS backend stopping", {})
    await get_ollama().close()
    print("[*] JARVIS shutting down.")


async def warm_speech_and_wake_word():
    """Init Whisper + openwakeword, then start the continuous wake-word loop."""
    await asyncio.sleep(2)   # let uvicorn fully settle first

    loop = asyncio.get_event_loop()

    # Load Whisper STT (runs in thread pool so it doesn’t block)
    await loop.run_in_executor(None, get_speech().initialize)

    # Load openwakeword model
    await loop.run_in_executor(None, get_speech().initialize_wake_word)

    # Start the continuous background mic loop
    get_speech().start_wake_word_loop(
        async_callback=get_core().on_wake_word,
        loop=loop
    )
    log_activity("system", "Voice pipeline ready — say 'Hey Jarvis' to start", {})


async def start_hotkey_listener():
    """Listen for global hotkeys (push-to-talk, stop)."""
    try:
        import keyboard
        def on_push_to_talk():
            asyncio.create_task(_handle_push_to_talk())

        def on_stop():
            asyncio.create_task(_handle_stop())

        keyboard.add_hotkey(settings.push_to_talk_key, on_push_to_talk)
        keyboard.add_hotkey(settings.stop_key, on_stop)
        log_activity("system", f"Hotkeys registered: PTT={settings.push_to_talk_key}, Stop={settings.stop_key}", {})
    except Exception as e:
        log_activity("warning", f"Hotkey listener failed: {e}", {})


async def _handle_push_to_talk():
    text = await get_core().start_push_to_talk()
    if text:
        await get_core().process_command(text)


async def _handle_stop():
    await get_core().stop_listening()
    await manager.send_status("idle", {"reason": "stopped_by_hotkey"})


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="JARVIS",
    description="Local AI Desktop Assistant",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve screenshots as static files
screenshots_dir = Path("screenshots")
screenshots_dir.mkdir(exist_ok=True)
app.mount("/screenshots", StaticFiles(directory="screenshots"), name="screenshots")


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------
class CommandRequest(BaseModel):
    text: str
    include_screenshot: bool = False


class ApprovalRequest(BaseModel):
    action_id: int
    approved: bool


class SettingsRequest(BaseModel):
    ollama_model: Optional[str] = None
    whisper_model_size: Optional[str] = None
    push_to_talk_key: Optional[str] = None
    stop_key: Optional[str] = None
    wake_word: Optional[str] = None
    require_approval_for_sensitive: Optional[bool] = None
    piper_speed: Optional[float] = None


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial state
        await websocket.send_text(json.dumps({
            "type": "connected",
            "status": get_core().status,
            "timestamp": time.time()
        }))

        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

            elif msg_type == "command":
                # Non-blocking: run command and stream results back
                asyncio.create_task(get_core().process_command(
                    msg.get("text", ""),
                    include_screenshot=msg.get("include_screenshot", False)
                ))

            elif msg_type == "approve":
                await get_core().approve_action_by_id(msg.get("action_id"))

            elif msg_type == "deny":
                await get_core().deny_action_by_id(msg.get("action_id"))

            elif msg_type == "start_listening":
                asyncio.create_task(_handle_push_to_talk())

            elif msg_type == "stop_listening":
                await get_core().stop_listening()

            elif msg_type == "screenshot":
                asyncio.create_task(get_core().take_screenshot_and_analyze())

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        log_activity("error", f"WebSocket error: {e}", {})
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------
@app.get("/")
async def root():
    return {"message": "JARVIS is online", "status": get_core().status}


@app.get("/health")
async def health():
    ollama_ok = await get_ollama().is_available()
    models = await get_ollama().list_models() if ollama_ok else []
    return {
        "status": "ok",
        "jarvis_status": get_core().status,
        "ollama_available": ollama_ok,
        "ollama_models": models,
        "whisper_loaded": get_speech()._initialized,
        "active_ws_connections": len(manager.active_connections),
    }


@app.post("/command")
async def command(req: CommandRequest):
    """Submit a text command to JARVIS."""
    result = await get_core().process_command(req.text, req.include_screenshot)
    return result


@app.post("/approve")
async def approve(req: ApprovalRequest):
    """Approve or deny a pending action."""
    if req.approved:
        await get_core().approve_action_by_id(req.action_id)
        return {"status": "approved", "action_id": req.action_id}
    else:
        await get_core().deny_action_by_id(req.action_id)
        return {"status": "denied", "action_id": req.action_id}


@app.get("/history")
async def history(limit: int = 20):
    """Get conversation history."""
    return get_conversation_history(limit=limit)


@app.get("/activity")
async def activity(limit: int = 50):
    """Get recent activity log."""
    return get_recent_activity(limit=limit)


@app.get("/approvals")
async def approvals():
    """Get pending approval requests."""
    return get_pending_approvals()


@app.post("/listen")
async def listen():
    """Start push-to-talk recording."""
    asyncio.create_task(_handle_push_to_talk())
    return {"status": "listening"}


@app.post("/stop")
async def stop():
    """Stop current action."""
    await get_core().stop_listening()
    return {"status": "stopped"}


@app.post("/screenshot")
async def screenshot():
    """Take and analyze a screenshot."""
    result = await get_core().take_screenshot_and_analyze()
    return result


@app.get("/settings")
async def get_settings():
    return {
        "ollama_model": settings.ollama_model,
        "ollama_vision_model": settings.ollama_vision_model,
        "whisper_model_size": settings.whisper_model_size,
        "push_to_talk_key": settings.push_to_talk_key,
        "stop_key": settings.stop_key,
        "wake_word": settings.wake_word,
        "require_approval_for_sensitive": settings.require_approval_for_sensitive,
        "piper_speed": settings.piper_speed,
    }


@app.post("/settings")
async def update_settings(req: SettingsRequest):
    """Update JARVIS settings."""
    changed = {}
    if req.ollama_model:
        settings.ollama_model = req.ollama_model
        get_ollama().model = req.ollama_model
        changed["ollama_model"] = req.ollama_model
    if req.whisper_model_size:
        settings.whisper_model_size = req.whisper_model_size
        changed["whisper_model_size"] = req.whisper_model_size
    if req.push_to_talk_key:
        settings.push_to_talk_key = req.push_to_talk_key
        changed["push_to_talk_key"] = req.push_to_talk_key
    if req.wake_word:
        settings.wake_word = req.wake_word
        changed["wake_word"] = req.wake_word
    if req.require_approval_for_sensitive is not None:
        settings.require_approval_for_sensitive = req.require_approval_for_sensitive
        changed["require_approval_for_sensitive"] = req.require_approval_for_sensitive

    for k, v in changed.items():
        save_setting(k, v)

    await manager.send_activity("settings", "Settings updated", changed)
    return {"status": "ok", "changed": changed}


@app.get("/models")
async def models():
    """List available Ollama models."""
    available = await get_ollama().list_models()
    return {"models": available, "current": settings.ollama_model}


@app.post("/speak")
async def speak(body: dict):
    """Make JARVIS speak a message."""
    text = body.get("text", "")
    if text:
        asyncio.create_task(get_speech().speak(text))
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
