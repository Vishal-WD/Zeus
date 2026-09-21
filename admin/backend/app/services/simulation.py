"""
Zeus OS — Grid Simulation Engine
Manages in-memory station / driver / metrics state for the Madurai Metropolitan EV grid.
Provides scenario injectors (arterial jam, slot swap, grid reset) and arterial velocity degradation.
"""

from __future__ import annotations

import copy
from typing import Dict, Optional

from app.models.schemas import (
    Station, Driver, GridMetrics,
    AnomalyPayload, SwapSuccessPayload, GridStatePayload,
)
from app.services.optimizer import rank_docks, propose_slot_swap


# ──────────────────────────────────────────────────────────────────────────────
# ──────────────────────────────────────────────────────────────────────────────
# Seed Data — 15 Real-World EV Charging Stations across Madurai Metropolitan
# ──────────────────────────────────────────────────────────────────────────────

SEED_STATIONS: Dict[str, dict] = {
    "EV-01": {
        "id": "EV-01",
        "name": "ZEON Charging Station - JC Residency",
        "address": "JC Residency, Lady Doak College Road",
        "zone": "Lady Doak College Rd, Narimedu",
        "contact": "+91 97896 16161",
        "coords": [78.1332, 9.9395],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 16.5
    },
    "EV-02": {
        "id": "EV-02",
        "name": "FATAFAT Charging Station",
        "address": "190/3, Manika Vasakar St, Nehru Nagar",
        "zone": "Nehru Nagar / Mahaboopalayam",
        "contact": "+91 82200 57754",
        "coords": [78.1065, 9.9180],
        "plugs": 4,
        "occupied": 0,
        "queue": 0,
        "status": "optimal",
        "power_kw": 50,
        "price_per_kwh": 15.0
    },
    "EV-03": {
        "id": "EV-03",
        "name": "Chargezone - KK Nagar",
        "address": "168, Alagar Kovil Main Road, KK Nagar",
        "zone": "Alagar Kovil Main Road, KK Nagar",
        "contact": "+91 1800 121 2025",
        "coords": [78.1470, 9.9385],
        "plugs": 8,
        "occupied": 2,
        "queue": 0,
        "status": "optimal",
        "power_kw": 150,
        "price_per_kwh": 17.0
    },
    "EV-04": {
        "id": "EV-04",
        "name": "ZEON Charging Station - GRT Grand",
        "address": "GRT Hotels Parking, Grand Madurai, Chinthamani",
        "zone": "Chinthamani / Ring Road Junction",
        "contact": "+91 97896 16161",
        "coords": [78.1480, 9.8965],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 120,
        "price_per_kwh": 16.5
    },
    "EV-05": {
        "id": "EV-05",
        "name": "BPCL Charging Station - Mandela Nagar",
        "address": "Mandela Nagar, Madurai",
        "zone": "Mandela Nagar / Airport Highway",
        "contact": "+91 81900 30200",
        "coords": [78.1120, 9.8520],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 15.5
    },
    "EV-06": {
        "id": "EV-06",
        "name": "ZEON Charging Station - Velammal",
        "address": "Velammal Hospital, Chinthamani",
        "zone": "Chinthamani / Velammal Campus",
        "contact": "+91 97896 16161",
        "coords": [78.1565, 9.8950],
        "plugs": 8,
        "occupied": 2,
        "queue": 0,
        "status": "optimal",
        "power_kw": 120,
        "price_per_kwh": 16.5
    },
    "EV-07": {
        "id": "EV-07",
        "name": "OnePlug EV Charging Station",
        "address": "Madurai Food Palace, Vandiyur",
        "zone": "Vandiyur / Sivagangai Road",
        "contact": "+91 94445 21602",
        "coords": [78.1610, 9.9125],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 16.0
    },
    "EV-08": {
        "id": "EV-08",
        "name": "Adani Charging Station - Airport Rd",
        "address": "Airport Road, Perungudi",
        "zone": "Perungudi / Airport Corridor",
        "contact": "+91 1800 572 2326",
        "coords": [78.1060, 9.8410],
        "plugs": 8,
        "occupied": 2,
        "queue": 0,
        "status": "optimal",
        "power_kw": 150,
        "price_per_kwh": 17.5
    },
    "EV-09": {
        "id": "EV-09",
        "name": "Tata Power Fast Charging - Pasumalai",
        "address": "The Gateway Hotel, Pasumalai",
        "zone": "Pasumalai / Thiruparankundram Rd",
        "contact": "+91 1800 833 2233",
        "coords": [78.0845, 9.8920],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 17.0
    },
    "EV-10": {
        "id": "EV-10",
        "name": "Tucker Charging Station - K.Pudur",
        "address": "Melur Main Road, Industrial Estate, K.Pudur",
        "zone": "K.Pudur Industrial Estate",
        "contact": "+91 93847 01005",
        "coords": [78.1580, 9.9540],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 16.0
    },
    "EV-11": {
        "id": "EV-11",
        "name": "ZEON Charging Station - Othakadai",
        "address": "Madurai High Court Corridor, PIN 625107",
        "zone": "Othakadai / High Court Bench",
        "contact": "+91 97896 16161",
        "coords": [78.1960, 9.9670],
        "plugs": 8,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 120,
        "price_per_kwh": 16.5
    },
    "EV-12": {
        "id": "EV-12",
        "name": "Tata Power Charging Station - Paravai",
        "address": "Paravai, Madurai 625402",
        "zone": "Paravai / Dindigul Highway",
        "contact": "+91 1800 833 2233",
        "coords": [78.0720, 9.9780],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 17.0
    },
    "EV-13": {
        "id": "EV-13",
        "name": "Tata Power - Ayanpappakkudi",
        "address": "Ayanpappakkudi, Perungudi",
        "zone": "Ayanpappakkudi / Ring Road South",
        "contact": "+91 1800 833 2233",
        "coords": [78.1250, 9.8480],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 17.0
    },
    "EV-14": {
        "id": "EV-14",
        "name": "Tata Power - Uthangudi Ring Road",
        "address": "Ring Road, Uthangudi",
        "zone": "Uthangudi / High-Speed Ring Road",
        "contact": "+91 1800 833 2233",
        "coords": [78.1720, 9.9580],
        "plugs": 8,
        "occupied": 2,
        "queue": 0,
        "status": "optimal",
        "power_kw": 120,
        "price_per_kwh": 17.0
    },
    "EV-15": {
        "id": "EV-15",
        "name": "BPCL Charging Station - Koodal Nagar",
        "address": "Chokkalinga Nagar, Koodal Nagar",
        "zone": "Koodal Nagar / Chokkalinga Nagar",
        "contact": "+91 1800 224 344",
        "coords": [78.1050, 9.9520],
        "plugs": 4,
        "occupied": 0,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 15.5
    },
    "EV-16": {
        "id": "EV-16",
        "name": "ZEON Charging Station - Pasumpon",
        "address": "Madakulam Main Road, Pasumpon Nagar",
        "zone": "Madakulam / Pasumpon Nagar",
        "contact": "+91 97896 16161",
        "coords": [78.0870, 9.9080],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 16.5
    },
    "EV-17": {
        "id": "EV-17",
        "name": "Ather Grid - Vilangudi",
        "address": "Opp. Fathima College, Vilangudi",
        "zone": "Vilangudi / Fathima College (Scooty Fast)",
        "contact": "+91 97511 53231",
        "coords": [78.0940, 9.9620],
        "plugs": 4,
        "occupied": 0,
        "queue": 0,
        "status": "optimal",
        "power_kw": 25,
        "price_per_kwh": 14.0
    },
    "EV-18": {
        "id": "EV-18",
        "name": "Tucker Charging Station - Airport Road",
        "address": "Airport Road, near Police Check Post, Perungudi",
        "zone": "Airport Road / Check Post, Perungudi",
        "contact": "+91 93847 01005",
        "coords": [78.1030, 9.8390],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 16.0
    },
    "EV-19": {
        "id": "EV-19",
        "name": "IOCL EV Charging - Iyer Bungalow",
        "address": "Indian Oil Petrol Pump, Iyer Bungalow",
        "zone": "Iyer Bungalow Main Road",
        "contact": "+91 1800 233 3555",
        "coords": [78.1360, 9.9650],
        "plugs": 6,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 60,
        "price_per_kwh": 15.5
    },
    "EV-20": {
        "id": "EV-20",
        "name": "Ather Grid - Surveyor Colony",
        "address": "120 Feet Road, Surveyor Colony, K.Pudur",
        "zone": "Surveyor Colony / 120 Ft Road",
        "contact": "+91 76766 00900",
        "coords": [78.1560, 9.9520],
        "plugs": 4,
        "occupied": 1,
        "queue": 0,
        "status": "optimal",
        "power_kw": 25,
        "price_per_kwh": 14.0
    },
}

