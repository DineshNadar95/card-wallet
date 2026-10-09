"""Write the API's OpenAPI schema to packages/shared/openapi.json.

Run from backend/: `uv run python scripts/export_openapi.py`
(or `npm run gen:api` from the repo root, which also regenerates the TS types).
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402

out = Path(__file__).resolve().parents[2] / "packages" / "shared" / "openapi.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(app.openapi(), indent=2) + "\n")
print(f"Wrote {out}")
