"""
Testes dos endpoints de municípios.
Usam banco SQLite em memória para não depender do banco de produção.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport

from app.main import app


def _make_row(data: dict):
    """Cria um objeto que se comporta como aiosqlite.Row."""
    row = MagicMock()
    row.__iter__ = MagicMock(return_value=iter(data.items()))
    row.keys = MagicMock(return_value=list(data.keys()))
    row.__getitem__ = MagicMock(side_effect=lambda k: data[k])
    # Suporte a dict(row)
    row._mapping = data
    return row


def _mock_db(rows=None, count=0):
    db = AsyncMock()
    db.__aenter__ = AsyncMock(return_value=db)
    db.__aexit__ = AsyncMock(return_value=False)
    db.close = AsyncMock()

    mock_rows = [_make_row(r) for r in (rows or [])]
    db.execute_fetchall = AsyncMock(return_value=mock_rows)

    count_cursor = AsyncMock()
    count_cursor.fetchone = AsyncMock(return_value=(count,))
    db.execute = AsyncMock(return_value=count_cursor)
    return db


@pytest.mark.asyncio
async def test_listar_municipios_retorna_lista():
    municipios_mock = [
        {"codigo_ibge": "3550308", "nome": "São Paulo", "regiao_administrativa": "Metropolitana",
         "mesorregiao": "Metropolitana de São Paulo", "microrregiao": "São Paulo",
         "populacao_estimada": 12325232},
        {"codigo_ibge": "3509502", "nome": "Campinas", "regiao_administrativa": "Campinas",
         "mesorregiao": "Campinas", "microrregiao": "Campinas",
         "populacao_estimada": 1213792},
    ]

    with patch("app.api.routes.municipios.get_db", return_value=_mock_db(municipios_mock, 2)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/municipios?limite=20")

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["municipios"]) == 2
    assert data["municipios"][0]["nome"] == "São Paulo"


@pytest.mark.asyncio
async def test_obter_municipio_existente():
    municipio_mock = [
        {"codigo_ibge": "3550308", "nome": "São Paulo", "regiao_administrativa": "Metropolitana",
         "mesorregiao": "Metropolitana de São Paulo", "microrregiao": "São Paulo",
         "populacao_estimada": 12325232}
    ]

    with patch("app.api.routes.municipios.get_db", return_value=_mock_db(municipio_mock)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/municipios/3550308")

    assert resp.status_code == 200
    assert resp.json()["codigo_ibge"] == "3550308"


@pytest.mark.asyncio
async def test_obter_municipio_nao_encontrado():
    with patch("app.api.routes.municipios.get_db", return_value=_mock_db([], 0)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/municipios/9999999")

    assert resp.status_code == 404
