"""
Testes unitários dos agentes de IA (Market, Social, Consolidador).
Mockam a GroqCloud — sem chamadas reais à API.
"""
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.agents.schemas import (
    TarefaAgente, ResultadoAgente, ResultadoConsolidado,
    TipoAgente, TipoDado, EvidenciaIndicador,
)
from app.agents.market_agent import AgenteMarket
from app.agents.social_agent import AgenteSocial
from app.agents.consolidator_agent import AgenteConsolidador
from app.api.routes.investigar import _formatar_indicadores, PedidoInvestigacao


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_client_mock(resposta: str):
    """Mock de GroqClient.chat() que retorna o JSON fornecido."""
    mock = AsyncMock()
    mock.chat = AsyncMock(return_value=resposta)
    mock.model = "llama-test"
    return mock


def _tarefa(
    ibge: str = "3550308",
    nome: str = "São Paulo",
    pergunta: str = "Qual o potencial de conectividade?",
    contexto: str | None = None,
) -> TarefaAgente:
    return TarefaAgente(
        codigo_ibge=ibge,
        nome_municipio=nome,
        pergunta=pergunta,
        contexto_extra=contexto,
    )


# ── Testes do AgenteMarket ────────────────────────────────────────────────────

class TestAgenteMarket:
    @pytest.mark.asyncio
    async def test_retorna_resultado_valido(self):
        """Resposta JSON válida deve produzir ResultadoAgente sem erro."""
        resposta_json = json.dumps({
            "constatacoes": ["Alta densidade populacional favorece conectividade"],
            "evidencias": [
                {
                    "nome": "População urbana",
                    "valor": "11.451.245",
                    "unidade": "habitantes",
                    "fonte": "IBGE",
                    "periodo": "2022",
                    "tipo": "oficial",
                    "limitacoes": None,
                }
            ],
            "fontes": ["IBGE"],
            "periodos": ["2022"],
            "limitacoes": ["Dados de 2022 podem estar desatualizados"],
            "dados_ausentes": [],
        })

        agente = AgenteMarket.__new__(AgenteMarket)
        agente._client = _make_client_mock(resposta_json)

        resultado = await agente.investigar(_tarefa())

        assert resultado.erro is None
        assert resultado.agente == TipoAgente.MARKET
        assert len(resultado.constatacoes) == 1
        assert len(resultado.evidencias) == 1
        assert resultado.evidencias[0].tipo == TipoDado.OFICIAL

    @pytest.mark.asyncio
    async def test_tipo_interpretado_aceito(self):
        """TipoDado.INTERPRETADO deve ser aceito sem erro."""
        resposta_json = json.dumps({
            "constatacoes": ["Estimativa baseada em extrapolação"],
            "evidencias": [
                {
                    "nome": "Projeção de acessos",
                    "valor": "15000",
                    "unidade": "acessos",
                    "fonte": "NEXORA",
                    "periodo": "2024",
                    "tipo": "interpretado",
                    "limitacoes": "Projeção não oficial",
                }
            ],
            "fontes": ["NEXORA"],
            "periodos": ["2024"],
            "limitacoes": [],
            "dados_ausentes": [],
        })

        agente = AgenteMarket.__new__(AgenteMarket)
        agente._client = _make_client_mock(resposta_json)

        resultado = await agente.investigar(_tarefa())

        assert resultado.erro is None
        assert resultado.evidencias[0].tipo == TipoDado.INTERPRETADO

    @pytest.mark.asyncio
    async def test_resposta_vazia_retorna_erro(self):
        """Resposta vazia do modelo deve produzir ResultadoAgente com erro."""
        agente = AgenteMarket.__new__(AgenteMarket)
        agente._client = _make_client_mock("")

        resultado = await agente.investigar(_tarefa())

        assert resultado.erro is not None
        assert "vazia" in resultado.erro.lower()

    @pytest.mark.asyncio
    async def test_json_invalido_retorna_erro_parse(self):
        """JSON mal-formado deve retornar resultado com erro de parse."""
        agente = AgenteMarket.__new__(AgenteMarket)
        agente._client = _make_client_mock("não é json {{{")

        resultado = await agente.investigar(_tarefa())

        assert resultado.erro is not None

    @pytest.mark.asyncio
    async def test_prompt_contem_pergunta(self):
        """O user message enviado ao modelo deve conter a pergunta."""
        mensagens_capturadas = []

        async def _fake_chat(messages, **kwargs):
            mensagens_capturadas.extend(messages)
            return json.dumps({
                "constatacoes": [], "evidencias": [], "fontes": [],
                "periodos": [], "limitacoes": [], "dados_ausentes": [],
            })

        agente = AgenteMarket.__new__(AgenteMarket)
        mock_client = MagicMock()
        mock_client.chat = _fake_chat
        mock_client.model = "llama-test"
        agente._client = mock_client

        pergunta = "Qual o índice de cobertura 4G neste município?"
        await agente.investigar(_tarefa(pergunta=pergunta))

        user_msg = next(m for m in mensagens_capturadas if m["role"] == "user")
        assert pergunta in user_msg["content"]


