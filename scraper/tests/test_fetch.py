import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx2
import pytest

from scraper.fetch import (
    USER_AGENT_PREFIX,
    HostClock,
    PoliteFetcher,
    RobotsCache,
    looks_blocked,
)

# ------------------------------------------------------------------ robots.txt


def robots_client(status=200, body="", seen=None):
    def handler(request: httpx2.Request) -> httpx2.Response:
        if seen is not None:
            seen.append(str(request.url))
            seen.append(request.headers.get("user-agent"))
        return httpx2.Response(status, text=body)

    return httpx2.AsyncClient(transport=httpx2.MockTransport(handler))


async def test_robots_disallow_is_respected():
    body = "User-agent: *\nDisallow: /private/\n"
    r = RobotsCache("CardWalletBot/0.1", client=robots_client(body=body))
    assert await r.allowed("https://bank.test/cards/a")
    assert not await r.allowed("https://bank.test/private/x")


async def test_robots_specific_to_our_bot():
    body = "User-agent: CardWalletBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n"
    r = RobotsCache("CardWalletBot/0.1 (+contact)", client=robots_client(body=body))
    assert not await r.allowed("https://bank.test/cards/a")


async def test_missing_robots_allows_but_forbidden_robots_blocks():
    assert await RobotsCache("CardWalletBot", client=robots_client(404)).allowed(
        "https://bank.test/a"
    )
    assert not await RobotsCache("CardWalletBot", client=robots_client(403)).allowed(
        "https://bank.test/a"
    )
    assert not await RobotsCache("CardWalletBot", client=robots_client(503)).allowed(
        "https://bank.test/a"
    )


async def test_robots_fetched_once_per_host_with_our_user_agent():
    seen: list = []
    r = RobotsCache("CardWalletBot/0.1", client=robots_client(body="", seen=seen))
    await r.allowed("https://bank.test/a")
    await r.allowed("https://bank.test/b")
    assert seen == ["https://bank.test/robots.txt", "CardWalletBot/0.1"]


async def test_crawl_delay_read_from_robots():
    r = RobotsCache("CardWalletBot", client=robots_client(body="User-agent: *\nCrawl-delay: 30\n"))
    await r.allowed("https://bank.test/a")
    assert r.crawl_delay("bank.test") == 30


# ------------------------------------------------------------------ rate limit


async def test_host_clock_spaces_requests_per_host():
    t = {"now": 100.0}
    slept: list[float] = []

    async def sleep(s):
        slept.append(s)
        t["now"] += s

    clock = HostClock(min_delay=10, now=lambda: t["now"], sleep=sleep)
    await clock.wait("a.test")
    await clock.wait("b.test")  # different host: no wait
    t["now"] += 3
    await clock.wait("a.test")
    assert slept == [7]
    await clock.wait("a.test", extra_delay=30)  # robots crawl-delay wins when longer
    assert slept == [7, 30]


# ------------------------------------------------------------------ block detection


@pytest.mark.parametrize(
    ("status", "text", "blocked"),
    [
        (200, "Earn 3X points on dining. " * 50, False),
        (403, "Forbidden", True),
        (429, "Too many requests", True),
        (200, "Please verify you are human to continue " + "x" * 600, True),
        (200, "Access Denied. Reference #18.abc " + "x" * 600, True),
        (200, "Our systems have detected unusual traffic " + "x" * 600, True),
        (200, "short", True),  # empty shell: likely an interstitial
    ],
)
def test_looks_blocked(status, text, blocked):
    assert (looks_blocked(status, text) is not None) is blocked


# ------------------------------------------------------------------ real browser (local server)


PAGES = {
    "/robots.txt": (200, "User-agent: *\nDisallow: /nope\n"),
    "/card": (
        200,
        "<html><body><h1>Demo Card A</h1><script>document.body.insertAdjacentHTML('beforeend',"
        "'<p>Earn 3X points on dining</p>')</script>"
        + "<p>Rewards details.</p>" * 40
        + "</body></html>",
    ),
    "/captcha": (
        200,
        "<html><body>Please verify you are human" + "<p>.</p>" * 200 + "</body></html>",
    ),
    "/nope": (200, "<html><body>secret</body></html>"),
}


@pytest.fixture(scope="module")
def site():
    seen_agents: list[str] = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            seen_agents.append(self.headers.get("User-Agent", ""))
            status, body = PAGES.get(self.path, (404, "not found"))
            self.send_response(status)
            self.send_header(
                "Content-Type", "text/plain" if self.path.endswith(".txt") else "text/html"
            )
            self.end_headers()
            self.wfile.write(body.encode())

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}", seen_agents
    server.shutdown()


@pytest.fixture
async def fetcher():
    f = PoliteFetcher(contact="owner@example.test", min_delay=0, allow_http=True)
    try:
        await f.start()
    except Exception as e:  # browser not installed in this environment
        pytest.skip(f"Playwright browser unavailable: {e}")
    yield f
    await f.close()


async def test_fetches_rendered_text_with_bot_user_agent(site, fetcher):
    base, agents = site
    res = await fetcher.fetch(f"{base}/card")
    assert res.status == "ok", res.reason
    assert "Earn 3X points on dining" in res.text  # JS-rendered content included
    assert all(a.startswith(USER_AGENT_PREFIX) for a in agents)


async def test_robots_disallow_skips_without_loading_page(site, fetcher):
    base, _ = site
    res = await fetcher.fetch(f"{base}/nope")
    assert res.status == "blocked"
    assert res.reason == "disallowed by robots.txt"
    assert res.text is None


async def test_captcha_page_is_skipped(site, fetcher):
    base, _ = site
    res = await fetcher.fetch(f"{base}/captcha")
    assert res.status == "blocked" and "human" in res.reason


async def test_plain_http_refused_in_production():
    f = PoliteFetcher(contact="owner@example.test")
    res = await f.fetch("http://bank.test/card")
    assert res.status == "error" and "https" in res.reason
