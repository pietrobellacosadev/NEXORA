"""
Testes do endpoint GET /api/municipios/{codigo_ibge}/perfil.
Cobrem retorno de indicadores dos dois pilares, 404 e estrutura da resposta.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_row(data: dict):
    row = MagicMock()
    row.__iter__ = MagicMock(return_value=iter(data.items()))
    row.keys = MagicMock(return_value=list(data.keys()))
    row.__getitem__ = MagicMock(side_effect=lambda k: data[k])
    row._mapping = data
    return row


_MUNICIPIO_SP = {
    "codigo_ibge": "3550308",
    "nome": "São Paulo",
    "regiao_administrativa": "Metropolitana",
    "mesorregiao": "Metropolitana de São Paulo",
    "microrregiao": "São Paulo",
    "populacao_estimada": 11_451_245,
}

_INDICADORES_MOCK = [
    {
        "chave": "densidade_movel",
        "nome": "Densidade de acessos móveis",
        "valor_num": 107.66,
        "valor_txt": None,
        "unidade": "acessos/100 hab",
        "fonte": "ANATEL",
        "periodo": "2023",
        "tipo": "oficial",
        "limitacoes": None,
        "categoria": "mercado",
    },
    {
        "chave": "cobertura_4g",
        "nome": "Cobertura de rede 4G",
        "valor_num": 87.39,
        "valor_txt": None,
        "unidade": "% da área urbana",
        "fonte": "ANATEL / Teleco",
        "periodo": "2023",
        "tipo": "oficial",
        "limitacoes": None,
        "categoria": "mercado",
    },
    {
        "chave": "idhm",
        "nome": "IDHM",
        "valor_num": 0.77,
        "valor_txt": None,
        "unidade": "índice (0–1)",
        "fonte": "PNUD / IBGE",
        "periodo": "2021",
        "tipo": "oficial",
        "limitacoes": None,
        "categoria": "social",
    },
    {
        "chave": "taxa_alfabetizacao",
        "nome": "Taxa de alfabetização",
        "valor_num": 95.4,
        "valor_txt": None,
        "unidade": "%",
        "fonte": "IBGE / Censo 2022",
        "periodo": "2022",
        "tipo": "oficial",
        "limitacoes": None,
        "categoria": "social",
    },
]


def _mock_db_perfil(municipio_rows=None, indicador_rows=None):
    db = AsyncMock()
    db.close = AsyncMock()

    muni_rows = [_make_row(municipio_rows or [_MUNICIPIO_SP][0])]
    ind_rows   = [_make_row(r) for r in (indicador_rows or _INDICADORES_MOCK)]

    # execute_fetchall chamado 2x: primeiro para municipio, depois para indicadores
    db.execute_fetchall = AsyncMock(side_effect=[muni_rows, ind_rows])
    return db


def _mock_db_vazio():
    db = AsyncMock()
    db.close = AsyncMock()
    db.execute_fetchall = AsyncMock(return_value=[])
    return db


# ── Testes de sucesso ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_perfil_retorna_municipio_e_indicadores():
    with patch("app.api.routes.municipios.get_db", return_value=_mock_db_perfil()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/municipios/3550308/perfil")

    assert resp.status_code == 200
    data = resp.json()
    assert "municipio" in data
    assert "mercado" in data
    assert "social" in data
    assert data["municipio"]["codigo_ibge"] == "3550308"
    assert data["municipio"]["nome"] == "São Paulo"


@pytest.mark.asyncio
async def test_perfil_separa_indicadores_por_categoria():
    with patch("app.api.routes.municipios.get_db", return_value=_mock_db_perfil()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/municipios/3550308/perfil")

    data = resp.json()
    assert len(data["mercado"]) == 2   # densidade_movel + cobertura_4g
    assert len(data["social"]) == 2    # idhm + taxa_alfabetizacao


@pytest.mark.asyncio
async def test_perfil_indicador_contem_campos_obrigatorios():
    with patch("app.api.routes.municipios.get_db", return_value=_mock_db_perfil()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/municipios/3550308/perfil")

    ind = resp.json()["mercado"][0]
    for campo in ("chave", "nome", "valor_num", "valor_txt", "unidade", "fonte", "periodo", "tipo"):
        assert campo in ind, f"Campo '{campo}' ausente no indicador"


@pytest.mark.asyncio
async def test_perfil_municipio_sem_indicadores_retorna_listas_vazias():
    """Município sem indicadores ainda deve retornar estrutura válida."""
    db = AsyncMock()
    db.close = AsyncMock()
    db.execute_fetchall = AsyncMock(side_effect=[
        [_make_row(_MUNICIPIO_SP)],  # municipio encontrado
        [],                           # sem indicadores
    ])
    with patch("app.api.routes.municipios.get_db", return_value=db):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/municipios/3550308/perfil")

    assert resp.status_code == 200
    assert resp.json()["mercado"] == []
    assert resp.json()["social"] == []


@pytest.mark.asyncio
async def test_perfil_retorna_populacao_e_regioes():
    with patch("app.api.routes.municipios.get_db", return_value=_mock_db_perfil()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/municipios/3550308/perfil")

    muni = resp.json()["municipio"]
    assert muni["populacao_estimada"] == 11_451_245
    assert muni["mesorregiao"] == "Metropolitana de São Paulo"
    assert muni["microrregiao"] == "São Paulo"


# ── Testes de erro ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_perfil_404_municipio_inexistente():
    with patch("app.api.routes.municipios.get_db", return_value=_mock_db_vazio()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/municipios/9999999/perfil")

    assert resp.status_code == 404
    assert "9999999" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_perfil_nao_inclui_campo_categoria_na_resposta():
    """O campo 'categoria' é interno e não deve aparecer no payload da API."""
    with patch("app.api.routes.municipios.get_db", return_value=_mock_db_perfil()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/municipios/3550308/perfil")

    for ind in resp.json()["mercado"] + resp.json()["social"]:
        assert "categoria" not in ind
