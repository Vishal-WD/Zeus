import asyncio
import json
from typing import Dict, Any, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from algorithm import MaduraiGridNetworkOptimizer, MDCQueueModel, EVBatteryEnergyModel, MADURAI_LANDMARKS

app = FastAPI(
    title="Zeus Central Core Engine — Madurai Digital Twin",
    description="Dynamic AI queue orchestration, predictive herd prevention, and autonomous slot reallocation across Madurai Metropolitan EV Infrastructure.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

optimizer = MaduraiGridNetworkOptimizer()

# 10 High-Power Fast-Charging Hubs covering the entire Madurai Metropolitan region
MADURAI_STATIONS: Dict[str, Dict[str, Any]] = {
    "HUB-01": {
        "id": "HUB-01", "name": "Mattuthavani Integrated FastPort",
        "zone": "East Madurai / Melur Highway", "coords": [78.1630, 9.9472],
        "plugs": 12, "occupied": 10, "queue": 7, "status": "jammed",
        "power_kw": 350, "price_per_kwh": 18.0
    },
    "HUB-02": {
        "id": "HUB-02", "name": "Goripalayam North FastHub",
        "zone": "North Madurai / Vaigai North", "coords": [78.1325, 9.9350],
        "plugs": 8, "occupied": 2, "queue": 0, "status": "optimal",
        "power_kw": 240, "price_per_kwh": 16.5
    },
    "HUB-03": {
        "id": "HUB-03", "name": "Anna Nagar Superstation",
        "zone": "East Madurai / 80 Feet Road", "coords": [78.1520, 9.9190],
        "plugs": 10, "occupied": 4, "queue": 1, "status": "optimal",
        "power_kw": 180, "price_per_kwh": 15.5
    },
    "HUB-04": {
        "id": "HUB-04", "name": "Periyar Central Transit Port",
        "zone": "Central Madurai / Railway Station", "coords": [78.1120, 9.9170],
        "plugs": 12, "occupied": 6, "queue": 2, "status": "optimal",
        "power_kw": 240, "price_per_kwh": 17.0
    },
    "HUB-05": {
        "id": "HUB-05", "name": "Vandiyur Teppakulam Gateway",
        "zone": "South-East Madurai", "coords": [78.1480, 9.9080],
        "plugs": 6, "occupied": 2, "queue": 0, "status": "optimal",
        "power_kw": 150, "price_per_kwh": 15.0
    },
    "HUB-06": {
        "id": "HUB-06", "name": "Kappalur Ring Road Express Node",
        "zone": "South Madurai Industrial Bypass", "coords": [78.0450, 9.8550],
        "plugs": 8, "occupied": 3, "queue": 1, "status": "optimal",
        "power_kw": 350, "price_per_kwh": 18.5
    },
    "HUB-07": {
        "id": "HUB-07", "name": "Samayanallur North Corridor Hub",
        "zone": "North Madurai Dindigul Highway", "coords": [78.0400, 9.9950],
        "plugs": 6, "occupied": 1, "queue": 0, "status": "optimal",
        "power_kw": 180, "price_per_kwh": 15.0
    },
    "HUB-08": {
        "id": "HUB-08", "name": "Thiruparankundram Tech Node",
        "zone": "South-West Madurai Heritage Zone", "coords": [78.0820, 9.8820],
        "plugs": 8, "occupied": 3, "queue": 0, "status": "optimal",
        "power_kw": 200, "price_per_kwh": 16.0
    },
    "HUB-09": {
        "id": "HUB-09", "name": "Othakadai High-Power Station",
        "zone": "North-East IT Park & Court Corridor", "coords": [78.1950, 9.9650],
        "plugs": 10, "occupied": 3, "queue": 1, "status": "optimal",
        "power_kw": 300, "price_per_kwh": 17.5
    },
    "HUB-10": {
        "id": "HUB-10", "name": "Madurai Airport AeroHub",
        "zone": "South Airport VIP Road", "coords": [78.1020, 9.8450],
        "plugs": 8, "occupied": 2, "queue": 0, "status": "optimal",
        "power_kw": 240, "price_per_kwh": 18.0
    }
}

MADURAI_DRIVERS: Dict[str, Dict[str, Any]] = {
    "DRV-404": {
        "id": "DRV-404", "name": "K. Murugan", "vehicle": "Tata Nexon EV Max",
        "battery_kwh": 40.5, "soc": 24, "target_station": "HUB-01",
        "reserved_slot": "17:30", "eta_minutes": 14, "is_rerouted": False,
        "anomaly_flagged": False, "current_location": [78.1280, 9.9280],
        "origin_name": "Vaigai North Causeway"
    },
    "DRV-108": {
        "id": "DRV-108", "name": "Selvi Priya", "vehicle": "MG ZS EV",
        "battery_kwh": 50.3, "soc": 11, "target_station": "HUB-01",
        "reserved_slot": "17:50", "eta_minutes": 2, "is_rerouted": False,
        "anomaly_flagged": False, "current_location": [78.1610, 9.9450],
        "origin_name": "Mattuthavani Ring Road"
    },
    "DRV-202": {
        "id": "DRV-202", "name": "R. Anandhan", "vehicle": "Mahindra XUV400 EV",
        "battery_kwh": 39.4, "soc": 42, "target_station": "HUB-03",
        "reserved_slot": "17:45", "eta_minutes": 10, "is_rerouted": False,
        "anomaly_flagged": False, "current_location": [78.1400, 9.9150],
        "origin_name": "Anna Nagar Main Road"
    }
}

DEFAULT_METRICS = {
    "wait_time_cut": "44.6%",
    "grid_utilization": "96.8%",
    "dead_slots_prevented": 22,
    "total_energy_kwh": 34800,
    "co2_saved_kg": 2640,
    "active_hubs_count": 10,
    "active_evs_in_grid": 184
}

# Active in-memory state
STATIONS = {k: dict(v) for k, v in MADURAI_STATIONS.items()}
DRIVERS = {k: dict(v) for k, v in MADURAI_DRIVERS.items()}
METRICS = dict(DEFAULT_METRICS)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_text(json.dumps(message))
            except Exception:
                dead.append(conn)
        for d in dead:
            self.disconnect(d)

manager = ConnectionManager()

def get_grid_state_payload():
    return {
        "type": "GRID_STATE",
        "region": "Madurai Metropolitan",
        "stations": list(STATIONS.values()),
        "drivers": list(DRIVERS.values()),
        "metrics": METRICS
    }

# ── REST API Endpoints ──────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "region": "Madurai Metropolitan Area",
        "system": "Zeus Central Core Engine",
        "active_hubs": len(STATIONS),
        "tracked_drivers": len(DRIVERS),
        "active_websockets": len(manager.active_connections)
    }

