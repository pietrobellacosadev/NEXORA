"""
Testes da configuração e do cliente GroqCloud.
Não fazem chamadas reais à API — usam mocks para preservar créditos.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport

from app.config import Settings
from app.services.groq_client import GroqClient, GroqError
from app.main import app


# ── Testes de configuração ────────────────────────────────────────────────────

class TestConfigPrioridade:
    def test_chave_especifica_tem_prioridade(self):
        s = Settings(
            groq_api_key="shared-key",
            groq_api_key_market="market-key",
        )
        assert s.groq_key_for("market") == "market-key"

    def test_fallback_para_chave_compartilhada(self):
        s = Settings(
            groq_api_key="shared-key",
            groq_api_key_social="",
        )
        assert s.groq_key_for("social") == "shared-key"

    def test_erro_sem_nenhuma_chave(self):
        s = Settings(groq_api_key="", groq_api_key_market="")
        with pytest.raises(ValueError, match="market"):
            s.groq_key_for("market")

    def test_modelo_por_agente(self):
        s = Settings()
        assert s.groq_model_for("market") == "llama-3.1-8b-instant"
        assert s.groq_model_for("social") == "llama-3.1-8b-instant"
        assert s.groq_model_for("consolidator") == "llama-3.3-70b-versatile"


# ── Testes do cliente (mockado) ───────────────────────────────────────────────

class TestGroqClientMock:
    @pytest.fixture
    def client(self):
        with patch("app.services.groq_client.settings") as mock_cfg:
            mock_cfg.groq_key_for.return_value = "test-key"
            mock_cfg.groq_model_for.return_value = "llama-3.1-8b-instant"
            mock_cfg.groq_max_tokens = 512
            mock_cfg.groq_timeout_seconds = 10
            mock_cfg.groq_max_retries = 1
            yield GroqClient.__new__(GroqClient)

    @pytest.mark.asyncio
    async def test_validar_credencial_ok(self):
        """Valida que validar_credencial interpreta corretamente resposta 200."""
        payload = {
            "data": [
                {"id": "llama-3.1-8b-instant"},
                {"id": "llama-3.3-70b-versatile"},
            ]
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = payload

        with patch("app.services.groq_client.settings") as mock_cfg:
            mock_cfg.groq_key_for.return_value = "test-key"
            mock_cfg.groq_model_for.return_value = "llama-3.1-8b-instant"
            mock_cfg.groq_max_tokens = 512
            mock_cfg.groq_timeout_seconds = 10
            mock_cfg.groq_max_retries = 1

            c = GroqClient("market")

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_http.return_value)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.return_value.get = AsyncMock(return_value=mock_resp)

            resultado = await c.validar_credencial()

        assert resultado["ok"] is True
        assert resultado["modelo_disponivel"] is True
        assert "llama-3.1-8b-instant" in resultado["modelos_disponiveis"]

    @pytest.mark.asyncio
    async def test_validar_credencial_401(self):
        """Credencial inválida retorna ok=False sem expor a chave."""
        mock_resp = MagicMock()
        mock_resp.status_code = 401

        with patch("app.services.groq_client.settings") as mock_cfg:
            mock_cfg.groq_key_for.return_value = "bad-key"
            mock_cfg.groq_model_for.return_value = "llama-3.1-8b-instant"
            mock_cfg.groq_max_tokens = 512
            mock_cfg.groq_timeout_seconds = 10
            mock_cfg.groq_max_retries = 1
            c = GroqClient("social")

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_http.return_value)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.return_value.get = AsyncMock(return_value=mock_resp)

            resultado = await c.validar_credencial()

        assert resultado["ok"] is False
        assert "bad-key" not in str(resultado)   # chave nunca exposta
        assert resultado["erro"] is not None

    @pytest.mark.asyncio
    async def test_validar_modelo_indisponivel(self):
        """Modelo não encontrado na lista retorna ok=False."""
        payload = {"data": [{"id": "outro-modelo"}]}
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = payload

        with patch("app.services.groq_client.settings") as mock_cfg:
            mock_cfg.groq_key_for.return_value = "test-key"
            mock_cfg.groq_model_for.return_value = "llama-3.1-8b-instant"
            mock_cfg.groq_max_tokens = 512
            mock_cfg.groq_timeout_seconds = 10
            mock_cfg.groq_max_retries = 1
            c = GroqClient("market")

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_http.return_value)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.return_value.get = AsyncMock(return_value=mock_resp)

            resultado = await c.validar_credencial()

        assert resultado["ok"] is False
        assert "llama-3.1-8b-instant" in resultado["erro"]


# ── Testes do endpoint /api/groq/validar (mockado) ────────────────────────────

@pytest.mark.asyncio
async def test_endpoint_validar_estrutura():
    """Endpoint retorna estrutura correta com três agentes."""
    resultado_mock = {
        "ok": True,
        "agente": "market",
        "modelo_configurado": "llama-3.1-8b-instant",
        "modelo_disponivel": True,
        "modelos_disponiveis": ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"],
        "erro": None,
    }

    with patch("app.api.routes.groq.make_client") as mock_factory:
        mock_client = AsyncMock()
        mock_client.key_configured = True
        mock_client.validar_credencial = AsyncMock(return_value=resultado_mock)
        mock_factory.return_value = mock_client

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/groq/validar")

    assert resp.status_code == 200
    data = resp.json()
    assert "todos_ok" in data
    assert "agentes" in data
    assert len(data["agentes"]) == 3
    nomes = [a["agente"] for a in data["agentes"]]
    assert "market" in nomes
    assert "social" in nomes
    assert "consolidator" in nomes
