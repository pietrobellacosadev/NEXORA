"""
Testes do serviço de cache de agentes (agent_cache.py).
Usam banco SQLite em memória via patch de get_db.
"""
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.agent_cache import (
    get_cache, set_cache, _hash_pergunta, _normalizar, CACHE_TTL_HORAS,
)
from app.agents.schemas import (
    ResultadoConsolidado, ResultadoAgente, TipoAgente,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resultado_mock(ibge: str = "3550308", pergunta: str = "oportunidades") -> ResultadoConsolidado:
    agente_vazio = ResultadoAgente(
        agente=TipoAgente.MARKET,
        municipio="São Paulo",
        codigo_ibge=ibge,
    )
    return ResultadoConsolidado(
        municipio="São Paulo",
        codigo_ibge=ibge,
        pergunta=pergunta,
        mercado=agente_vazio,
        social=ResultadoAgente(
            agente=TipoAgente.SOCIAL,
            municipio="São Paulo",
            codigo_ibge=ibge,
        ),
        sintese="Síntese de teste.",
        conclusao="Conclusão de teste.",
        modelo_consolidador="test-model",
        tokens_totais=100,
    )


def _mock_db_hit(resultado: ResultadoConsolidado):
    """Simula banco com entrada no cache."""
    db = AsyncMock()
    db.close = AsyncMock()
    row = MagicMock()
    row.__getitem__ = MagicMock(
        side_effect=lambda k: resultado.model_dump_json() if k == "resposta_json" else None
    )
    db.execute_fetchall = AsyncMock(return_value=[row])
    return db


def _mock_db_miss():
    """Simula banco sem entrada no cache."""
    db = AsyncMock()
    db.close = AsyncMock()
    db.execute_fetchall = AsyncMock(return_value=[])
    return db


def _mock_db_write():
    """Simula banco para escrita."""
    db = AsyncMock()
    db.close = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    return db


# ── Testes de hash ────────────────────────────────────────────────────────────

class TestHashPergunta:
    def test_mesmo_hash_para_pergunta_com_espacos_extras(self):
        h1 = _hash_pergunta("3550308", "quais oportunidades")
        h2 = _hash_pergunta("3550308", "  quais   oportunidades  ")
        assert h1 == h2

    def test_mesmo_hash_case_insensitive(self):
        h1 = _hash_pergunta("3550308", "Oportunidades de Conectividade")
        h2 = _hash_pergunta("3550308", "oportunidades de conectividade")
        assert h1 == h2

    def test_mesmo_hash_sem_acento(self):
        h1 = _hash_pergunta("3550308", "análise de mercado")
        h2 = _hash_pergunta("3550308", "analise de mercado")
        assert h1 == h2

    def test_municipios_diferentes_geram_hashes_diferentes(self):
        h1 = _hash_pergunta("3550308", "oportunidades")
        h2 = _hash_pergunta("3509502", "oportunidades")
        assert h1 != h2

    def test_perguntas_diferentes_geram_hashes_diferentes(self):
        h1 = _hash_pergunta("3550308", "oportunidades de mercado")
        h2 = _hash_pergunta("3550308", "indicadores sociais")
        assert h1 != h2

    def test_hash_tem_32_caracteres(self):
        h = _hash_pergunta("3550308", "pergunta")
        assert len(h) == 32


# ── Testes de get_cache ───────────────────────────────────────────────────────

class TestGetCache:
    @pytest.mark.asyncio
    async def test_retorna_none_em_cache_miss(self):
        with patch("app.services.agent_cache.get_db", return_value=_mock_db_miss()):
            resultado = await get_cache("3550308", "oportunidades")
        assert resultado is None

    @pytest.mark.asyncio
    async def test_retorna_resultado_em_cache_hit(self):
        esperado = _resultado_mock()
        with patch("app.services.agent_cache.get_db", return_value=_mock_db_hit(esperado)):
            resultado = await get_cache("3550308", "oportunidades")
        assert resultado is not None
        assert resultado.municipio == "São Paulo"
        assert resultado.sintese == "Síntese de teste."

    @pytest.mark.asyncio
    async def test_retorna_none_em_excecao_de_banco(self):
        """Cache nunca deve propagar exceções — falha silenciosa."""
        db = AsyncMock()
        db.close = AsyncMock()
        db.execute_fetchall = AsyncMock(side_effect=Exception("banco corrompido"))
        with patch("app.services.agent_cache.get_db", return_value=db):
            resultado = await get_cache("3550308", "oportunidades")
        assert resultado is None

    @pytest.mark.asyncio
    async def test_query_usa_codigo_ibge_correto(self):
        db = _mock_db_miss()
        with patch("app.services.agent_cache.get_db", return_value=db):
            await get_cache("3509502", "pergunta teste")
        args = db.execute_fetchall.call_args[0]
        # Primeiro argumento da query deve conter o código IBGE
        assert "3509502" in str(args[1])


# ── Testes de set_cache ───────────────────────────────────────────────────────

class TestSetCache:
    @pytest.mark.asyncio
    async def test_persiste_resultado_no_banco(self):
        db = _mock_db_write()
        resultado = _resultado_mock()
        with patch("app.services.agent_cache.get_db", return_value=db):
            await set_cache("3550308", "oportunidades", resultado)
        db.execute.assert_called_once()
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_insere_json_valido(self):
        db = _mock_db_write()
        resultado = _resultado_mock()
        with patch("app.services.agent_cache.get_db", return_value=db):
            await set_cache("3550308", "oportunidades", resultado)

        call_args = db.execute.call_args[0]
        json_inserido = call_args[1][2]  # posição do resposta_json nos params
        parsed = json.loads(json_inserido)
        assert parsed["municipio"] == "São Paulo"
        assert parsed["sintese"] == "Síntese de teste."

    @pytest.mark.asyncio
    async def test_nao_propaga_excecao_de_banco(self):
        """set_cache nunca deve interromper o fluxo principal."""
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=Exception("disco cheio"))
        db.close = AsyncMock()
        with patch("app.services.agent_cache.get_db", return_value=db):
            # Não deve lançar exceção
            await set_cache("3550308", "pergunta", _resultado_mock())

    @pytest.mark.asyncio
    async def test_hash_normalizado_e_consistente(self):
        """Dois set_cache com mesma pergunta (casing diferente) devem gerar mesmo hash."""
        db1 = _mock_db_write()
        db2 = _mock_db_write()
        resultado = _resultado_mock()

        with patch("app.services.agent_cache.get_db", return_value=db1):
            await set_cache("3550308", "Oportunidades de Mercado", resultado)

        with patch("app.services.agent_cache.get_db", return_value=db2):
            await set_cache("3550308", "oportunidades de mercado", resultado)

        hash1 = db1.execute.call_args[0][1][1]
        hash2 = db2.execute.call_args[0][1][1]
        assert hash1 == hash2


