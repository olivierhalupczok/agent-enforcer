from fastapi import FastAPI
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


app = FastAPI(title="acme-api", version="0.1.0")


@app.get("/api/health")
def health() -> HealthResponse:
    return HealthResponse(status="ok")
