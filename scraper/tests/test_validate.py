from decimal import Decimal as D

import pytest

from scraper.validate import Candidate, Current, missing_categories, normalize, validate

PAGE = """
Demo Card A  Earn 3X points on dining, including eligible delivery services.
Earn 6% cash back at U.S. supermarkets on up to $6,000 per year in purchases (then 1%).
2X points on travel®. 1X point on all other purchases.
"""


def cand(category="dining", rate="3", unit="points", evidence="Earn 3X points on dining", **kw):
    return Candidate(
        category=category,
        rate=None if rate is None else D(rate),
        unit=unit,
        annual_cap=kw.get("annual_cap"),
        conditions=kw.get("conditions"),
        evidence=evidence,
    )


def run(cands, current=None, page=PAGE):
    return validate(cands, current or {}, page)


def test_good_row_passes():
    (v,) = run([cand()])
    assert v.ok and v.notes == []


def test_normalize_handles_whitespace_case_and_symbols():
    assert normalize("  Earn 3X   Points®\n on dining ") == "earn 3x points on dining"
    assert normalize("“Quoted” ‘text’ — dash") == "\"quoted\" 'text' - dash"


def test_evidence_must_be_on_the_page():
    (v,) = run([cand(evidence="Earn 5X points on dining")])
    assert not v.ok
    assert "quote not found on the page" in v.notes


def test_evidence_matching_is_whitespace_and_case_insensitive():
    (v,) = run([cand(evidence="earn 3x   POINTS on dining")])
    assert v.ok


def test_evidence_required():
    (v,) = run([cand(evidence=None)])
    assert not v.ok and "no supporting quote" in v.notes


def test_rate_must_appear_in_the_quote():
    (v,) = run([cand(rate="4", evidence="Earn 3X points on dining")])
    assert not v.ok
    assert "rate 4 not in the quote" in v.notes


def test_decimal_rates_match_quote():
    page = "Earn 1.5% cash back on every purchase"
    (v,) = run([cand(category="other", rate="1.50", unit="percent", evidence=page)], page=page)
    assert v.ok


@pytest.mark.parametrize(
    ("rate", "unit", "ok"),
    [
        ("6", "percent", True),
        ("12", "percent", True),
        ("13", "percent", False),
        ("0", "percent", False),
        ("20", "points", True),
        ("25", "miles", False),
        ("-1", "points", False),
    ],
)
def test_plausible_bounds(rate, unit, ok):
    page = f"Earn {rate} back"
    (v,) = run([cand(rate=rate, unit=unit, evidence=page)], page=page)
    assert v.ok is ok
    if not ok:
        assert any("outside the plausible range" in n for n in v.notes)


def test_required_fields():
    (a,) = run([cand(rate=None)])
    assert not a.ok and "missing rate" in a.notes
    (b,) = run([cand(unit="cashback")])
    assert not b.ok and "invalid unit 'cashback'" in b.notes
    (c,) = run([cand(category="furniture")])
    assert not c.ok and "invalid category 'furniture'" in c.notes


def test_annual_cap_bounds():
    (v,) = run(
        [
            cand(
                category="groceries",
                rate="6",
                unit="percent",
                evidence="Earn 6% cash back at U.S. supermarkets",
                annual_cap=D("-5"),
            )
        ]
    )
    assert not v.ok and "implausible annual cap" in v.notes


def test_duplicate_categories_are_all_flagged():
    vs = run(
        [cand(), cand(evidence="Earn 3X points on dining, including eligible delivery services")]
    )
    assert [v.ok for v in vs] == [False, False]
    assert all("category appears more than once" in v.notes for v in vs)


def test_more_than_double_the_current_value_is_flagged():
    current = {"dining": Current(rate=D("1"), unit="points")}
    (v,) = run([cand()], current)  # 3x vs 1x
    assert not v.ok
    assert "changed from 1 to 3 points (more than 2x)" in v.notes


def test_halving_is_flagged_too():
    current = {"dining": Current(rate=D("8"), unit="points")}
    (v,) = run([cand()], current)
    assert not v.ok and "changed from 8 to 3 points (less than half)" in v.notes


def test_small_changes_pass_and_exactly_double_passes():
    (a,) = run([cand()], {"dining": Current(rate=D("2"), unit="points")})
    assert a.ok
    (b,) = run([cand()], {"dining": Current(rate=D("1.5"), unit="points")})
    assert b.ok  # exactly 2x is not "more than 2x"


def test_unit_change_is_flagged():
    (v,) = run([cand()], {"dining": Current(rate=D("3"), unit="percent")})
    assert not v.ok and "unit changed from percent to points" in v.notes


def test_missing_categories_reported():
    current = {"dining": Current(D("3"), "points"), "gas": Current(D("2"), "points")}
    assert missing_categories([cand()], current) == ["gas"]
