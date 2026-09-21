"""
Zeus OS — M/D/c Queueing Model
Predicts expected wait time, queue length, and throughput for EV charging stations.

Model:
  M  = Markovian (Poisson) arrivals with rate λ
  D  = Deterministic service time (fixed charging session length)
  c  = Number of parallel servers (charging plugs)

Key relationship:
  Wq(M/D/c) ≈ Wq(M/M/c) × (1 + Cs²) / 2
  For deterministic service Cs = 0, therefore Wq(M/D/c) ≈ Wq(M/M/c) / 2
"""

from __future__ import annotations

import math
from typing import Dict

from app.models.schemas import QueueMetrics


def _erlang_c_probability(servers: int, traffic_intensity: float) -> float:
    """
    Compute the Erlang-C probability P(wait > 0).

    Parameters
    ----------
    servers : int
        Number of parallel charging plugs (c).
    traffic_intensity : float
        Offered load a = λ / μ  (not ρ — divide by c to get ρ).

    Returns
    -------
    float
        Probability that an arriving EV must wait.
    """
    a = traffic_intensity
    c = servers

    if c <= 0 or a <= 0:
        return 0.0

    rho = a / c
    if rho >= 1.0:
        return 1.0

    # Poisson sum  Σ_{k=0}^{c-1}  a^k / k!
    poisson_sum = sum(a ** k / math.factorial(k) for k in range(c))

    # Last term:  a^c / c!  ×  1 / (1 - ρ)
    last_term = (a ** c / math.factorial(c)) * (1.0 / (1.0 - rho))

    denominator = poisson_sum + last_term
    return last_term / denominator if denominator > 0 else 0.0


def compute_mdc_metrics(
    arrival_rate_lambda: float,
    service_time_mins: float,
    servers_c: int,
) -> QueueMetrics:
    """
    Full M/D/c analysis for one station.

    Parameters
    ----------
    arrival_rate_lambda : float
        Mean arrival rate (EVs per minute).
    service_time_mins : float
        Fixed (deterministic) charging session duration in minutes.
    servers_c : int
        Number of charging plugs.

    Returns
    -------
    QueueMetrics
        Utilisation, wait time, queue length, throughput, system state.
    """
    if servers_c <= 0:
        return QueueMetrics(
            utilization_rho=1.0,
            expected_wait_mins=999.0,
            expected_queue_length=999.0,
            throughput_per_hour=0.0,
            system_state="OVERLOADED",
        )

    mu = 1.0 / max(service_time_mins, 0.01)          # service rate (per minute)
    rho = arrival_rate_lambda / (servers_c * mu)       # server utilisation

    throughput = round(servers_c * mu * 60, 1)         # EVs per hour at full capacity

    if rho >= 1.0:
        return QueueMetrics(
            utilization_rho=round(min(rho, 1.0), 4),
            expected_wait_mins=round(service_time_mins * 3, 1),
            expected_queue_length=float(servers_c * 2),
            throughput_per_hour=throughput,
            system_state="OVERLOADED",
        )

    # ── M/M/c expected wait ──
    a = arrival_rate_lambda / mu                       # offered load
    pc = _erlang_c_probability(servers_c, a)
    wq_mmc = pc / (servers_c * mu * (1.0 - rho))      # minutes

    # ── M/D/c correction (half the M/M/c wait) ──
    wq_mdc = wq_mmc * 0.5

    # ── Little's Law: Lq = λ × Wq ──
    lq = arrival_rate_lambda * wq_mdc

    # ── System state classification ──
    if rho < 0.55:
        state = "OPTIMAL"
    elif rho < 0.80:
        state = "MODERATE"
    elif rho < 1.0:
        state = "STRESSED"
    else:
        state = "OVERLOADED"

    return QueueMetrics(
        utilization_rho=round(rho, 4),
        expected_wait_mins=round(max(0.0, wq_mdc), 1),
        expected_queue_length=round(max(0.0, lq), 2),
        throughput_per_hour=throughput,
        system_state=state,
    )


def station_queue_snapshot(
    station_queue: int,
    station_plugs: int,
    service_time_mins: float = 22.0,
) -> QueueMetrics:
    """
    Convenience wrapper: estimate queue metrics from a station's live counters.

    Arrival rate is inferred from the observed queue depth:
        λ ≈ max(1.0, queue × 2.5)  EVs / hour  →  converted to per-minute
    """
    lambda_per_hour = max(1.0, station_queue * 2.5)
    lambda_per_min = lambda_per_hour / 60.0
    return compute_mdc_metrics(lambda_per_min, service_time_mins, station_plugs)