# ── Testes do AgenteSocial ────────────────────────────────────────────────────

class TestAgenteSocial:
    @pytest.mark.asyncio
    async def test_retorna_resultado_valido(self):
        resposta_json = json.dumps({
            "constatacoes": ["IDHM elevado indica demanda por inclusão digital"],
            "evidencias": [
                {
                    "nome": "IDHM",
                    "valor": "0.805",
                    "unidade": None,
                    "fonte": "PNUD",
                    "periodo": "2010",
                    "tipo": "oficial",
                    "limitacoes": "Dado de 2010, desatualizado",
                }
            ],
            "fontes": ["PNUD"],
            "periodos": ["2010"],
            "limitacoes": ["IDHM disponível apenas para 2010"],
            "dados_ausentes": [],
        })

        agente = AgenteSocial.__new__(AgenteSocial)
        agente._client = _make_client_mock(resposta_json)

        resultado = await agente.investigar(_tarefa())

        assert resultado.erro is None
        assert resultado.agente == TipoAgente.SOCIAL
        assert len(resultado.constatacoes) == 1

    @pytest.mark.asyncio
    async def test_prompt_contem_pergunta(self):
        mensagens_capturadas = []

        async def _fake_chat(messages, **kwargs):
            mensagens_capturadas.extend(messages)
            return json.dumps({
                "constatacoes": [], "evidencias": [], "fontes": [],
                "periodos": [], "limitacoes": [], "dados_ausentes": [],
            })

        agente = AgenteSocial.__new__(AgenteSocial)
        mock_client = MagicMock()
        mock_client.chat = _fake_chat
        mock_client.model = "llama-test"
        agente._client = mock_client

        pergunta = "Quais grupos vulneráveis precisam de conectividade?"
        await agente.investigar(_tarefa(pergunta=pergunta))

        user_msg = next(m for m in mensagens_capturadas if m["role"] == "user")
        assert pergunta in user_msg["content"]


# ── Testes do AgenteConsolidador ─────────────────────────────────────────────

class TestAgenteConsolidador:
    def _make_resultado_agente(self, tipo: TipoAgente = TipoAgente.MARKET) -> ResultadoAgente:
        return ResultadoAgente(
            agente=tipo,
            municipio="Campinas",
            codigo_ibge="3509502",
            constatacoes=["Boa infraestrutura"],
            fontes=["ANATEL"],
            periodos=["2023"],
        )

    @pytest.mark.asyncio
    async def test_consolidar_retorna_resultado_valido(self):
        resposta_json = json.dumps({
            "sintese": "Campinas apresenta potencial elevado.",
            "convergencias": ["Alta urbanização beneficia mercado e social"],
            "divergencias": [],
            "dados_insuficientes": ["IDHM desatualizado"],
            "conclusao": "Município prioritário para expansão.",
            "fontes_consolidadas": ["ANATEL", "IBGE"],
            "periodos_referencia": ["2023"],
            "limitacoes_gerais": ["Dados parciais"],
        })

        consolidador = AgenteConsolidador.__new__(AgenteConsolidador)
        consolidador._client = _make_client_mock((resposta_json, 350))
        consolidador._client.chat = AsyncMock(return_value=(resposta_json, 350))

        market = self._make_resultado_agente(TipoAgente.MARKET)
        social = self._make_resultado_agente(TipoAgente.SOCIAL)

        resultado = await consolidador._consolidar("Qual o potencial?", market, social)

        assert isinstance(resultado, ResultadoConsolidado)
        assert resultado.sintese != ""
        assert len(resultado.convergencias) == 1
        assert resultado.tokens_totais == 350  # apenas consolidador (market/social = 0)

    @pytest.mark.asyncio
    async def test_tokens_totais_soma_tres_agentes(self):
        """tokens_totais deve somar market + social + consolidador."""
        resposta_json = json.dumps({
            "sintese": "Síntese.",
            "convergencias": [],
            "divergencias": [],
            "dados_insuficientes": [],
            "conclusao": "Conclusão.",
            "fontes_consolidadas": [],
            "periodos_referencia": [],
            "limitacoes_gerais": [],
        })

        consolidador = AgenteConsolidador.__new__(AgenteConsolidador)
        consolidador._client = MagicMock()
        consolidador._client.chat = AsyncMock(return_value=(resposta_json, 400))
        consolidador._client.model = "llama-test"

        market = self._make_resultado_agente(TipoAgente.MARKET)
        market.tokens_usados = 1500

        social = self._make_resultado_agente(TipoAgente.SOCIAL)
        social.tokens_usados = 1200

        resultado = await consolidador._consolidar("Pergunta?", market, social)

        assert resultado.tokens_totais == 1500 + 1200 + 400


