"""
Testes de validação dos schemas Pydantic dos agentes.

Objetivo: garantir que os validators de coerção de tipos tratam corretamente
todas as variações que a IA pode retornar — sem fazer nenhuma chamada à API Groq.

Categorias testadas:
- ViabilidadeFinanceira: financiamentos_disponiveis (list/str/None/JSON-string)
- ViabilidadeFinanceira: campos string coercidos de list/dict/número
- CustoEstimado: campos float coercidos de string formatada BR / abreviações
- CustoEstimado: campos string coercidos de list/número
- ImpactoEstimado: campos string coercidos de número/list/None
- TipoDado: variantes maiúsculas / grafias alternativas
- ResultadoAgente: campos ausentes / nulos / tipos incorretos
- AgenteMarket._parsear: respostas simuladas com tipos mistos
- AgenteSocial._parsear: respostas simuladas com tipos mistos
- AgenteConsolidador._parsear: respostas simuladas com tipos mistos
"""
from __future__ import annotations

import json
import pytest
from unittest.mock import MagicMock

from app.agents.schemas import (
    CustoEstimado,
    EvidenciaIndicador,
    ImpactoEstimado,
    ResultadoAgente,
    ResultadoConsolidado,
    TarefaAgente,
    TipoDado,
    TipoAgente,
    ViabilidadeFinanceira,
    _coerce_str,
    _coerce_float,
)
from app.agents.market_agent import AgenteMarket
from app.agents.social_agent import AgenteSocial
from app.agents.consolidator_agent import AgenteConsolidador


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_market_resultado(**kwargs) -> ResultadoAgente:
    defaults = dict(
        agente=TipoAgente.MARKET,
        municipio="Campinas",
        codigo_ibge="3509502",
    )
    defaults.update(kwargs)
    return ResultadoAgente(**defaults)


def _make_social_resultado(**kwargs) -> ResultadoAgente:
    defaults = dict(
        agente=TipoAgente.SOCIAL,
        municipio="Campinas",
        codigo_ibge="3509502",
    )
    defaults.update(kwargs)
    return ResultadoAgente(**defaults)


def _make_client_mock(resposta):
    """Mock de GroqClient que retorna `resposta` direto do chat()."""
    mock = MagicMock()
    mock.model = "llama-test"
    # Suporta tanto (str, int) quanto str simples
    import asyncio

    async def _chat(*a, **kw):
        return resposta

    mock.chat = _chat
    return mock


