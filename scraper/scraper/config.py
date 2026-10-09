from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class ScraperSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"
    # Who gets flagged-row emails; also put in the bot's user agent as the contact.
    owner_email: str = ""
    # Seconds between requests to the same host (robots.txt Crawl-delay wins if longer).
    scraper_min_delay: float = 10.0


@lru_cache
def get_scraper_settings() -> ScraperSettings:
    return ScraperSettings()
