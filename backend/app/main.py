"""
Zeus OS — FastAPI Application Entry Point
Creates the app, mounts CORS, REST router, and the WebSocket /ws/grid endpoint.
"""

from __future__ import annotations

import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import router as api_router
from app.api.websocket import manager
from app.services.simulation import simulator

settings = get_settings()

# ── Application Factory ──

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Dynamic AI Queue Orchestration, Predictive Herd Prevention, "
        "and Autonomous Slot Reallocation for Madurai Metropolitan EV Infrastructure."
    ),
)

# ── CORS ──

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST Router ──

app.include_router(api_router)


# ── WebSocket Endpoint ──

@app.websocket("/ws/grid")
async def ws_grid(ws: WebSocket):
    await manager.connect(ws)
    try:
        # Hydrate new client with current grid state
        payload = simulator.grid_state_payload()
        await ws.send_text(json.dumps(payload.model_dump(), default=str))

        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)
            action = data.get("action", "")

            if action == "TRIGGER_ARTERIAL_JAM":
                anomaly = simulator.inject_arterial_jam()
                await manager.broadcast(anomaly.model_dump())

            elif action == "EXECUTE_SLOT_SWAP":
                swap = simulator.execute_slot_swap()
                await manager.broadcast(swap.model_dump())

            elif action == "RESET_GRID":
                reset = simulator.reset_grid()
                await manager.broadcast(reset.model_dump())

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


# ── CLI entry ──

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
