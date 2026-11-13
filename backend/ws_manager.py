"""WebSocket manager for real-time updates to the frontend."""
import json
import time
from typing import Set
from fastapi import WebSocket
from database import log_activity


class ConnectionManager:
    """Manages all active WebSocket connections."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.add(ws)
        log_activity("system", "Frontend connected", {"clients": len(self.active_connections)})

    def disconnect(self, ws: WebSocket):
        self.active_connections.discard(ws)
        log_activity("system", "Frontend disconnected", {"clients": len(self.active_connections)})

    async def broadcast(self, data: dict):
        """Send data to all connected clients."""
        if not self.active_connections:
            return
        message = json.dumps(data)
        dead = set()
        for ws in self.active_connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active_connections.discard(ws)

    async def send_activity(self, event_type: str, message: str, data: dict = None):
        """Broadcast a live-activity update."""
        await self.broadcast({
            "type": "activity",
            "event": event_type,
            "message": message,
            "data": data or {},
            "timestamp": time.time()
        })

    async def send_transcript(self, role: str, content: str, metadata: dict = None):
        """Broadcast a new chat message."""
        await self.broadcast({
            "type": "message",
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "timestamp": time.time()
        })

    async def send_screenshot(self, filepath: str, description: str = None):
        """Broadcast a new screenshot."""
        await self.broadcast({
            "type": "screenshot",
            "filepath": filepath,
            "description": description,
            "timestamp": time.time()
        })

    async def send_approval_request(self, action_id: int, action: dict):
        """Request user approval for a sensitive action."""
        await self.broadcast({
            "type": "approval_request",
            "action_id": action_id,
            "action": action,
            "timestamp": time.time()
        })

    async def send_status(self, status: str, details: dict = None):
        """Send JARVIS status update (idle, listening, thinking, acting, speaking)."""
        await self.broadcast({
            "type": "status",
            "status": status,
            "details": details or {},
            "timestamp": time.time()
        })

    async def send_action_result(self, action: dict, result: dict):
        """Send result of an executed action."""
        await self.broadcast({
            "type": "action_result",
            "action": action,
            "result": result,
            "timestamp": time.time()
        })


# Singleton
manager = ConnectionManager()
