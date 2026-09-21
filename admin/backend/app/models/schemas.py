"""
Zeus OS — Pydantic Domain Schemas
Canonical data models shared across REST, WebSocket, and service layers.
"""

from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# ── Enums ──

StatusLevel = Literal["optimal", "moderate", "jammed"]


# ── Station ──

class Station(BaseModel):
    """A single high-power EV charging hub."""
    id: str = Field(..., examples=["HUB-01"])
    name: str = Field(..., examples=["Mattuthavani Integrated FastPort"])
    zone: str = Field("", examples=["East Madurai / Melur Highway"])
    coords: List[float] = Field(..., min_length=2, max_length=2, description="[lng, lat]")
    plugs: int = Field(..., ge=1)
    occupied: int = Field(0, ge=0)
    queue: int = Field(0, ge=0)
    status: str = Field("optimal")
    power_kw: float = Field(150.0, ge=0)
    price_per_kwh: float = Field(16.0, ge=0)
    contact: str = Field("", examples=["+91 97896 16161"])
    address: str = Field("", examples=["JC Residency, Lady Doak College Road"])

    @property
    def available(self) -> int:
        return max(0, self.plugs - self.occupied)

    @property
    def utilization_pct(self) -> float:
        return round((self.occupied / max(self.plugs, 1)) * 100, 1)


# ── Driver ──

class Driver(BaseModel):
    """An active EV driver tracked in the grid."""
    id: str = Field(..., examples=["DRV-404"])
    name: str = Field(..., examples=["K. Murugan"])
    vehicle: str = Field("", examples=["Tata Nexon EV Max"])
    battery_kwh: float = Field(40.5, ge=0)
    soc: float = Field(24.0, ge=0, le=100, description="State of Charge %")
    target_station: str = Field("")
    reserved_slot: str = Field("", examples=["17:30"])
    eta_minutes: float = Field(0.0, ge=0)
    is_rerouted: bool = False
    anomaly_flagged: bool = False
    current_location: List[float] = Field(default_factory=lambda: [78.1198, 9.9195], min_length=2, max_length=2)
    origin_name: str = Field("")


# ── Metrics ──

class GridMetrics(BaseModel):
    """Aggregate KPI snapshot for the Madurai grid."""
    wait_time_cut: str = "44.6%"
    grid_utilization: str = "96.8%"
    dead_slots_prevented: int = 22
    total_energy_kwh: float = 34800.0
    co2_saved_kg: float = 2640.0
    active_hubs_count: int = 10
    active_evs_in_grid: int = 184


# ── Queue Metrics (M/D/c output) ──

class QueueMetrics(BaseModel):
    """Output of the M/D/c queueing model for a single station."""
    utilization_rho: float = 0.0
    expected_wait_mins: float = 0.0
    expected_queue_length: float = 0.0
    throughput_per_hour: float = 0.0
    system_state: str = "OPTIMAL"


# ── Anomaly Payloads ──

class AnomalyPayload(BaseModel):
    """Arterial anomaly detection alert broadcast to all clients."""
    type: str = "ANOMALY_ALERT"
    severity: str = "CRITICAL"
    corridor: str = ""
    speed_drop_percent: float = 0.0
    message: str = ""
    driver: Optional[Driver] = None
    stations: List[Station] = Field(default_factory=list)
    optimization: Optional[dict] = None


class SwapSuccessPayload(BaseModel):
    """Autonomous slot-swap success event."""
    type: str = "SWAP_SUCCESS"
    message: str = ""
    driver: Optional[Driver] = None
    promoted_driver: Optional[Driver] = None
    stations: List[Station] = Field(default_factory=list)
    metrics: Optional[GridMetrics] = None


class GridStatePayload(BaseModel):
    """Full grid snapshot for client hydration."""
    type: str = "GRID_STATE"
    region: str = "Madurai Metropolitan"
    stations: List[Station] = Field(default_factory=list)
    drivers: List[Driver] = Field(default_factory=list)
    metrics: Optional[GridMetrics] = None


# ── REST Request / Response ──

class RankedDock(BaseModel):
    """A single dock ranking entry from the optimizer."""
    rank: int = 0
    hub_id: str = ""
    name: str = ""
    zone: str = ""
    coords: List[float] = Field(default_factory=list)
    distance_km: float = 0.0
    travel_mins: float = 0.0
    available_plugs: int = 0
    queue_length: int = 0
    status: str = "optimal"
    power_kw: float = 150.0
    price_per_kwh: float = 16.0
    mdc_wait_mins: float = 0.0
    mdc_state: str = "OPTIMAL"
    energy_consumed_kwh: float = 0.0
    soc_after_percent: float = 0.0
    can_reach: bool = True
    total_cost_score: float = 0.0
    total_time_to_charge_mins: float = 0.0


class NearestDocksResponse(BaseModel):
    origin: List[float]
    ranked_docks: List[RankedDock]


class GridAnalyticsEntry(BaseModel):
    hub_id: str
    name: str
    zone: str
    total_capacity_kw: float
    active_draw_kw: float
    load_percent: float
    plugs: int
    occupied: int
    open_plugs: int
    queue: int
    status: str
    mdc_utilization_rho: float
    mdc_expected_wait_mins: float
