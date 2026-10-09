from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "version": app.version}


def test_health_is_in_openapi_schema():
    schema = client.get("/openapi.json").json()
    assert "/health" in schema["paths"]
    # The shared TS client is generated from this schema; keep operation ids stable.
    assert schema["paths"]["/health"]["get"]["operationId"] == "health"


def test_cors_allows_configured_web_origin():
    res = client.options(
        "/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
