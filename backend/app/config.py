from functools import lru_cache
from pathlib import Path

from dotenv import dotenv_values, load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = PROJECT_ROOT / "backend" / ".env"
load_dotenv(ENV_FILE)


def _legacy_debug_default() -> bool:
    """Read the old project-local setting without consuming a shell's DEBUG."""
    legacy = dotenv_values(ENV_FILE).get("DEBUG")
    if isinstance(legacy, str):
        value = legacy.strip().lower()
        if value in {"0", "false", "off", "no", "n", "f"}:
            return False
        if value in {"1", "true", "on", "yes", "y", "t"}:
            return True
    return True


class Settings(BaseSettings):
    app_name: str = "Ferrum"
    app_env: str = "development"
    debug: bool = Field(default_factory=_legacy_debug_default, validation_alias="FERRUM_DEBUG")
    api_prefix: str = "/api/v1"
    gemini_api_key: str | None = None
    serpapi_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    intelligence_search_cache_seconds: int = 21600
    intelligence_search_result_limit: int = 8
    intelligence_provider_timeout_seconds: float = 20.0
    intelligence_synthesis_timeout_seconds: float = 65.0

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