SEED_DRIVERS: Dict[str, dict] = {
    "DRV-404": {"id": "DRV-404", "name": "K. Murugan",   "vehicle": "Ola S1 Pro (Scooty)",   "battery_kwh": 4.0,  "soc": 24, "target_station": "EV-04", "reserved_slot": "17:30", "eta_minutes": 14, "is_rerouted": False, "anomaly_flagged": False, "current_location": [78.1280, 9.9280], "origin_name": "Vaigai North Causeway"},
    "DRV-108": {"id": "DRV-108", "name": "Selvi Priya",  "vehicle": "Tata Nexon EV Max",     "battery_kwh": 40.5, "soc": 11, "target_station": "EV-04", "reserved_slot": "17:50", "eta_minutes": 2,  "is_rerouted": False, "anomaly_flagged": False, "current_location": [78.1380, 9.9400], "origin_name": "Alagar Kovil Road"},
    "DRV-202": {"id": "DRV-202", "name": "R. Anandhan",  "vehicle": "Ather 450X (Scooty)",   "battery_kwh": 3.7,  "soc": 42, "target_station": "EV-06", "reserved_slot": "17:45", "eta_minutes": 10, "is_rerouted": False, "anomaly_flagged": False, "current_location": [78.1300, 9.9350], "origin_name": "Lady Doak College Rd"},
}

