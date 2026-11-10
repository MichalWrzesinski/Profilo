from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings read from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    environment: Literal["local", "test", "staging", "production"] = "local"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    database_url: PostgresDsn
    valkey_url: RedisDsn
    dependency_timeout_seconds: float = 2.0
    public_base_url: str = "http://localhost:8080"

    # Authentication (docs/architecture.md#authentication)
    jwt_secret: SecretStr = Field(min_length=32)
    access_token_ttl_seconds: int = 15 * 60
    refresh_token_ttl_days: int = 30
    cookie_secure: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()  # values come from the environment