@app.get("/api/landmarks")
async def get_landmarks():
    return {"landmarks": list(MADURAI_LANDMARKS.values())}

@app.get("/api/stations")
async def get_all_stations():
    return {"stations": list(STATIONS.values())}

@app.get("/api/queue_metrics/{hub_id}")
async def get_hub_queue_metrics(hub_id: str):
    station = STATIONS.get(hub_id)
    if not station:
        return {"error": "Hub not found"}
    metrics = MDCQueueModel.calculate_metrics(
        arrival_rate_lambda=max(1.0, station["queue"] * 2.5),
        service_time_mins=20.0,
        servers_c=station["plugs"]
    )
    return {"hub_id": hub_id, "station_name": station["name"], "mdc_metrics": metrics}

@app.get("/api/grid/analytics")
async def get_grid_analytics():
    """Substation Power Load & Transformer Stress for all hubs."""
    analytics = []
    for hub_id, s in STATIONS.items():
        active_draw_kw = s["occupied"] * (s["power_kw"] / s["plugs"])
        load_pct = round((active_draw_kw / max(1, s["power_kw"])) * 100, 1)
        q = MDCQueueModel.calculate_metrics(
            arrival_rate_lambda=max(1.0, s["queue"] * 2.5),
            service_time_mins=20.0,
            servers_c=s["plugs"]
        )
        analytics.append({
            "hub_id": hub_id,
            "name": s["name"],
            "zone": s.get("zone", ""),
            "total_capacity_kw": s["power_kw"],
            "active_draw_kw": round(active_draw_kw, 1),
            "load_percent": load_pct,
            "plugs": s["plugs"],
            "occupied": s["occupied"],
            "open_plugs": s["plugs"] - s["occupied"],
            "queue": s["queue"],
            "status": s["status"],
            "mdc_utilization_rho": q["utilization_rho"],
            "mdc_expected_wait_mins": q["expected_wait_mins"]
        })
    return {"grid_analytics": analytics, "total_grid_capacity_kw": sum(s["power_kw"] for s in STATIONS.values())}

@app.get("/api/nearest")
async def get_nearest_docks(lng: float = 78.1198, lat: float = 9.9195, soc: float = 24.0, jam: bool = False):
    """Rank all 10 Madurai docks from any origin coordinates."""
    ranked = optimizer.rank_nearest_docks(
        origin_coords=[lng, lat],
        stations=STATIONS,
        driver_soc=soc,
        vaigai_bottleneck=jam
    )
    return {"origin": [lng, lat], "ranked_docks": ranked}

