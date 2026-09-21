"""
Zeus Central Core Engine — Madurai Grid Network Optimizer
Implements M/D/c queue modeling, multi-objective anti-herd cost function,
Haversine geolocation routing, and dynamic dock ranking.
"""

from typing import Dict, List, Any, Tuple
import math
import random

# ── Named Reference Nodes across Madurai Metropolitan Area ──

MADURAI_LANDMARKS: Dict[str, Dict[str, Any]] = {
    "meenakshi_temple": {"name": "Meenakshi Amman Temple", "coords": [78.1198, 9.9195], "type": "heritage"},
    "mattuthavani_bus": {"name": "Mattuthavani Bus Stand", "coords": [78.1630, 9.9472], "type": "transit"},
    "periyar_bus_stand": {"name": "Periyar Bus Stand", "coords": [78.1120, 9.9170], "type": "transit"},
    "madurai_jn_rly": {"name": "Madurai Junction Railway", "coords": [78.1150, 9.9190], "type": "transit"},
    "thirumalai_nayakkar": {"name": "Thirumalai Nayakkar Mahal", "coords": [78.1215, 9.9163], "type": "heritage"},
    "vaigai_dam": {"name": "Vaigai River Corridor", "coords": [78.1080, 9.9320], "type": "water"},
    "anna_nagar": {"name": "Anna Nagar Commercial", "coords": [78.1520, 9.9190], "type": "commercial"},
    "goripalayam": {"name": "Goripalayam Junction", "coords": [78.1325, 9.9350], "type": "junction"},
    "teppakulam": {"name": "Vandiyur Teppakulam Tank", "coords": [78.1480, 9.9080], "type": "heritage"},
    "airport": {"name": "Madurai International Airport", "coords": [78.1020, 9.8450], "type": "airport"},
    "kappalur": {"name": "Kappalur Industrial Area", "coords": [78.0450, 9.8550], "type": "industrial"},
    "samayanallur": {"name": "Samayanallur Highway Node", "coords": [78.0400, 9.9950], "type": "junction"},
    "thiruparankundram": {"name": "Thiruparankundram Temple Hill", "coords": [78.0820, 9.8820], "type": "heritage"},
    "othakadai": {"name": "Othakadai IT Corridor", "coords": [78.1950, 9.9650], "type": "tech_park"},
    "tallakulam": {"name": "Tallakulam Signal Zone", "coords": [78.1350, 9.9110], "type": "junction"},
    "bypass_ring": {"name": "Madurai Bypass Ring Road", "coords": [78.0700, 9.9100], "type": "highway"},
}


class MDCQueueModel:
    """M/D/c queue metrics for EV charging station analysis."""

    @staticmethod
    def calculate_metrics(arrival_rate_lambda: float, service_time_mins: float, servers_c: int) -> Dict[str, float]:
        mu = 1.0 / max(service_time_mins, 0.1)
        rho = arrival_rate_lambda / (servers_c * mu) if servers_c > 0 else 999.0

        if rho >= 1.0:
            return {
                "utilization_rho": round(min(rho, 1.0), 3),
                "expected_wait_mins": round(service_time_mins * 3, 1),
                "expected_queue_length": servers_c * 2,
                "throughput_per_hour": round(servers_c * mu * 60, 1),
                "system_state": "OVERLOADED"
            }

        # Erlang C approximation
        sum_k = sum((servers_c * rho) ** k / math.factorial(k) for k in range(servers_c))
        c_term = ((servers_c * rho) ** servers_c) / math.factorial(servers_c)
        erlang_c = c_term / (c_term + (1 - rho) * sum_k) if (c_term + (1 - rho) * sum_k) > 0 else 0

        wq = (erlang_c * service_time_mins) / (servers_c * (1 - rho)) if (1 - rho) > 0 else service_time_mins * 2
        # M/D/c correction: half the variance of M/M/c
        wq_mdc = wq * 0.5
        lq = arrival_rate_lambda * wq_mdc

        state = "OPTIMAL" if rho < 0.6 else ("MODERATE" if rho < 0.85 else "STRESSED")

        return {
            "utilization_rho": round(rho, 3),
            "expected_wait_mins": round(max(0, wq_mdc), 1),
            "expected_queue_length": round(max(0, lq), 1),
            "throughput_per_hour": round(servers_c * mu * 60, 1),
            "system_state": state
        }