# ── Teste de integração: roundtrip get → set ──────────────────────────────────

class TestRoundtrip:
    @pytest.mark.asyncio
    async def test_set_depois_get_retorna_mesmo_resultado(self):
        """
        Simula: set persiste → get recupera → resultado é igual ao original.
        Usa um 'banco em memória' com dicionário.
        """
        armazenado: dict = {}

        async def mock_set_db():
            db = AsyncMock()
            db.close = AsyncMock()
            db.commit = AsyncMock()
            async def fake_execute(sql, params):
                armazenado["resposta_json"] = params[2]
            db.execute = AsyncMock(side_effect=fake_execute)
            return db

        async def mock_get_db():
            db = AsyncMock()
            db.close = AsyncMock()
            if armazenado:
                row = MagicMock()
                row.__getitem__ = MagicMock(
                    side_effect=lambda k: armazenado["resposta_json"] if k == "resposta_json" else None
                )
                db.execute_fetchall = AsyncMock(return_value=[row])
            else:
                db.execute_fetchall = AsyncMock(return_value=[])
            return db

        original = _resultado_mock(pergunta="teste roundtrip")

        with patch("app.services.agent_cache.get_db", side_effect=mock_set_db):
            await set_cache("3550308", "teste roundtrip", original)

        with patch("app.services.agent_cache.get_db", side_effect=mock_get_db):
            recuperado = await get_cache("3550308", "teste roundtrip")

        assert recuperado is not None
        assert recuperado.sintese == original.sintese
        assert recuperado.conclusao == original.conclusao
        assert recuperado.modelo_consolidador == original.modelo_consolidador