# ── Testes de _formatar_indicadores ──────────────────────────────────────────

class TestFormatarIndicadores:
    def _make_row(self, data: dict):
        row = MagicMock()
        row.__getitem__ = MagicMock(side_effect=lambda k: data[k])
        return row

    def test_sem_indicadores_retorna_mensagem_mercado(self):
        resultado = _formatar_indicadores([], "mercado")
        assert "mercado" in resultado
        assert "indisponível" not in resultado.lower() or "Nenhum" in resultado

    def test_sem_indicadores_retorna_mensagem_social_gramaticalmente_correta(self):
        """'Nenhum indicador sociais' — gramática corrigida (não 'de social')."""
        resultado = _formatar_indicadores([], "social")
        assert "sociais" in resultado
        assert "de social" not in resultado  # bug corrigido

    def test_formata_indicador_numerico(self):
        row = self._make_row({
            "categoria": "mercado",
            "chave": "cobertura_4g",
            "nome": "Acessos 4G",
            "valor_num": 12345.0,
            "valor_txt": None,
            "unidade": "acessos",
            "fonte": "ANATEL",
            "periodo": "2023",
            "tipo": "oficial",
            "limitacoes": None,
        })
        resultado = _formatar_indicadores([row], "mercado")
        assert "12345" in resultado
        assert "ANATEL" in resultado
        assert "acessos" in resultado

    def test_formata_indicador_indisponivel(self):
        row = self._make_row({
            "categoria": "social",
            "chave": "idhm",
            "nome": "IDH",
            "valor_num": None,
            "valor_txt": None,
            "unidade": None,
            "fonte": "PNUD",
            "periodo": "2010",
            "tipo": "oficial",
            "limitacoes": None,
        })
        resultado = _formatar_indicadores([row], "social")
        assert "N/D" in resultado
        assert "PNUD" in resultado


# ── Testes de validação de PedidoInvestigacao ─────────────────────────────────

class TestPedidoInvestigacaoValidacao:
    def test_pergunta_dentro_do_limite(self):
        pedido = PedidoInvestigacao(codigo_ibge="3550308", pergunta="Qual o potencial?")
        assert pedido.pergunta == "Qual o potencial?"

    def test_pergunta_vazia_levanta_erro(self):
        with pytest.raises(Exception):
            PedidoInvestigacao(codigo_ibge="3550308", pergunta="")

    def test_pergunta_so_espacos_levanta_erro(self):
        with pytest.raises(Exception):
            PedidoInvestigacao(codigo_ibge="3550308", pergunta="   ")

    def test_pergunta_acima_do_limite_levanta_erro(self):
        pergunta_longa = "x" * 501
        with pytest.raises(Exception, match="500"):
            PedidoInvestigacao(codigo_ibge="3550308", pergunta=pergunta_longa)

    def test_pergunta_exatamente_no_limite(self):
        pergunta_limite = "a" * 500
        pedido = PedidoInvestigacao(codigo_ibge="3550308", pergunta=pergunta_limite)
        assert len(pedido.pergunta) == 500

    def test_pergunta_com_espacos_e_trim(self):
        pedido = PedidoInvestigacao(codigo_ibge="3550308", pergunta="  Qual o potencial?  ")
        assert pedido.pergunta == "Qual o potencial?"
