from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from pydantic import BaseModel

from app.config import get_settings
from app.routers import catalog, me, offers


def _operation_id(route: APIRoute) -> str:
    # Use the function name as the OpenAPI operationId so the generated TS client
    # gets readable, stable names (e.g. `health`, `listMyCards`).
    return route.name


app = FastAPI(
    title="Card Wallet API",
    version="0.1.0",
    generate_unique_id_function=_operation_id,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Health(BaseModel):
    status: str
    version: str


@app.get("/health", response_model=Health, tags=["meta"])
def health() -> Health:
    return Health(status="ok", version=app.version)


app.include_router(catalog.router)
app.include_router(me.router)
app.include_router(offers.router)
