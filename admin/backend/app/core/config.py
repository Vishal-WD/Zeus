"""
Zeus OS — Application Configuration
Loads environment variables via pydantic-settings and exposes a singleton Settings instance.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Centralised runtime configuration sourced from .env or environment variables."""

    # ── Application identity ──
    APP_NAME: str = "Zeus Central Core Engine"
    APP_VERSION: str = "2.0.0"
    REGION: str = "Madurai Metropolitan"

    # ── Network ──
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: str = "*"

    # ── External keys ──
    GEMINI_API_KEY: str = ""

    # ── Simulation tuning ──
    WS_HEARTBEAT_SEC: int = 30
    DEFAULT_SERVICE_TIME_MINS: float = 22.0
    URBAN_SPEED_KMH: float = 22.0
    BOTTLENECK_SPEED_KMH: float = 8.0
    ROAD_WINDING_FACTOR: float = 1.35

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    """Return a cached Settings singleton."""
    return Settings()