@app.get("/api/route/{hub_id}")
async def get_route_to_hub(hub_id: str, lng: float = 78.1198, lat: float = 9.9195, jam: bool = False):
    """Get turn-by-turn polyline route from origin to specific hub."""
    route = optimizer.calculate_turn_by_turn_route(
        origin_coords=[lng, lat],
        dest_hub_id=hub_id,
        vaigai_bottleneck=jam
    )
    station = STATIONS.get(hub_id, {})
    q = MDCQueueModel.calculate_metrics(
        arrival_rate_lambda=max(1.0, station.get("queue", 0) * 2.5),
        service_time_mins=20.0,
        servers_c=max(1, station.get("plugs", 8))
    )
    route["station"] = station
    route["mdc_metrics"] = q
    return route

@app.get("/api/optimize/{driver_id}")
async def optimize_driver_route(driver_id: str, jam: bool = False):
    driver = DRIVERS.get(driver_id)
    if not driver:
        return {"error": "Driver not found"}
    ranked = optimizer.rank_nearest_docks(
        origin_coords=driver.get("current_location", [78.1280, 9.9280]),
        stations=STATIONS,
        driver_soc=driver.get("soc", 24),
        vaigai_bottleneck=jam
    )
    return {"driver": driver, "ranked_recommendations": ranked}

# ── WebSocket Realtime Bus ───────────────────────────────────────────────────

@app.websocket("/ws/grid")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_text(json.dumps(get_grid_state_payload()))
        
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            action = payload.get("action")

            if action == "TRIGGER_ARTERIAL_JAM":
                DRIVERS["DRV-404"]["eta_minutes"] = 39
                DRIVERS["DRV-404"]["anomaly_flagged"] = True
                STATIONS["HUB-01"]["queue"] = 11
                STATIONS["HUB-01"]["status"] = "jammed"

                rec = optimizer.rank_nearest_docks(
                    origin_coords=DRIVERS["DRV-404"]["current_location"],
                    stations=STATIONS,
                    driver_soc=DRIVERS["DRV-404"]["soc"],
                    vaigai_bottleneck=True
                )

                await manager.broadcast({
                    "type": "ANOMALY_ALERT",
                    "severity": "CRITICAL",
                    "corridor": "Vaigai River Causeway / Goripalayam Junction",
                    "speed_drop_percent": 74,
                    "message": "Vaigai River Causeway bottleneck detected (-74% velocity drop). K. Murugan (DRV-404) will miss slot 17:30 at Mattuthavani by 25 mins.",
                    "driver": DRIVERS["DRV-404"],
                    "stations": list(STATIONS.values()),
                    "optimization": {"ranked_recommendations": rec[:5]}
                })

            elif action == "EXECUTE_SLOT_SWAP":
                DRIVERS["DRV-404"]["target_station"] = "HUB-02"
                DRIVERS["DRV-404"]["reserved_slot"] = "17:35"
                DRIVERS["DRV-404"]["eta_minutes"] = 5
                DRIVERS["DRV-404"]["is_rerouted"] = True
                DRIVERS["DRV-404"]["anomaly_flagged"] = False

                DRIVERS["DRV-108"]["reserved_slot"] = "17:15"
                DRIVERS["DRV-108"]["is_rerouted"] = True

                STATIONS["HUB-01"]["queue"] = 6
                STATIONS["HUB-01"]["status"] = "optimal"
                STATIONS["HUB-02"]["occupied"] = 3

                METRICS["wait_time_cut"] = "51.8%"
                METRICS["grid_utilization"] = "99.4%"
                METRICS["dead_slots_prevented"] += 1
                METRICS["co2_saved_kg"] += 45

                await manager.broadcast({
                    "type": "SWAP_SUCCESS",
                    "message": "Autonomous Slot Swap orchestrated. K. Murugan diverted to Goripalayam North FastHub; Selvi Priya advanced to 17:15.",
                    "driver": DRIVERS["DRV-404"],
                    "promoted_driver": DRIVERS["DRV-108"],
                    "stations": list(STATIONS.values()),
                    "metrics": METRICS
                })

            elif action == "RESET_GRID":
                for k, v in MADURAI_STATIONS.items():
                    STATIONS[k] = dict(v)
                for k, v in MADURAI_DRIVERS.items():
                    DRIVERS[k] = dict(v)
                for k, v in DEFAULT_METRICS.items():
                    METRICS[k] = v

                await manager.broadcast({
                    "type": "GRID_RESET",
                    "message": "Madurai Grid telemetry reset to baseline state.",
                    "stations": list(STATIONS.values()),
                    "drivers": list(DRIVERS.values()),
                    "metrics": METRICS
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
