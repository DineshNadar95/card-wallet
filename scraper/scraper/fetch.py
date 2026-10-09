"""Polite page fetching with a headless browser (many issuer pages render with JS).

Rules (CLAUDE.md): respect robots.txt, rate-limit, identify the bot, and never bypass
CAPTCHAs, logins or anti-bot protection. A blocked page is logged and skipped; there are no
retries, stealth plugins, or alternate user agents.
"""

import asyncio
import logging
import time
import urllib.robotparser
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal, Protocol
from urllib.parse import urlparse

import httpx2

log = logging.getLogger(__name__)

USER_AGENT_PREFIX = "CardWalletBot/0.1"
MIN_TEXT_CHARS = 500  # a real product page has far more; less usually means an interstitial
MAX_TEXT_CHARS = 400_000  # sanity bound; bigger pages are flagged, never silently truncated

# Signs of a bot wall or login wall. If we see one we stop, we don't try to get around it.
_BLOCK_MARKERS = [
    "verify you are human",
    "are you a robot",
    "captcha",
    "unusual traffic",
    "access denied",
    "request unsuccessful",
    "please enable cookies and javascript",
    "pardon our interruption",
    "sign in to continue",
]
_BLOCK_STATUSES = {401, 403, 407, 429, 503}


@dataclass(frozen=True)
class FetchResult:
    url: str
    status: Literal["ok", "blocked", "error"]
    text: str | None = None
    reason: str | None = None
    http_status: int | None = None


class Fetcher(Protocol):
    async def fetch(self, url: str) -> FetchResult: ...


def looks_blocked(http_status: int | None, text: str) -> str | None:
    if http_status in _BLOCK_STATUSES:
        return f"HTTP {http_status}"
    lower = text.lower()
    for marker in _BLOCK_MARKERS:
        if marker in lower:
            return f"page says '{marker}'"
    if len(text.strip()) < MIN_TEXT_CHARS:
        return "page has almost no text (interstitial?)"
    return None


class RobotsCache:
    """robots.txt per host, fetched once per run with our user agent."""

    def __init__(self, user_agent: str, client: httpx2.AsyncClient | None = None):
        self.user_agent = user_agent
        self.client = client or httpx2.AsyncClient(timeout=20, follow_redirects=True)
        self._parsers: dict[str, urllib.robotparser.RobotFileParser] = {}

    async def _parser(self, url: str) -> urllib.robotparser.RobotFileParser:
        u = urlparse(url)
        key = f"{u.scheme}://{u.netloc}"
        if key not in self._parsers:
            rp = urllib.robotparser.RobotFileParser()
            try:
                res = await self.client.get(
                    f"{key}/robots.txt", headers={"User-Agent": self.user_agent}
                )
                status = res.status_code
            except httpx2.HTTPError as e:
                log.warning("robots.txt unreachable for %s: %s", key, e)
                status = 503
            if status in (401, 403) or status >= 500:
                rp.disallow_all = True  # can't confirm we're welcome: stay out
            elif status >= 400:
                rp.allow_all = True  # no robots.txt: crawling allowed
            else:
                rp.parse(res.text.splitlines())
            self._parsers[key] = rp
            self._parsers[u.netloc] = rp
        return self._parsers[key]

    async def allowed(self, url: str) -> bool:
        return (await self._parser(url)).can_fetch(self.user_agent, url)

    def crawl_delay(self, host: str) -> float | None:
        rp = self._parsers.get(host)
        delay = rp.crawl_delay(self.user_agent) if rp else None
        return float(delay) if delay is not None else None


class HostClock:
    """At least `min_delay` seconds between requests to the same host."""

    def __init__(
        self,
        min_delay: float,
        now: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ):
        self.min_delay, self.now, self.sleep = min_delay, now, sleep
        self._last: dict[str, float] = {}

    async def wait(self, host: str, extra_delay: float | None = None) -> None:
        delay = max(self.min_delay, extra_delay or 0)
        last = self._last.get(host)
        if last is not None:
            remaining = delay - (self.now() - last)
            if remaining > 0:
                await self.sleep(remaining)
        self._last[host] = self.now()


class PoliteFetcher:
    def __init__(self, contact: str, min_delay: float = 10.0, allow_http: bool = False):
        self.user_agent = f"{USER_AGENT_PREFIX} (+card-wallet rewards refresh; contact: {contact})"
        self.robots = RobotsCache(self.user_agent)
        self.clock = HostClock(min_delay)
        self.allow_http = allow_http  # tests only
        self._pw = None
        self._browser = None
        self._context = None

    async def start(self) -> None:
        from playwright.async_api import async_playwright

        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(headless=True)
        self._context = await self._browser.new_context(
            user_agent=self.user_agent,
            java_script_enabled=True,
            locale="en-US",
        )

    async def close(self) -> None:
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.stop()
        await self.robots.client.aclose()

    async def fetch(self, url: str) -> FetchResult:
        u = urlparse(url)
        if u.scheme != "https" and not self.allow_http:
            return FetchResult(url, "error", reason="only https URLs are fetched")
        if not await self.robots.allowed(url):
            log.info("robots.txt disallows %s; skipping", url)
            return FetchResult(url, "blocked", reason="disallowed by robots.txt")
        if self._context is None:
            return FetchResult(url, "error", reason="fetcher not started")

        await self.clock.wait(u.netloc, self.robots.crawl_delay(u.netloc))
        page = await self._context.new_page()
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            try:
                await page.wait_for_load_state("networkidle", timeout=15_000)
            except Exception:
                pass  # some pages poll forever; the DOM is already there
            status = response.status if response else None
            text = await page.inner_text("body")
        except Exception as e:
            log.warning("fetch failed for %s: %s", url, e)
            return FetchResult(url, "error", reason=f"{type(e).__name__}: {e}"[:300])
        finally:
            await page.close()

        if reason := looks_blocked(status, text):
            log.info("blocked at %s (%s); skipping, not retrying", url, reason)
            return FetchResult(url, "blocked", reason=reason, http_status=status)
        if status is not None and status >= 400:
            return FetchResult(url, "error", reason=f"HTTP {status}", http_status=status)
        if len(text) > MAX_TEXT_CHARS:
            return FetchResult(
                url, "error", reason=f"page text too large ({len(text)} chars)", http_status=status
            )
        return FetchResult(url, "ok", text=text, http_status=status)
