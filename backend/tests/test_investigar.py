"""
Testes do endpoint POST /api/investigar.
Mockam o banco, o AgenteConsolidador e o cache para não fazer chamadas reais à GroqCloud.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.agents.schemas import (
    ResultadoConsolidado, ResultadoAgente, TipoAgente,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_row(data: dict):
    row = MagicMock()
    row.__getitem__ = MagicMock(side_effect=lambda k: data[k])
    row.keys = MagicMock(return_value=list(data.keys()))
    return row


def _mock_db_municipio(nome: str = "São Paulo"):
    """Mock que responde corretamente para 2 execute_fetchall:
    1ª chamada: busca o município pelo código IBGE → retorna [{"nome": nome}]
    2ª chamada: busca indicadores → retorna [] (sem indicadores, mas não quebra)
    """
    db = AsyncMock()
    db.close = AsyncMock()

    # side_effect lista: primeira chamada retorna municipio, segunda retorna []
    db.execute_fetchall = AsyncMock(side_effect=[
        [_make_row({"nome": nome})],  # municipios query
        [],                            # indicadores query (vazio — sem dados, agentes usam fallback)
    ])
    return db


def _mock_db_vazio():
    db = AsyncMock()
    db.close = AsyncMock()
    db.execute_fetchall = AsyncMock(return_value=[])
    return db


def _resultado_consolidado(ibge: str = "3550308", pergunta: str = "oportunidades") -> ResultadoConsolidado:
    agente = ResultadoAgente(
        agente=TipoAgente.MARKET,
        municipio="São Paulo",
        codigo_ibge=ibge,
        constatacoes=["Boa cobertura 4G"],
        fontes=["ANATEL"],
    )
    return ResultadoConsolidado(
        municipio="São Paulo",
        codigo_ibge=ibge,
        pergunta=pergunta,
        mercado=agente,
        social=ResultadoAgente(
            agente=TipoAgente.SOCIAL,
            municipio="São Paulo",
            codigo_ibge=ibge,
            constatacoes=["IDHM elevado"],
            fontes=["PNUD"],
        ),
        sintese="Município com bom potencial.",
        conclusao="Recomenda-se análise mais aprofundada.",
        convergencias=["Alta urbanização"],
        divergencias=[],
        dados_insuficientes=[],
        fontes_consultadas=["ANATEL", "PNUD"],
        modelo_consolidador="test-model",
        tokens_totais=200,
    )


# ── Testes de sucesso ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_investigar_retorna_resultado_consolidado():
    """Fluxo completo mockado — deve retornar estrutura correta."""
    resultado = _resultado_consolidado()

    with patch("app.api.routes.investigar.get_db", return_value=_mock_db_municipio()):
        with patch("app.api.routes.investigar.AgenteConsolidador") as mock_cls:
            mock_consolidador = AsyncMock()
            mock_consolidador.investigar = AsyncMock(return_value=resultado)
            mock_cls.return_value = mock_consolidador

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post("/api/investigar", json={
                    "codigo_ibge": "3550308",
                    "pergunta": "oportunidades de conectividade",
                })

    assert resp.status_code == 200
    data = resp.json()
    assert data["municipio"] == "São Paulo"
    assert data["codigo_ibge"] == "3550308"
    assert "sintese" in data
    assert "mercado" in data
    assert "social" in data
    assert data["is_ia"] is True


@pytest.mark.asyncio
async def test_investigar_retorna_convergencias_e_divergencias():
    resultado = _resultado_consolidado()
    resultado.convergencias = ["Ponto A", "Ponto B"]
    resultado.divergencias = ["Tensão X"]

    with patch("app.api.routes.investigar.get_db", return_value=_mock_db_municipio()):
        with patch("app.api.routes.investigar.AgenteConsolidador") as mock_cls:
            mock_cls.return_value.investigar = AsyncMock(return_value=resultado)

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post("/api/investigar", json={
                    "codigo_ibge": "3550308",
                    "pergunta": "análise completa do município",
                })

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["convergencias"]) == 2
    assert len(data["divergencias"]) == 1


@pytest.mark.asyncio
async def test_investigar_passa_nome_correto_ao_consolidador():
    """Verifica que o nome do município vindo do banco é repassado ao agente."""
    resultado = _resultado_consolidado()

    with patch("app.api.routes.investigar.get_db", return_value=_mock_db_municipio("Campinas")):
        with patch("app.api.routes.investigar.AgenteConsolidador") as mock_cls:
            mock_inst = mock_cls.return_value
            mock_inst.investigar = AsyncMock(return_value=resultado)

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                await client.post("/api/investigar", json={
                    "codigo_ibge": "3509502",
                    "pergunta": "oportunidades",
                })

    mock_inst.investigar.assert_called_once_with(
        codigo_ibge="3509502",
        nome_municipio="Campinas",
        pergunta="oportunidades",
        contexto_mercado="Nenhum indicador mercado disponível para este município.",
        contexto_social="Nenhum indicador sociais disponível para este município.",
    )


# ── Testes de erro ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_investigar_404_municipio_nao_encontrado():
    with patch("app.api.routes.investigar.get_db", return_value=_mock_db_vazio()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/investigar", json={
                "codigo_ibge": "9999999",
                "pergunta": "oportunidades",
            })

    assert resp.status_code == 404
    assert "9999999" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_investigar_422_payload_invalido():
    """Pergunta ausente deve retornar 422 (Pydantic validation)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/investigar", json={
            "codigo_ibge": "3550308",
            # pergunta ausente
        })

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_investigar_422_codigo_ibge_ausente():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/investigar", json={
            "pergunta": "oportunidades sem municipio",
        })

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_investigar_metodo_get_nao_permitido():
    """POST é o único método aceito."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/investigar")

    assert resp.status_code == 405