SEED_METRICS = {
    "wait_time_cut": "44.6%",
    "grid_utilization": "96.8%",
    "dead_slots_prevented": 22,
    "total_energy_kwh": 34800.0,
    "co2_saved_kg": 2640.0,
    "active_hubs_count": 15,
    "active_evs_in_grid": 184,
}


# ──────────────────────────────────────────────────────────────────────────────

class GridSimulator:
    """
    Stateful simulation engine.

    Holds mutable copies of stations, drivers, and metrics that are mutated by
    scenario injectors and broadcast to WebSocket clients.
    """

    def __init__(self) -> None:
        self._reset_internal()

    # ── State accessors ──

    @property
    def stations(self) -> Dict[str, Station]:
        return self._stations

    @property
    def drivers(self) -> Dict[str, Driver]:
        return self._drivers

    @property
    def metrics(self) -> GridMetrics:
        return self._metrics

    # ── Snapshot ──

    def grid_state_payload(self) -> GridStatePayload:
        return GridStatePayload(
            type="GRID_STATE",
            region="Madurai Metropolitan",
            stations=list(self._stations.values()),
            drivers=list(self._drivers.values()),
            metrics=self._metrics,
        )

    # ── Scenario: Inject Arterial Jam ──

    def inject_arterial_jam(self) -> AnomalyPayload:
        """
        Simulate Vaigai River Causeway bottleneck.
        DRV-404 ETA inflated, EV-04 queue surges, anomaly flagged.
        """
        drv = self._stations.get("EV-04")
        if drv:
            self._stations["EV-04"] = drv.model_copy(update={"queue": 7, "status": "jammed"})

        d404 = self._drivers.get("DRV-404")
        if d404:
            self._drivers["DRV-404"] = d404.model_copy(
                update={"eta_minutes": 39, "anomaly_flagged": True}
            )

        ranked = rank_docks(
            origin_coords=self._drivers["DRV-404"].current_location,
            stations=self._stations,
            driver_soc=self._drivers["DRV-404"].soc,
            vaigai_bottleneck=True,
        )

        return AnomalyPayload(
            type="ANOMALY_ALERT",
            severity="CRITICAL",
            corridor="Vaigai River Causeway / Goripalayam Junction",
            speed_drop_percent=74,
            message=(
                "Vaigai River Causeway bottleneck detected (−74 % velocity drop). "
                "K. Murugan (DRV-404) will miss slot at Chargezone by 25 mins. Rerouting to empty dock."
            ),
            driver=self._drivers["DRV-404"],
            stations=list(self._stations.values()),
            optimization={"ranked_recommendations": [r.model_dump() for r in ranked[:5]]},
        )

    # ── Scenario: Execute Autonomous Slot Swap ──

    def execute_slot_swap(self) -> SwapSuccessPayload:
        """
        Autonomously reassign DRV-404 to Zeon Lady Doak (EV-06) and advance
        DRV-108's slot.
        """
        d404 = self._drivers.get("DRV-404")
        if d404:
            self._drivers["DRV-404"] = d404.model_copy(update={
                "target_station": "EV-06",
                "reserved_slot": "17:35",
                "eta_minutes": 5,
                "is_rerouted": True,
                "anomaly_flagged": False,
            })

        d108 = self._drivers.get("DRV-108")
        if d108:
            self._drivers["DRV-108"] = d108.model_copy(update={
                "reserved_slot": "17:15",
                "is_rerouted": True,
            })

        ev04 = self._stations.get("EV-04")
        if ev04:
            self._stations["EV-04"] = ev04.model_copy(update={"queue": 1, "status": "optimal"})

        ev06 = self._stations.get("EV-06")
        if ev06:
            self._stations["EV-06"] = ev06.model_copy(update={"occupied": 2})

        self._metrics = self._metrics.model_copy(update={
            "wait_time_cut": "51.8%",
            "grid_utilization": "99.4%",
            "dead_slots_prevented": self._metrics.dead_slots_prevented + 1,
            "co2_saved_kg": self._metrics.co2_saved_kg + 45,
        })

        return SwapSuccessPayload(
            type="SWAP_SUCCESS",
            message=(
                "Autonomous Slot Swap orchestrated. "
                "K. Murugan diverted to Goripalayam North FastHub; "
                "Selvi Priya advanced to 17:15."
            ),
            driver=self._drivers.get("DRV-404"),
            promoted_driver=self._drivers.get("DRV-108"),
            stations=list(self._stations.values()),
            metrics=self._metrics,
        )

    # ── Scenario: Reset Grid ──

    def reset_grid(self) -> GridStatePayload:
        """Restore all state to baseline seed values."""
        self._reset_internal()
        payload = self.grid_state_payload()
        payload.type = "GRID_RESET"
        return payload

    # ── Private ──

    def _reset_internal(self) -> None:
        self._stations: Dict[str, Station] = {
            k: Station(**v) for k, v in SEED_STATIONS.items()
        }
        self._drivers: Dict[str, Driver] = {
            k: Driver(**v) for k, v in SEED_DRIVERS.items()
        }
        self._metrics = GridMetrics(**SEED_METRICS)


# Module-level singleton
simulator = GridSimulator()
