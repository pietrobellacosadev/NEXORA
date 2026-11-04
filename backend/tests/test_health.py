import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data
    assert "versao" in data


@pytest.mark.asyncio
async def test_listar_municipios_vazio():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/municipios")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["municipios"] == []


@pytest.mark.asyncio
async def test_municipio_nao_encontrado():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/municipios/9999999")
    assert response.status_code == 404
