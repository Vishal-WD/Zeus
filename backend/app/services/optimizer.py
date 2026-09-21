"""
Zeus OS — Slot-Swap Optimizer & Anti-Herd Cost Engine

Implements:
  1. Multi-objective cost function for ranking charging docks.
  2. Autonomous slot-swap proposal logic (combinatorial reassignment).
  3. Anti-herd divergence penalty to prevent charger-herd bottlenecks.
  4. EV battery energy depletion model for reachability checks.
"""

from __future__ import annotations

import math
from typing import Dict, List, Any

from app.core.config import get_settings
from app.models.schemas import Station, Driver, RankedDock
from app.services.queue_model import station_queue_snapshot


# ── Haversine ──

def haversine_km(coord1: List[float], coord2: List[float]) -> float:
    """Great-circle distance between two [lng, lat] points in kilometres."""
    lon1, lat1 = math.radians(coord1[0]), math.radians(coord1[1])
    lon2, lat2 = math.radians(coord2[0]), math.radians(coord2[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0 * 2.0 * math.asin(math.sqrt(a))


# ── Battery Energy Model ──

def estimate_energy_cost(
    distance_km: float,
    soc_percent: float,
    battery_kwh: float = 40.5,
    efficiency_km_per_kwh: float = 6.5,
) -> Dict[str, Any]:
    """
    Estimate energy consumed reaching a dock and whether the EV can make it.

    Returns dict with keys: energy_consumed_kwh, soc_after_percent, can_reach, range_remaining_km.
    """
    energy_needed = distance_km / max(efficiency_km_per_kwh, 0.01)
    current_energy = (soc_percent / 100.0) * battery_kwh
    remaining = current_energy - energy_needed
    soc_after = max(0.0, (remaining / battery_kwh) * 100.0)
    can_reach = remaining > (battery_kwh * 0.05)  # 5 % reserve

    return {
        "energy_consumed_kwh": round(energy_needed, 2),
        "soc_after_percent": round(soc_after, 1),
        "can_reach": can_reach,
        "range_remaining_km": round(max(0.0, remaining * efficiency_km_per_kwh), 1),
    }


# ── Multi-Objective Cost Weights ──

COST_WEIGHTS = {
    "distance":   0.30,
    "wait_time":  0.25,
    "queue":      0.20,
    "power":      0.10,
    "price":      0.10,
    "herd":       0.05,
}


def _compute_dock_cost(
    station: Station,
    road_distance_km: float,
    wait_mins: float,
) -> float:
    """Weighted additive cost — lower is better."""
    d_norm    = min(road_distance_km / 15.0, 1.0)
    w_norm    = min(wait_mins / 30.0, 1.0)
    q_norm    = min(station.queue / 10.0, 1.0)
    p_norm    = 1.0 - min(station.power_kw / 350.0, 1.0)
    price_n   = min(station.price_per_kwh / 20.0, 1.0)
    herd_n    = station.queue / max(station.plugs, 1)

    return round(
        COST_WEIGHTS["distance"]  * d_norm  +
        COST_WEIGHTS["wait_time"] * w_norm  +
        COST_WEIGHTS["queue"]     * q_norm  +
        COST_WEIGHTS["power"]     * p_norm  +
        COST_WEIGHTS["price"]     * price_n +
        COST_WEIGHTS["herd"]      * herd_n,
        4,
    )


# ── Dock Ranking ──

def rank_docks(
    origin_coords: List[float],
    stations: Dict[str, Station],
    driver_soc: float = 24.0,
    vaigai_bottleneck: bool = False,
) -> List[RankedDock]:
    """
    Rank every charging dock from *origin_coords* using the multi-objective cost function.

    Parameters
    ----------
    origin_coords : [lng, lat]
    stations : mapping hub_id → Station
    driver_soc : current battery state-of-charge %
    vaigai_bottleneck : whether the Vaigai Causeway is currently jammed (lowers speed for north-bank stations)
    """
    cfg = get_settings()
    results: List[RankedDock] = []

    for hub_id, station in stations.items():
        straight_km = haversine_km(origin_coords, station.coords)
        road_km = straight_km * cfg.ROAD_WINDING_FACTOR

        speed = cfg.URBAN_SPEED_KMH
        if vaigai_bottleneck and station.coords[1] > 9.92:
            speed = cfg.BOTTLENECK_SPEED_KMH

        travel_mins = (road_km / speed) * 60.0

        q = station_queue_snapshot(station.queue, station.plugs, cfg.DEFAULT_SERVICE_TIME_MINS)
        energy = estimate_energy_cost(road_km, driver_soc)
        cost = _compute_dock_cost(station, road_km, q.expected_wait_mins)

        results.append(RankedDock(
            hub_id=hub_id,
            name=station.name,
            zone=station.zone,
            coords=station.coords,
            distance_km=round(road_km, 2),
            travel_mins=round(travel_mins, 1),
            available_plugs=station.available,
            queue_length=station.queue,
            status=station.status,
            power_kw=station.power_kw,
            price_per_kwh=station.price_per_kwh,
            mdc_wait_mins=q.expected_wait_mins,
            mdc_state=q.system_state,
            energy_consumed_kwh=energy["energy_consumed_kwh"],
            soc_after_percent=energy["soc_after_percent"],
            can_reach=energy["can_reach"],
            total_cost_score=cost,
            total_time_to_charge_mins=round(travel_mins + q.expected_wait_mins, 1),
        ))

    results.sort(key=lambda r: r.total_cost_score)
    for rank, entry in enumerate(results, 1):
        entry.rank = rank
    return results


# ── Slot-Swap Proposal ──

def propose_slot_swap(
    affected_driver: Driver,
    stations: Dict[str, Station],
    all_drivers: Dict[str, Driver],
    vaigai_bottleneck: bool = False,
) -> Dict[str, Any]:
    """
    Given a driver who will miss their reserved slot, find the best alternative
    station and identify a beneficiary driver who can absorb the freed original slot.

    Returns a dict describing the proposed swap or None if no viable swap exists.
    """
    ranked = rank_docks(
        origin_coords=affected_driver.current_location,
        stations=stations,
        driver_soc=affected_driver.soc,
        vaigai_bottleneck=vaigai_bottleneck,
    )

    # Filter out the driver's current target (they can't reach it in time)
    alternatives = [r for r in ranked if r.hub_id != affected_driver.target_station and r.can_reach]
    if not alternatives:
        return {"viable": False, "reason": "No reachable alternative stations."}

    best = alternatives[0]

    # Find a beneficiary: another driver heading to the SAME original station who arrives sooner
    original_station_id = affected_driver.target_station
    beneficiary = None
    for did, d in all_drivers.items():
        if did == affected_driver.id:
            continue
        if d.target_station == original_station_id and d.eta_minutes < affected_driver.eta_minutes:
            beneficiary = d
            break

    return {
        "viable": True,
        "affected_driver_id": affected_driver.id,
        "new_station": best.model_dump(),
        "beneficiary_driver_id": beneficiary.id if beneficiary else None,
        "estimated_savings_mins": round(
            max(0, affected_driver.eta_minutes - best.travel_mins), 1
        ),
        "ranked_top5": [r.model_dump() for r in alternatives[:5]],
    }
