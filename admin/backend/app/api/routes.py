"""
Zeus OS — REST API Routes
Exposes health, station listing, grid analytics, nearest-dock ranking,
individual hub queue metrics, and the optimize-driver endpoint.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.simulation import simulator
from app.services.optimizer import rank_docks
from app.services.queue_model import station_queue_snapshot
from app.api.websocket import manager

router = APIRouter(prefix="/api", tags=["Zeus Grid API"])


# ── Health ──

@router.get("/health")
async def health():
    return {
        "status": "online",
        "system": "Zeus Central Core Engine",
        "region": "Madurai Metropolitan Area",
        "active_hubs": len(simulator.stations),
        "tracked_drivers": len(simulator.drivers),
        "active_websockets": manager.count,
    }


# ── Stations ──

@router.get("/stations")
async def list_stations():
    return {"stations": [s.model_dump() for s in simulator.stations.values()]}


# ── Per-Hub Queue Metrics ──

@router.get("/queue_metrics/{hub_id}")
async def hub_queue_metrics(hub_id: str):
    station = simulator.stations.get(hub_id)
    if not station:
        return {"error": f"Hub {hub_id} not found"}
    q = station_queue_snapshot(station.queue, station.plugs)
    return {"hub_id": hub_id, "station_name": station.name, "mdc_metrics": q.model_dump()}


# ── Grid Analytics (all hubs) ──

@router.get("/grid/analytics")
async def grid_analytics():
    entries = []
    for hub_id, s in simulator.stations.items():
        per_plug_kw = s.power_kw / max(s.plugs, 1)
        active_draw = s.occupied * per_plug_kw
        load_pct = round((active_draw / max(s.power_kw, 1)) * 100, 1)
        q = station_queue_snapshot(s.queue, s.plugs)
        entries.append({
            "hub_id": hub_id,
            "name": s.name,
            "zone": s.zone,
            "total_capacity_kw": s.power_kw,
            "active_draw_kw": round(active_draw, 1),
            "load_percent": load_pct,
            "plugs": s.plugs,
            "occupied": s.occupied,
            "open_plugs": s.available,
            "queue": s.queue,
            "status": s.status,
            "mdc_utilization_rho": q.utilization_rho,
            "mdc_expected_wait_mins": q.expected_wait_mins,
        })
    total_kw = sum(s.power_kw for s in simulator.stations.values())
    return {"grid_analytics": entries, "total_grid_capacity_kw": total_kw}


# ── Nearest Docks Ranking ──

@router.get("/nearest")
async def nearest_docks(
    lng: float = 78.1198,
    lat: float = 9.9195,
    soc: float = 24.0,
    jam: bool = False,
):
    ranked = rank_docks(
        origin_coords=[lng, lat],
        stations=simulator.stations,
        driver_soc=soc,
        vaigai_bottleneck=jam,
    )
    return {"origin": [lng, lat], "ranked_docks": [r.model_dump() for r in ranked]}

# ── New: Nearest Dock Endpoint for Frontend (alias) ──
@router.get("/nearest-dock")
async def nearest_dock_endpoint(
    lat: float = Query(..., description="Latitude of the driver"),
    lng: float = Query(..., description="Longitude of the driver"),
    soc: float = Query(24.0, description="State of charge of the driver (percentage)"),
    jam: bool = Query(False, description="Whether to simulate arterial jam penalty"),
):
    """Return the single best dock (rank 0) and its route polyline.

    The frontend expects a structure similar to:
        {"dock": <RankedDock>, "route": {"coordinates": [[lng, lat], ...]}}
    For simplicity we reuse the existing ranking logic and return the first result.
    """
    ranked = rank_docks(
        origin_coords=[lng, lat],
        stations=simulator.stations,
        driver_soc=soc,
        vaigai_bottleneck=jam,
    )
    if not ranked:
        return {"error": "No docks available"}
    best = ranked[0]
    # Simple straight‑line route (fallback) – list of start and end coordinates.
    route = {"coordinates": [[lng, lat], best.coords]}
    return {"dock": best.model_dump(), "route": route}



# ── Optimize a specific driver ──

@router.get("/optimize/{driver_id}")
async def optimize_driver(driver_id: str, jam: bool = False):
    driver = simulator.drivers.get(driver_id)
    if not driver:
        return {"error": f"Driver {driver_id} not found"}
    ranked = rank_docks(
        origin_coords=driver.current_location,
        stations=simulator.stations,
        driver_soc=driver.soc,
        vaigai_bottleneck=jam,
    )
    return {"driver": driver.model_dump(), "ranked_recommendations": [r.model_dump() for r in ranked]}


# ── Drivers ──

@router.get("/drivers")
async def list_drivers():
    return {"drivers": [d.model_dump() for d in simulator.drivers.values()]}


# ── Metrics ──

@router.get("/metrics")
async def get_metrics():
    return simulator.metrics.model_dump()
