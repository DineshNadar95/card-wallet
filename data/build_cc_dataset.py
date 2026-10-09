"""
Build a RAG-ready US credit card dataset from the CFPB Terms of Credit Card Plans (TCCP) survey.

Usage (Mac):
    pip3 install pandas openpyxl requests
    python3 build_cc_dataset.py

Outputs:
    cards_raw.csv     - full table, one row per card
    cards_rag.jsonl   - one document per card: {"id", "text", "metadata"} for embedding

Note: column names are read from the file itself (not hard-coded), because they can
change between survey releases. Run once and check the printed column list.
"""

import io
import json
import re

import pandas as pd
import requests

# Latest release (Jul 1 - Dec 31, 2025), linked from:
# https://www.consumerfinance.gov/data-research/credit-card-data/terms-credit-card-plans-survey/
TCCP_URL = "https://files.consumerfinance.gov/f/documents/cfpb_tccp-data_2025-12-31.xlsx"

# Fields worth keeping as filterable metadata (matched case-insensitively if present)
METADATA_HINTS = [
    "institution name", "card name", "report date", "offering location",
    "secured card", "targeted credit tiers", "annual fee", "purchase apr min",
    "purchase apr max", "intro apr min", "foreign transaction fees?", "rewards",
]


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")


def main():
    print(f"Downloading {TCCP_URL} ...")
    resp = requests.get(TCCP_URL, timeout=120)
    resp.raise_for_status()

    # The workbook may have several sheets; pick the largest one as the data sheet.
    sheets = pd.read_excel(io.BytesIO(resp.content), sheet_name=None)
    name, df = max(sheets.items(), key=lambda kv: len(kv[1]))
    print(f"Using sheet '{name}': {len(df)} rows, {len(df.columns)} columns")
    print("Columns:", list(df.columns))

    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")
    df.to_csv("cards_raw.csv", index=False)

    lower_map = {c.lower(): c for c in df.columns}
    meta_cols = [lower_map[h] for h in METADATA_HINTS if h in lower_map]
    issuer_col = lower_map.get("institution name")
    card_col = lower_map.get("card name")

    with open("cards_rag.jsonl", "w") as f:
        for i, row in df.iterrows():
            # Turn every non-empty field into "Field: value" lines -> readable text for embeddings
            lines = [f"{col}: {val}" for col, val in row.items()
                     if pd.notna(val) and str(val).strip() != ""]
            issuer = row.get(issuer_col, "") if issuer_col else ""
            card = row.get(card_col, "") if card_col else ""
            doc = {
                "id": f"{slug(issuer)}--{slug(card)}--{i}",
                "text": f"Credit card: {card} issued by {issuer}\n" + "\n".join(lines),
                "metadata": {c: (None if pd.isna(row[c]) else str(row[c])) for c in meta_cols},
            }
            f.write(json.dumps(doc) + "\n")

    print(f"Wrote cards_raw.csv and cards_rag.jsonl ({len(df)} cards)")


if __name__ == "__main__":
    main()
