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

    # Transactional e-mail (notifications module): Mailpit locally, Brevo on servers.
    smtp_host: str = "mailpit"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_starttls: bool = False
    smtp_timeout_seconds: float = 10.0
    mail_from: str = "Profilo <no-reply@profilo.pl>"

    # User images (media module): an fsspec URL; a volume on servers, memory:// in tests.
    media_url: str = "file:///data/media"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # values come from the environment