def _tarefa() -> TarefaAgente:
    return TarefaAgente(
        codigo_ibge="3509502",
        nome_municipio="Campinas",
        pergunta="Qual o potencial?",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# _coerce_str e _coerce_float (helpers internos)
# ═══════════════════════════════════════════════════════════════════════════════

class TestCoerceStr:
    def test_none_retorna_none(self):
        assert _coerce_str(None) is None

    def test_string_retorna_string(self):
        assert _coerce_str("FTTH") == "FTTH"

    def test_string_vazia_retorna_none(self):
        assert _coerce_str("   ") is None

    def test_lista_une_com_ponto_virgula(self):
        assert _coerce_str(["FTTH", "WISP"]) == "FTTH; WISP"

    def test_lista_com_nulos_ignora(self):
        assert _coerce_str([None, "FTTH", ""]) == "FTTH"

    def test_dict_retorna_primeiro_valor_string(self):
        resultado = _coerce_str({"chave": "valor útil"})
        assert resultado == "valor útil"

    def test_numero_inteiro_vira_string(self):
        assert _coerce_str(42) == "42"

    def test_numero_float_vira_string(self):
        assert _coerce_str(3.14) == "3.14"


class TestCoerceFloat:
    def test_none_retorna_none(self):
        assert _coerce_float(None) is None

    def test_int_retorna_float(self):
        assert _coerce_float(5000000) == 5_000_000.0

    def test_float_retorna_float(self):
        assert _coerce_float(2.5) == 2.5

    def test_string_numerica_simples(self):
        assert _coerce_float("1500") == 1500.0

    def test_string_com_milhar_ponto_br(self):
        assert _coerce_float("1.500.000") == 1_500_000.0

    def test_string_com_virgula_decimal_br(self):
        assert _coerce_float("2,5") == 2.5

    def test_string_br_completa(self):
        assert _coerce_float("1.500.000,50") == 1_500_000.5

    def test_string_prefixo_rs(self):
        assert _coerce_float("R$ 2.500.000") == 2_500_000.0

    def test_abreviacao_M(self):
        assert _coerce_float("2,5M") == 2_500_000.0

    def test_abreviacao_K(self):
        assert _coerce_float("500K") == 500_000.0

    def test_string_invalida_retorna_none(self):
        assert _coerce_float("não é número") is None

    def test_string_vazia_retorna_none(self):
        assert _coerce_float("") is None

    def test_lista_usa_primeiro_elemento(self):
        assert _coerce_float([1500000, 2000000]) == 1_500_000.0


# ═══════════════════════════════════════════════════════════════════════════════
# TipoDado — case-insensitive e grafias alternativas
# ═══════════════════════════════════════════════════════════════════════════════

class TestTipoDado:
    def test_minusculo_aceito(self):
        assert TipoDado("oficial") == TipoDado.OFICIAL

    def test_maiusculo_aceito(self):
        assert TipoDado("OFICIAL") == TipoDado.OFICIAL

    def test_calculada_alias(self):
        assert TipoDado("calculada") == TipoDado.CALCULADO

    def test_estimada_alias(self):
        assert TipoDado("estimada") == TipoDado.ESTIMADO

    def test_interpretada_alias(self):
        assert TipoDado("interpretada") == TipoDado.INTERPRETADO

    def test_indisponivel_acentuado(self):
        assert TipoDado("indisponível") == TipoDado.INDISPONIVEL

    def test_na_alias(self):
        assert TipoDado("n/a") == TipoDado.INDISPONIVEL

    def test_unavailable_alias(self):
        assert TipoDado("unavailable") == TipoDado.INDISPONIVEL

    def test_valor_desconhecido_retorna_indisponivel(self):
        assert TipoDado("xyz_desconhecido") == TipoDado.INDISPONIVEL


# ═══════════════════════════════════════════════════════════════════════════════
# ViabilidadeFinanceira
# ═══════════════════════════════════════════════════════════════════════════════

class TestViabilidadeFinanceira:
    def test_financiamentos_como_lista(self):
        vf = ViabilidadeFinanceira(financiamentos_disponiveis=["FUST", "BNDES", "PNBL"])
        assert vf.financiamentos_disponiveis == ["FUST", "BNDES", "PNBL"]

    def test_financiamentos_como_string_csv(self):
        vf = ViabilidadeFinanceira(financiamentos_disponiveis="FUST, BNDES Telecom, PNBL")
        assert "FUST" in vf.financiamentos_disponiveis
        assert "PNBL" in vf.financiamentos_disponiveis
        assert len(vf.financiamentos_disponiveis) == 3

    def test_financiamentos_como_string_json(self):
        vf = ViabilidadeFinanceira(
            financiamentos_disponiveis='["FUST", "BNDES", "PNBL", "Editais ANATEL"]'
        )
        assert "FUST" in vf.financiamentos_disponiveis
        assert len(vf.financiamentos_disponiveis) == 4

    def test_financiamentos_none_retorna_lista_vazia(self):
        vf = ViabilidadeFinanceira(financiamentos_disponiveis=None)
        assert vf.financiamentos_disponiveis == []

    def test_financiamentos_string_vazia_retorna_lista_vazia(self):
        vf = ViabilidadeFinanceira(financiamentos_disponiveis="")
        assert vf.financiamentos_disponiveis == []

    def test_financiamentos_lista_com_nulos_ignora(self):
        vf = ViabilidadeFinanceira(financiamentos_disponiveis=["FUST", None, "", "BNDES"])
        assert vf.financiamentos_disponiveis == ["FUST", "BNDES"]

    def test_campo_string_recebe_lista(self):
        """Campos string devem aceitar lista e unir com '; '."""
        vf = ViabilidadeFinanceira(riscos=["Concorrência", "ROI negativo", "Orografia"])
        assert vf.riscos == "Concorrência; ROI negativo; Orografia"

    def test_campo_string_recebe_numero(self):
        vf = ViabilidadeFinanceira(payback_anos=5)
        assert vf.payback_anos == "5"

    def test_campo_string_recebe_none(self):
        vf = ViabilidadeFinanceira(tipo_rede_recomendado=None)
        assert vf.tipo_rede_recomendado is None

    def test_campo_string_recebe_dict(self):
        vf = ViabilidadeFinanceira(justificativa={"texto": "Alta densidade favorece FTTH"})
        assert "Alta densidade" in (vf.justificativa or "")

    def test_todos_campos_ausentes_retorna_defaults(self):
        vf = ViabilidadeFinanceira()
        assert vf.financiamentos_disponiveis == []
        assert vf.tipo_rede_recomendado is None
        assert vf.classificacao is None


# ═══════════════════════════════════════════════════════════════════════════════
# CustoEstimado
# ═══════════════════════════════════════════════════════════════════════════════

class TestCustoEstimado:
    def test_float_nativo(self):
        c = CustoEstimado(custo_total_min_reais=1500000.0)
        assert c.custo_total_min_reais == 1_500_000.0

    def test_int_coercido_para_float(self):
        c = CustoEstimado(custo_total_min_reais=1500000)
        assert c.custo_total_min_reais == 1_500_000.0

    def test_string_numerica_br(self):
        c = CustoEstimado(custo_total_min_reais="2.500.000")
        assert c.custo_total_min_reais == 2_500_000.0

    def test_string_com_rs(self):
        c = CustoEstimado(custo_total_max_reais="R$ 4.800.000")
        assert c.custo_total_max_reais == 4_800_000.0

    def test_abreviacao_M(self):
        c = CustoEstimado(custo_total_min_reais="2,5M")
        assert c.custo_total_min_reais == 2_500_000.0

    def test_string_invalida_retorna_none(self):
        c = CustoEstimado(custo_total_min_reais="não informado")
        assert c.custo_total_min_reais is None

    def test_none_retorna_none(self):
        c = CustoEstimado(custo_total_min_reais=None)
        assert c.custo_total_min_reais is None

    def test_tipo_rede_lista_une(self):
        c = CustoEstimado(tipo_rede=["FTTH", "WISP"])
        assert c.tipo_rede == "FTTH; WISP"

    def test_premissas_numero_vira_string(self):
        c = CustoEstimado(premissas=100)
        assert c.premissas == "100"

    def test_classificacao_retorno_none(self):
        c = CustoEstimado(classificacao_retorno=None)
        assert c.classificacao_retorno is None


# ═══════════════════════════════════════════════════════════════════════════════
# ImpactoEstimado
# ═══════════════════════════════════════════════════════════════════════════════

class TestImpactoEstimado:
    def test_domicilios_como_inteiro(self):
        i = ImpactoEstimado(domicilios_beneficiados=5000)
        assert i.domicilios_beneficiados == "5000"

    def test_domicilios_como_float(self):
        i = ImpactoEstimado(domicilios_beneficiados=5000.0)
        assert i.domicilios_beneficiados == "5000.0"

    def test_escolas_como_lista(self):
        i = ImpactoEstimado(escolas_beneficiadas=["12 escolas municipais", "3 estaduais"])
        assert "12 escolas" in (i.escolas_beneficiadas or "")

    def test_reducao_como_numero(self):
        i = ImpactoEstimado(reducao_exclusao_digital_pct=35)
        assert i.reducao_exclusao_digital_pct == "35"

    def test_observacoes_none(self):
        i = ImpactoEstimado(observacoes=None)
        assert i.observacoes is None

    def test_todos_campos_ausentes(self):
        i = ImpactoEstimado()
        assert i.domicilios_beneficiados is None
        assert i.escolas_beneficiadas is None


# ═══════════════════════════════════════════════════════════════════════════════
# AgenteMarket._parsear — respostas simuladas
# ═══════════════════════════════════════════════════════════════════════════════

class TestAgenteMarketParsear:
    def _agente(self) -> AgenteMarket:
        a = AgenteMarket.__new__(AgenteMarket)
        a._client = _make_client_mock("")
        return a

    def test_custo_estimado_com_valores_numericos_br(self):
        """IA retorna custos como strings formatadas em BR — devem virar float."""
        resposta = json.dumps({
            "constatacoes": ["Análise concluída"],
            "custo_estimado": {
                "tipo_rede": "FTTH",
                "custo_total_min_reais": "2.500.000",
                "custo_total_max_reais": "R$ 4.800.000",
                "custo_por_domicilio": "R$ 1.200 a R$ 2.500",
                "payback_estimado_anos": "4 a 6 anos",
                "classificacao_retorno": "MÉDIO",
                "premissas": "Penetração de 40%",
            },
            "evidencias": [],
            "fontes": ["ABINC"],
            "periodos": ["2024"],
            "limitacoes": [],
            "dados_ausentes": [],
        })
        resultado = self._agente()._parsear(resposta, _tarefa())
        assert resultado.erro is None
        assert resultado.custo_estimado is not None
        assert resultado.custo_estimado.custo_total_min_reais == 2_500_000.0
        assert resultado.custo_estimado.custo_total_max_reais == 4_800_000.0

    def test_custo_estimado_com_abreviacoes(self):
        resposta = json.dumps({
            "constatacoes": [],
            "custo_estimado": {
                "tipo_rede": "WISP",
                "custo_total_min_reais": "1,2M",
                "custo_total_max_reais": "2,8M",
                "custo_por_domicilio": "1.500",
                "payback_estimado_anos": "5",
                "classificacao_retorno": "MÉDIO",
                "premissas": "ERBs de 10km",
            },
            "evidencias": [],
            "fontes": [],
            "periodos": [],
            "limitacoes": [],
            "dados_ausentes": [],
        })
        resultado = self._agente()._parsear(resposta, _tarefa())
        assert resultado.custo_estimado is not None
        assert resultado.custo_estimado.custo_total_min_reais == 1_200_000.0
        assert resultado.custo_estimado.custo_total_max_reais == 2_800_000.0

    def test_tipo_dado_maiusculo_aceito(self):
        """TipoDado retornado em maiúsculas deve ser normalizado."""
        resposta = json.dumps({
            "constatacoes": [],
            "custo_estimado": None,
            "evidencias": [
                {
                    "nome": "Cobertura 4G",
                    "valor": "78",
                    "unidade": "%",
                    "fonte": "ANATEL",
                    "periodo": "2023",
                    "tipo": "OFICIAL",
                    "limitacoes": None,
                }
            ],
            "fontes": [],
            "periodos": [],
            "limitacoes": [],
            "dados_ausentes": [],
        })
        resultado = self._agente()._parsear(resposta, _tarefa())
        assert resultado.erro is None
        assert resultado.evidencias[0].tipo == TipoDado.OFICIAL

    def test_campos_ausentes_retornam_defaults(self):
        """Resposta sem custo_estimado e dados_ausentes deve usar defaults."""
        resposta = json.dumps({
            "constatacoes": ["Potencial elevado"],
            "evidencias": [],
            "fontes": [],
            "periodos": [],
            "limitacoes": [],
        })
        resultado = self._agente()._parsear(resposta, _tarefa())
        assert resultado.erro is None
        assert resultado.custo_estimado is None
        assert resultado.dados_ausentes == []

    def test_constatacoes_como_string_vira_lista(self):
        """Se a IA retornar constatacoes como string simples, deve virar list."""
        resposta = json.dumps({
            "constatacoes": "Análise concluída com potencial médio",
            "evidencias": [],
            "fontes": [],
            "periodos": [],
            "limitacoes": [],
            "dados_ausentes": [],
        })
        resultado = self._agente()._parsear(resposta, _tarefa())
        assert resultado.erro is None
        assert isinstance(resultado.constatacoes, list)
        assert len(resultado.constatacoes) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# AgenteSocial._parsear — respostas simuladas
# ═══════════════════════════════════════════════════════════════════════════════

class TestAgenteSocialParsear:
    def _agente(self) -> AgenteSocial:
        a = AgenteSocial.__new__(AgenteSocial)
        a._client = _make_client_mock("")
        return a

    def test_impacto_estimado_com_numeros(self):
        """IA retorna números em vez de strings nos campos de impacto."""
        resposta = json.dumps({
            "constatacoes": ["Alto impacto social esperado"],
            "programas_elegiveis": ["PNBL", "GESAC"],
            "impacto_estimado": {
                "domicilios_beneficiados": 8500,
                "escolas_beneficiadas": 42,
                "reducao_exclusao_digital_pct": 35,
                "observacoes": "Estimativa conservadora",
            },
            "evidencias": [],
            "fontes": ["IBGE"],
            "periodos": ["2022"],
            "limitacoes": [],
            "dados_ausentes": [],
        })
        resultado = self._agente()._parsear(resposta, _tarefa())
        assert resultado.erro is None
        assert resultado.impacto_estimado is not None
        assert resultado.impacto_estimado.domicilios_beneficiados == "8500"
        assert resultado.impacto_estimado.escolas_beneficiadas == "42"
        assert resultado.impacto_estimado.reducao_exclusao_digital_pct == "35"

    def test_programas_elegiveis_como_lista(self):
        resposta = json.dumps({
            "constatacoes": [],
            "programas_elegiveis": ["PNBL", "GESAC", "EduConecta"],
            "impacto_estimado": None,
            "evidencias": [],
            "fontes": [],
            "periodos": [],
            "limitacoes": [],
            "dados_ausentes": [],
        })
        resultado = self._agente()._parsear(resposta, _tarefa())
        assert resultado.erro is None
        assert "PNBL" in resultado.programas_elegiveis
        assert len(resultado.programas_elegiveis) == 3

    def test_tipo_dado_case_variante(self):
        resposta = json.dumps({
            "constatacoes": [],
            "programas_elegiveis": [],
            "impacto_estimado": None,
            "evidencias": [
                {
                    "nome": "IDHM",
                    "valor": "0.72",
                    "unidade": None,
                    "fonte": "PNUD",
                    "periodo": "2010",
                    "tipo": "Oficial",
                    "limitacoes": None,
                }
            ],
            "fontes": [],
            "periodos": [],
            "limitacoes": [],
            "dados_ausentes": [],
        })
        resultado = self._agente()._parsear(resposta, _tarefa())
        assert resultado.evidencias[0].tipo == TipoDado.OFICIAL


# ═══════════════════════════════════════════════════════════════════════════════
# AgenteConsolidador._parsear — respostas simuladas
# ═══════════════════════════════════════════════════════════════════════════════

class TestAgenteConsolidadorParsear:
    def _consolidador(self) -> AgenteConsolidador:
        c = AgenteConsolidador.__new__(AgenteConsolidador)
        c._client = _make_client_mock(("", 0))
        return c

    def _market(self) -> ResultadoAgente:
        return _make_market_resultado()

    def _social(self) -> ResultadoAgente:
        return _make_social_resultado(agente=TipoAgente.SOCIAL)

    def test_financiamentos_como_lista(self):
        """IA retorna financiamentos como lista — deve ser aceito diretamente."""
        resposta = json.dumps({
            "sintese": "Análise completa.",
            "viabilidade_financeira": {
                "tipo_rede_recomendado": "FTTH",
                "tecnologia_recomendada": "GPON",
                "investimento_estimado_range": "R$ 2,5M a R$ 4,8M",
                "payback_anos": "4 a 6 anos",
                "classificacao": "MÉDIO",
                "financiamentos_disponiveis": ["FUST", "BNDES", "PNBL", "Editais ANATEL"],
                "potencial_mercado": "8.500 domicílios elegíveis.",
                "potencial_social": "Alta exclusão digital.",
                "justificativa": "Densidade urbana favorece FTTH.",
                "riscos": "Concorrência de incumbentes.",
                "recomendacao_analista": "RECOMENDADO COM RESSALVAS",
            },
            "convergencias": ["Alta densidade"],
            "divergencias": [],
            "dados_insuficientes": [],
            "conclusao": "Município prioritário.",
            "fontes_consolidadas": ["ANATEL"],
            "periodos_referencia": ["2023"],
            "limitacoes_gerais": [],
        })
        resultado = self._consolidador()._parsear(
            resposta, "pergunta", self._market(), self._social(), 0
        )
        assert isinstance(resultado, ResultadoConsolidado)
        vf = resultado.viabilidade_financeira
        assert vf is not None
        assert isinstance(vf.financiamentos_disponiveis, list)
        assert "FUST" in vf.financiamentos_disponiveis
        assert "BNDES" in vf.financiamentos_disponiveis
        assert len(vf.financiamentos_disponiveis) == 4

    def test_financiamentos_como_string_csv(self):
        """IA retorna financiamentos como string CSV — deve ser convertida para lista."""
        resposta = json.dumps({
            "sintese": "Análise.",
            "viabilidade_financeira": {
                "tipo_rede_recomendado": "WISP",
                "financiamentos_disponiveis": "FUST, BNDES Telecom, PNBL",
                "classificacao": "MÉDIO",
                "recomendacao_analista": "RECOMENDADO",
            },
            "convergencias": [],
            "divergencias": [],
            "dados_insuficientes": [],
            "conclusao": "Conclusão.",
            "fontes_consolidadas": [],
            "periodos_referencia": [],
            "limitacoes_gerais": [],
        })
        resultado = self._consolidador()._parsear(
            resposta, "pergunta", self._market(), self._social(), 0
        )
        vf = resultado.viabilidade_financeira
        assert vf is not None
        assert isinstance(vf.financiamentos_disponiveis, list)
        assert "FUST" in vf.financiamentos_disponiveis

    def test_viabilidade_financeira_ausente(self):
        """Resposta sem viabilidade_financeira deve retornar campo None."""
        resposta = json.dumps({
            "sintese": "Análise sem viabilidade.",
            "convergencias": [],
            "divergencias": [],
            "dados_insuficientes": [],
            "conclusao": "Dados insuficientes.",
            "fontes_consolidadas": [],
            "periodos_referencia": [],
            "limitacoes_gerais": [],
        })
        resultado = self._consolidador()._parsear(
            resposta, "pergunta", self._market(), self._social(), 0
        )
        assert isinstance(resultado, ResultadoConsolidado)
        assert resultado.viabilidade_financeira is None

    def test_campos_string_recebem_lista(self):
        """Campos string da viabilidade que receberem lista devem ser unidos."""
        resposta = json.dumps({
            "sintese": "Análise.",
            "viabilidade_financeira": {
                "tipo_rede_recomendado": "FTTH",
                "classificacao": "ALTO",
                "riscos": ["Concorrência de incumbentes", "ROI negativo", "Orografia acidentada"],
                "recomendacao_analista": "RECOMENDADO",
                "financiamentos_disponiveis": [],
            },
            "convergencias": [],
            "divergencias": [],
            "dados_insuficientes": [],
            "conclusao": "Decisão do analista.",
            "fontes_consolidadas": [],
            "periodos_referencia": [],
            "limitacoes_gerais": [],
        })
        resultado = self._consolidador()._parsear(
            resposta, "pergunta", self._market(), self._social(), 0
        )
        vf = resultado.viabilidade_financeira
        assert vf is not None
        assert "Concorrência" in (vf.riscos or "")
        assert "ROI" in (vf.riscos or "")

    def test_resposta_json_invalido_retorna_fallback(self):
        """JSON inválido não deve lançar exceção — retorna ResultadoConsolidado com sintese."""
        resultado = self._consolidador()._parsear(
            "isto não é json {{{ }", "pergunta", self._market(), self._social(), 0
        )
        assert isinstance(resultado, ResultadoConsolidado)
        assert resultado.sintese != ""
        # Conclusão deve conter o tipo do erro
        assert "JSONDecodeError" in resultado.conclusao or "limitações" in resultado.conclusao

    def test_resposta_vazia_retorna_fallback(self):
        resultado = self._consolidador()._parsear(
            "", "pergunta", self._market(), self._social(), 0
        )
        assert isinstance(resultado, ResultadoConsolidado)
        assert "vazia" in resultado.sintese.lower() or resultado.sintese != ""

    def test_campos_ausentes_usam_defaults(self):
        """Campos ausentes no JSON devem usar valores padrão do modelo."""
        resposta = json.dumps({
            "sintese": "Sintese mínima.",
            "conclusao": "Conclusão mínima.",
        })
        resultado = self._consolidador()._parsear(
            resposta, "pergunta", self._market(), self._social(), 0
        )
        assert isinstance(resultado, ResultadoConsolidado)
        assert resultado.convergencias == []
        assert resultado.divergencias == []
        assert resultado.fontes_consultadas == []

    def test_is_ia_sempre_true(self):
        resposta = json.dumps({
            "sintese": "Análise.",
            "conclusao": "Ok.",
            "convergencias": [],
            "divergencias": [],
            "dados_insuficientes": [],
            "fontes_consolidadas": [],
            "periodos_referencia": [],
            "limitacoes_gerais": [],
        })
        resultado = self._consolidador()._parsear(
            resposta, "pergunta", self._market(), self._social(), 0
        )
        assert resultado.is_ia is True