class EVBatteryEnergyModel:
    """Battery depletion + energy cost estimation."""

    @staticmethod
    def estimate_energy_cost(distance_km: float, soc_percent: float, battery_kwh: float = 40.5,
                             efficiency_km_per_kwh: float = 6.5) -> Dict[str, float]:
        energy_needed_kwh = distance_km / max(efficiency_km_per_kwh, 0.1)
        current_energy_kwh = (soc_percent / 100.0) * battery_kwh
        remaining_after_kwh = current_energy_kwh - energy_needed_kwh
        soc_after = max(0, (remaining_after_kwh / battery_kwh) * 100)
        can_reach = remaining_after_kwh > (battery_kwh * 0.05)

        return {
            "energy_consumed_kwh": round(energy_needed_kwh, 2),
            "soc_after_percent": round(soc_after, 1),
            "can_reach": can_reach,
            "range_remaining_km": round(max(0, remaining_after_kwh * efficiency_km_per_kwh), 1)
        }


def haversine_km(coord1: List[float], coord2: List[float]) -> float:
    """Haversine distance between two [lng, lat] coordinates in km."""
    lon1, lat1 = math.radians(coord1[0]), math.radians(coord1[1])
    lon2, lat2 = math.radians(coord2[0]), math.radians(coord2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


class MaduraiGridNetworkOptimizer:
    """Multi-objective dock ranking & routing engine for Madurai EV grid."""

    def __init__(self):
        self.grid_weights = {
            "distance": 0.30,
            "wait_time": 0.25,
            "queue_length": 0.20,
            "power_rating": 0.10,
            "price": 0.10,
            "herd_penalty": 0.05
        }

    def rank_nearest_docks(self, origin_coords: List[float], stations: Dict[str, Any],
                           driver_soc: float = 24.0, vaigai_bottleneck: bool = False) -> List[Dict[str, Any]]:
        """Rank all docks from a driver's current position using multi-objective cost function."""
        results = []

        for hub_id, station in stations.items():
            dist_km = haversine_km(origin_coords, station["coords"])
            # Madurai roads: actual road factor ~ 1.35x
            road_dist_km = dist_km * 1.35
            # Average urban speed in Madurai is ~22 km/h
            speed_kmh = 22.0
            if vaigai_bottleneck and station["coords"][1] > 9.92:
                speed_kmh = 8.0  # Bottleneck near Vaigai
            travel_mins = (road_dist_km / speed_kmh) * 60

            q = MDCQueueModel.calculate_metrics(
                arrival_rate_lambda=max(1.0, station["queue"] * 2.5),
                service_time_mins=20.0,
                servers_c=station["plugs"]
            )

            energy = EVBatteryEnergyModel.estimate_energy_cost(
                distance_km=road_dist_km, soc_percent=driver_soc
            )

            # Anti-herd: penalize stations already attracting many drivers
            herd_score = station["queue"] / max(station["plugs"], 1)

            cost = (
                self.grid_weights["distance"] * (road_dist_km / 15.0) +
                self.grid_weights["wait_time"] * (q["expected_wait_mins"] / 30.0) +
                self.grid_weights["queue_length"] * (station["queue"] / 10.0) +
                self.grid_weights["power_rating"] * (1.0 - min(station.get("power_kw", 150), 350) / 350.0) +
                self.grid_weights["price"] * (station.get("price_per_kwh", 16) / 20.0) +
                self.grid_weights["herd_penalty"] * herd_score
            )

            results.append({
                "hub_id": hub_id,
                "name": station["name"],
                "zone": station.get("zone", ""),
                "coords": station["coords"],
                "distance_km": round(road_dist_km, 2),
                "travel_mins": round(travel_mins, 1),
                "available_plugs": station["plugs"] - station["occupied"],
                "queue_length": station["queue"],
                "status": station["status"],
                "power_kw": station.get("power_kw", 150),
                "price_per_kwh": station.get("price_per_kwh", 16.0),
                "mdc_wait_mins": q["expected_wait_mins"],
                "mdc_state": q["system_state"],
                "energy_cost": energy,
                "total_cost_score": round(cost, 4),
                "can_reach": energy["can_reach"],
                "total_time_to_charge_mins": round(travel_mins + q["expected_wait_mins"], 1)
            })

        results.sort(key=lambda x: x["total_cost_score"])
        for rank, r in enumerate(results, 1):
            r["rank"] = rank
        return results

    def calculate_turn_by_turn_route(self, origin_coords: List[float], dest_hub_id: str,
                                     vaigai_bottleneck: bool = False) -> Dict[str, Any]:
        """Generate approximate polyline waypoints from origin to destination hub."""
        from typing import Optional
        # Find destination coords from known stations
        # We'll build a polyline with intermediate waypoints
        dest_coords = None
        for hub in MADURAI_LANDMARKS.values():
            pass  # Landmarks are reference, not stations

        # Use station coords from the global data
        # This will be called with the actual stations from main.py
        # For now, return a simple two-point route
        return {
            "hub_id": dest_hub_id,
            "origin": origin_coords,
            "polyline": [origin_coords],  # Will be enhanced with OSRM
            "estimated_mins": 0,
            "distance_km": 0
        }
