from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase Postgres connection string (use the pooler URL in production).
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:54322/postgres"
    # Comma-separated list of browser origins allowed to call the API.
    cors_origins: str = "http://localhost:5173"
    # Supabase project URL, e.g. https://abcd.supabase.co. Tokens are verified against its JWKS.
    supabase_url: str = ""
    # Only for projects still on the legacy HS256 shared secret. Server-side only.
    supabase_jwt_secret: str = ""
    # Photo reading (POST /me/offers/parse-image). Server-side only; never sent to clients.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"
    # Reminder emails (any SMTP provider). Email reminders are off until SMTP_HOST is set.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""
    # Optional: only needed if "enhanced push security" is on in your Expo account.
    expo_access_token: str = ""
    # Link included in reminder emails.
    web_app_url: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
