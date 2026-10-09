"""The list of cards to refresh, from targets.yaml."""

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import yaml

DEFAULT_PATH = Path(__file__).resolve().parents[1] / "targets.yaml"

# Third-party sites we must never scrape (CLAUDE.md: issuer pages are the only source).
AGGREGATORS = {
    "nerdwallet.com",
    "thepointsguy.com",
    "creditkarma.com",
    "bankrate.com",
    "creditcards.com",
    "wallethub.com",
    "lendingtree.com",
    "upgradedpoints.com",
    "doctorofcredit.com",
    "forbes.com",
    "cnbc.com",
    "investopedia.com",
    "reddit.com",
    "money.com",
    "valuepenguin.com",
}


@dataclass(frozen=True)
class Target:
    issuer: str
    name: str
    url: str

    @property
    def host(self) -> str:
        return urlparse(self.url).hostname or ""


class TargetError(ValueError):
    pass


def _check(t: Target) -> None:
    u = urlparse(t.url)
    if u.scheme != "https" or not u.hostname:
        raise TargetError(f"{t.name}: URL must be https: {t.url}")
    host = u.hostname.lower()
    if any(host == a or host.endswith("." + a) for a in AGGREGATORS):
        raise TargetError(f"{t.name}: {host} is an aggregator, not the issuer")


def load_targets(path: Path = DEFAULT_PATH) -> list[Target]:
    data = yaml.safe_load(path.read_text()) or {}
    targets = [
        Target(issuer=c["issuer"], name=c["name"], url=c["url"]) for c in data.get("cards", [])
    ]
    seen: set[tuple[str, str]] = set()
    for t in targets:
        _check(t)
        if (t.issuer, t.name) in seen:
            raise TargetError(f"duplicate target: {t.issuer} / {t.name}")
        seen.add((t.issuer, t.name))
    return targets
