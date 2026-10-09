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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
