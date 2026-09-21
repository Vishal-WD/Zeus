"""
Zeus OS — WebSocket Connection Manager
Handles client lifecycle (connect / disconnect / broadcast) for the /ws/grid endpoint.
"""

from __future__ import annotations

import json
from typing import List

from fastapi import WebSocket


class ConnectionManager:
    """Manages a set of active WebSocket connections and provides broadcast."""

    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, payload: dict) -> None:
        """Send a JSON payload to every connected client, pruning dead sockets."""
        dead: List[WebSocket] = []
        text = json.dumps(payload, default=str)
        for ws in self.active:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def count(self) -> int:
        return len(self.active)


# Module-level singleton
manager = ConnectionManager()
