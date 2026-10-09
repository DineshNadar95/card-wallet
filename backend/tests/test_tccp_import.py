from datetime import date
from decimal import Decimal

import pytest
from openpyxl import Workbook
from sqlalchemy import select

from app.catalog.tccp import import_cards, parse_tccp, source_label
from app.db.models import Card

HEADERS = [
    None,
    "Institution Name",
    "Product Name",
    "Report Date",
    "Availability of Credit Card Plan",
    "Secured Card",
    "Targeted Credit Tiers",
    "Purchase APR min",
    "Purchase APR max",
    "Advance APR min",
    "Advance APR max",
    "Periodic Fee Type",
    "Annual Fee",
    "Monthly Fee",
    "Foreign Transaction Fees?",
    "Foreign Transaction Fee (%)",
    "Late Fees?",
    "Late Fee ($)",
    "Rewards",
    "Website for Consumer",
]


def _row(**kw):
    base = {
        "Institution Name": "Demo Bank",
        "Product Name": "Demo Card A",
        "Report Date": "2025-12-31",
        "Availability of Credit Card Plan": "National",
        "Secured Card": "No",
        "Targeted Credit Tiers": "Credit score of 720 or greater",
        "Purchase APR min": 0.199,
        "Purchase APR max": 0.2899,
        "Advance APR min": 0.2999,
        "Advance APR max": 0.2999,
        "Periodic Fee Type": None,
        "Annual Fee": None,
        "Monthly Fee": None,
        "Foreign Transaction Fees?": "No",
        "Foreign Transaction Fee (%)": None,
        "Late Fees?": "Yes",
        "Late Fee ($)": 40,
        "Rewards": "Cashback rewards; Travel-related rewards",
        "Website for Consumer": "https://demo-bank.test/cards",
    }
    base.update(kw)
    return [None] + [base.get(h) for h in HEADERS[1:]]


def _workbook(tmp_path, rows):
    """Mimic the real file: title block, blank rows, header on row 10, data after."""
    wb = Workbook()
    ws = wb.active
    ws.title = "TCCP Survey"
    ws.append([])
    ws.append([None, "Terms of Credit Card Plans survey results"])
    ws.append([None, "Collected by the Consumer Financial Protection Bureau"])
    for _ in range(6):
        ws.append([])
    ws.append(HEADERS)
    for r in rows:
        ws.append(r)
    path = tmp_path / "tccp.xlsx"
    wb.save(path)
    return path


def test_finds_header_row_below_title_block(tmp_path):
    rows, skipped = parse_tccp(_workbook(tmp_path, [_row()]))
    assert skipped == 0
    assert [(r["issuer"], r["name"]) for r in rows] == [("Demo Bank", "Demo Card A")]


def test_converts_fractions_to_percent_and_reads_fees(tmp_path):
    (r,), _ = parse_tccp(_workbook(tmp_path, [_row()]))
    assert r["purchase_apr_min"] == Decimal("19.900")
    assert r["purchase_apr_max"] == Decimal("28.990")
    assert r["cash_advance_apr_min"] == Decimal("29.990")
    assert r["fx_fee"] == Decimal("0")  # "Foreign Transaction Fees?" = No
    assert r["annual_fee"] == Decimal("0")  # no periodic fee reported
    assert r["late_fee"] == Decimal("40")
    assert r["secured"] is False
    assert r["as_of"] == date(2025, 12, 31)
    assert r["rewards_types"] == "Cashback rewards; Travel-related rewards"


@pytest.mark.parametrize(
    ("kw", "expected"),
    [
        ({"Periodic Fee Type": "Annual", "Annual Fee": 95}, Decimal("95")),
        ({"Periodic Fee Type": "Monthly", "Monthly Fee": 8.25}, Decimal("99.00")),
        ({"Periodic Fee Type": "Other"}, None),  # fee exists but amount unknown
    ],
)
def test_annual_fee_variants(tmp_path, kw, expected):
    (r,), _ = parse_tccp(_workbook(tmp_path, [_row(**kw)]))
    assert r["annual_fee"] == expected


def test_fx_fee_when_charged(tmp_path):
    rows = [
        _row(**{"Foreign Transaction Fees?": "Yes", "Foreign Transaction Fee (%)": 0.03}),
        _row(**{"Product Name": "Demo Card B", "Foreign Transaction Fees?": "Yes"}),
    ]
    (a, b), _ = parse_tccp(_workbook(tmp_path, rows))
    assert a["fx_fee"] == Decimal("3.000")
    assert b["fx_fee"] is None  # charged, but no % reported: unknown, not zero


def test_network_inferred_only_when_named(tmp_path):
    rows = [
        _row(**{"Product Name": "Demo Platinum Visa"}),
        _row(**{"Product Name": "Demo World Mastercard"}),
        _row(**{"Product Name": "Demo Rewards"}),
    ]
    got, _ = parse_tccp(_workbook(tmp_path, rows))
    assert [r["network"] for r in got] == ["Visa", "Mastercard", None]


def test_skips_blank_and_duplicate_rows(tmp_path):
    rows = [
        _row(),
        _row(),
        _row(**{"Product Name": None}),
        _row(**{"Product Name": "  Demo Card B "}),
    ]
    got, skipped = parse_tccp(_workbook(tmp_path, rows))
    assert [r["name"] for r in got] == ["Demo Card A", "Demo Card B"]
    assert skipped == 2


def test_source_label_from_report_date():
    assert source_label(date(2025, 12, 31)) == "CFPB TCCP Jul–Dec 2025"
    assert source_label(date(2026, 6, 30)) == "CFPB TCCP Jan–Jun 2026"


def test_import_is_idempotent_and_updates(tmp_path, db):
    path = _workbook(tmp_path, [_row(), _row(**{"Product Name": "Demo Card B"})])
    rows, _ = parse_tccp(path)
    assert import_cards(db, rows, source_url="https://example.test/tccp.xlsx") == (2, 0)
    assert import_cards(db, rows, source_url="https://example.test/tccp.xlsx") == (0, 2)

    rows[0]["late_fee"] = Decimal("41")
    import_cards(db, rows, source_url="https://example.test/tccp.xlsx")
    card = db.scalars(select(Card).where(Card.name == "Demo Card A")).one()
    assert card.late_fee == Decimal("41")
    assert card.source == "CFPB TCCP Jul–Dec 2025"
    assert card.source_url == "https://example.test/tccp.xlsx"
    assert db.query(Card).count() == 2
