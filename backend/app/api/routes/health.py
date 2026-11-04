from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timezone

router = APIRouter(tags=["saúde"])


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    versao: str


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Verifica se a API está operacional."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
        versao="0.1.0",
    )
