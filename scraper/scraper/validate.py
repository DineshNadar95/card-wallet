"""Checks every extracted rate before it can reach live data. Pure functions; no I/O.

A row passes only if it is complete, plausible, backed by a verbatim quote that really is on
the fetched page (and contains the rate), and doesn't jump unexplained versus the live value.
Anything else is flagged for the owner to review; flagged rows are never promoted.
"""

import re
import unicodedata
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from decimal import Decimal

CATEGORIES = {"dining", "groceries", "travel", "gas", "online", "other"}
UNITS = {"percent", "points", "miles"}
# Generous upper bounds: real card rates sit well inside these; anything beyond is a misread.
MAX_RATE = {"percent": Decimal("12"), "points": Decimal("20"), "miles": Decimal("20")}
MAX_ANNUAL_CAP = Decimal("1000000")
JUMP_FACTOR = Decimal("2")


@dataclass(frozen=True)
class Candidate:
    category: str
    rate: Decimal | None
    unit: str | None
    annual_cap: Decimal | None
    conditions: str | None
    evidence: str | None


@dataclass(frozen=True)
class Current:
    rate: Decimal
    unit: str


@dataclass
class Verdict:
    candidate: Candidate
    notes: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.notes


_QUOTES = str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'", "—": "-", "–": "-"})


def normalize(text: str) -> str:
    """Lowercase, unify quotes/dashes, drop ®/™/©, collapse whitespace (incl. nbsp)."""
    t = unicodedata.normalize("NFKC", text).translate(_QUOTES)
    t = re.sub(r"[®™©]", "", t)
    return re.sub(r"\s+", " ", t).strip().lower()


def _fmt(d: Decimal) -> str:
    return format(d.normalize(), "f")


def _rate_in_quote(rate: Decimal, quote: str) -> bool:
    # "3" matches "3x", "3%", "3 points"; "1.5" matches "1.5%"; don't let "3" match "30".
    pattern = rf"(?<![\d.]){re.escape(_fmt(rate))}(?!\d)"
    return re.search(pattern, quote) is not None


def validate(
    candidates: Sequence[Candidate], current: Mapping[str, Current], page_text: str
) -> list[Verdict]:
    page = normalize(page_text)
    counts = Counter(c.category for c in candidates)
    out: list[Verdict] = []

    for c in candidates:
        v = Verdict(c)
        if c.category not in CATEGORIES:
            v.notes.append(f"invalid category {c.category!r}")
        if counts[c.category] > 1:
            v.notes.append("category appears more than once")
        if c.unit not in UNITS:
            v.notes.append(f"invalid unit {c.unit!r}")
        if c.rate is None:
            v.notes.append("missing rate")
        elif c.unit in UNITS and not (Decimal(0) < c.rate <= MAX_RATE[c.unit]):
            v.notes.append(f"rate {_fmt(c.rate)} {c.unit} is outside the plausible range")
        if c.annual_cap is not None and not (Decimal(0) < c.annual_cap <= MAX_ANNUAL_CAP):
            v.notes.append("implausible annual cap")

        if not c.evidence or not c.evidence.strip():
            v.notes.append("no supporting quote")
        else:
            quote = normalize(c.evidence)
            if quote not in page:
                v.notes.append("quote not found on the page")
            elif c.rate is not None and not _rate_in_quote(c.rate, quote):
                v.notes.append(f"rate {_fmt(c.rate)} not in the quote")

        live = current.get(c.category)
        if live is not None and c.rate is not None and c.unit in UNITS:
            if live.unit != c.unit:
                v.notes.append(f"unit changed from {live.unit} to {c.unit}")
            elif c.rate > live.rate * JUMP_FACTOR:
                v.notes.append(
                    f"changed from {_fmt(live.rate)} to {_fmt(c.rate)} {c.unit} (more than 2x)"
                )
            elif c.rate * JUMP_FACTOR < live.rate:
                v.notes.append(
                    f"changed from {_fmt(live.rate)} to {_fmt(c.rate)} {c.unit} (less than half)"
                )
        out.append(v)
    return out


def missing_categories(
    candidates: Sequence[Candidate], current: Mapping[str, Current]
) -> list[str]:
    """Live categories the page no longer mentions. Reported to the owner; never auto-deleted."""
    found = {c.category for c in candidates}
    return sorted(set(current) - found)
