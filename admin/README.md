# ZEUS Admin Municipal Digital Twin Command Center

**ZEUS Admin** provides the municipal operations dashboard and grid simulation twin for city authorities.

## Architecture
- **Backend**: FastAPI Python server (`d:\Zeus\admin\backend`) running grid simulation, anomaly detection, and arterial traffic throttling.
- **Frontend Admin Twin**: Deck.gl 3D city visualization (`/admin` route on web).
- **WebSocket Feed**: Real-time arterial flow and power substation telemetry on `ws://localhost:8000/ws/grid`.

## Running the Admin Twin
1. Start Python Backend:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
2. Open Admin Dashboard:
   Navigate to `http://localhost:5173/admin` in any desktop browser.
