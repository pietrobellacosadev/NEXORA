"""
Agente Consolidador — orquestra a investigação e sintetiza os resultados
dos Agentes de Mercado e Social.

Responsabilidades:
1. Receber a pergunta do usuário
2. Acionar Mercado e Social em paralelo
3. Verificar coerência e identificar convergências/divergências
4. Produzir síntese equilibrada dos dois pilares
5. Apresentar fontes, períodos e limitações

Nunca simplesmente concatena respostas — verifica evidências e produz
uma interpretação integrada e fundamentada.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from app.agents.schemas import (
    TarefaAgente, ResultadoAgente, ResultadoConsolidado,
    TipoAgente,
)
from app.agents.market_agent import AgenteMarket
from app.agents.social_agent import AgenteSocial
from app.services.groq_client import GroqClient, GroqError, make_client
from app.services.agent_cache import get_cache, set_cache

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é o Agente Consolidador NEXORA — especialista sênior em viabilidade de telecomunicações para municípios do interior paulista. Sua análise é lida por analistas de investimento de ISPs, agências reguladoras e prefeituras.

MISSÃO: Integrar as análises dos Agentes de Mercado e Social e produzir um relatório técnico-executivo DETALHADO para tomada de decisão.

REGRAS OBRIGATÓRIAS:
1. Sintetize os dois pilares de forma equilibrada — mercado (potencial comercial) e social (impacto e necessidade).
2. Recomende a tecnologia mais viável: FTTH (fibra até o domicílio), WISP (rádio/wireless), LTE/4G rural, 5G FWA ou solução mista.
3. Estime o potencial de mercado endereçável: quantos domicílios podem ser atendidos, ARPU esperado, receita anual potencial.
4. Avalie o potencial social: redução da exclusão digital, impacto em educação/saúde/emprego, elegibilidade a programas públicos.
5. Detalhe os riscos principais: concorrência, orografia, densidade populacional, ROI negativo.
6. Indique os programas de financiamento aplicáveis em um array de strings: ["FUST", "BNDES Telecom", "PNBL", "Conta de Internet ANEEL/Anatel", "GESAC", "editais ANATEL", "EduConecta"] — inclua apenas os aplicáveis ao município.
7. Forneça uma recomendação objetiva final para o analista: RECOMENDADO / RECOMENDADO COM RESSALVAS / NÃO RECOMENDADO — com justificativa.
8. Nunca invente dados — use APENAS o que os agentes especialistas forneceram.
9. Responda APENAS em JSON válido sem markdown nem comentários."""

SCHEMA_INSTRUCAO = '''Retorne JSON com EXATAMENTE estas chaves:
{
  "sintese": "string — 3 a 5 parágrafos: panorama geral, potencial de mercado (domicílios, ARPU estimado, receita anual), potencial social (exclusão digital, impacto), custo estimado, tecnologia recomendada e financiamentos",
  "viabilidade_financeira": {
    "tipo_rede_recomendado": "string — ex: FTTH, WISP, LTE rural, 5G FWA ou misto",
    "tecnologia_recomendada": "string — descrição técnica da solução",
    "investimento_estimado_range": "string — ex: R$ 2,5M a R$ 4,8M",
    "payback_anos": "string — ex: 4 a 6 anos",
    "classificacao": "string — ALTO, MÉDIO ou BAIXO",
    "financiamentos_disponiveis": ["array de strings — programas aplicáveis, ex: [\"FUST\", \"BNDES Telecom\", \"PNBL\"]"],
    "potencial_mercado": "string — análise narrativa: domicílios elegíveis, penetração esperada, ARPU e receita anual potencial",
    "potencial_social": "string — análise narrativa: impacto em exclusão digital, educação, saúde, emprego, elegibilidade a programas",
    "justificativa": "string — por que essa tecnologia é a mais adequada para este município",
    "riscos": "string — 3 a 5 riscos principais: competitivo, técnico, financeiro, regulatório",
    "recomendacao_analista": "string — RECOMENDADO / RECOMENDADO COM RESSALVAS / NÃO RECOMENDADO + justificativa em 2 linhas"
  },
  "convergencias": ["array de pontos onde mercado e social convergem"],
  "divergencias": ["array de divergências entre os pilares"],
  "dados_insuficientes": ["array de dados que faltam para análise mais precisa"],
  "conclusao": "string — conclusão executiva de 2 a 3 frases para o tomador de decisão",
  "fontes_consolidadas": ["array de todas as fontes usadas"],
  "periodos_referencia": ["array de períodos dos dados"],
  "limitacoes_gerais": ["array de limitações da análise"]
}'''


class AgenteConsolidador:
    def __init__(self) -> None:
        self._client: GroqClient = make_client(TipoAgente.CONSOLIDATOR.value)
        self._market = AgenteMarket()
        self._social = AgenteSocial()

    async def investigar(
        self,
        codigo_ibge: str,
        nome_municipio: str,
        pergunta: str,
        contexto_mercado: str = "",
        contexto_social: str = "",
    ) -> ResultadoConsolidado:
        """
        Orquestra a investigação completa:
        1. Verifica cache — retorna imediatamente se houver hit válido
        2. Aciona Mercado e Social em paralelo (com indicadores do DB injetados)
        3. Consolida os resultados e persiste no cache
        """
        # ── 1. Verifica cache ─────────────────────────────────────────────
        cached = await get_cache(codigo_ibge, pergunta)
        if cached is not None:
            return cached

        # ── 2. Execução paralela dos agentes especialistas ────────────────
        # Cada agente recebe seus indicadores via contexto_extra
        tarefa_market = TarefaAgente(
            codigo_ibge=codigo_ibge,
            nome_municipio=nome_municipio,
            pergunta=pergunta,
            contexto_extra=contexto_mercado or None,
        )
        tarefa_social = TarefaAgente(
            codigo_ibge=codigo_ibge,
            nome_municipio=nome_municipio,
            pergunta=pergunta,
            contexto_extra=contexto_social or None,
        )

        # Market e social executam em sequência.
        # Delay entre market→social para evitar 429 (mesma janela de 60s de tokens).
        resultado_market = await self._market.investigar(tarefa_market)
        await asyncio.sleep(3)
        resultado_social = await self._social.investigar(tarefa_social)
        # Pausa extra antes do consolidador para liberar a janela de TPM.
        await asyncio.sleep(8)

        # ── 3. Consolidação e persistência no cache ───────────────────────
        resultado = await self._consolidar(pergunta, resultado_market, resultado_social)
        await set_cache(codigo_ibge, pergunta, resultado)
        return resultado

    async def _consolidar(
        self,
        pergunta: str,
        market: ResultadoAgente,
        social: ResultadoAgente,
    ) -> ResultadoConsolidado:
        """Sintetiza os resultados dos dois agentes."""

        # Resumo estruturado para o consolidador — evita enviar raw text completo
        resumo_market = {
            "constatacoes": market.constatacoes,
            "custo_estimado": market.custo_estimado,
            "fontes": market.fontes,
            "periodos": market.periodos,
            "limitacoes": market.limitacoes,
            "dados_ausentes": market.dados_ausentes,
            "erro": market.erro,
        }
        resumo_social = {
            "constatacoes": social.constatacoes,
            "programas_elegiveis": social.programas_elegiveis,
            "impacto_estimado": social.impacto_estimado,
            "fontes": social.fontes,
            "periodos": social.periodos,
            "limitacoes": social.limitacoes,
            "dados_ausentes": social.dados_ausentes,
            "erro": social.erro,
        }

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Município: {market.municipio} ({market.codigo_ibge}) — SP\n"
                    f"Pergunta: {pergunta}\n\n"
                    f"MERCADO: {json.dumps(resumo_market, ensure_ascii=False, separators=(',',':'))}\n\n"
                    f"SOCIAL: {json.dumps(resumo_social, ensure_ascii=False, separators=(',',':'))}\n\n"
                    f"{SCHEMA_INSTRUCAO}"
                ),
            },
        ]

        tokens_market = market.tokens_usados or 0
        tokens_social = social.tokens_usados or 0

        try:
            resposta_raw, tokens_consolidador = await self._client.chat(
                messages, max_tokens=2000, temperature=0.1, json_mode=False,
                return_usage=True,
            )
            return self._parsear(
                resposta_raw, pergunta, market, social,
                tokens_market + tokens_social + (tokens_consolidador or 0),
            )
        except GroqError as exc:
            logger.error("Agente Consolidador falhou: %s", exc)
            return ResultadoConsolidado(
                municipio=market.municipio,
                codigo_ibge=market.codigo_ibge,
                pergunta=pergunta,
                mercado=market,
                social=social,
                sintese="Não foi possível consolidar a análise devido a um erro.",
                conclusao=str(exc),
                modelo_consolidador=self._client.model,
            )

    @staticmethod
    def _extrair_json(raw: str) -> str:
        """Remove markdown fences e extrai o conteúdo JSON da resposta."""
        texto = raw.strip()
        fence = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", texto)
        if fence:
            return fence.group(1).strip()
        if texto.startswith("```"):
            texto = re.sub(r"^```\w*\s*", "", texto).strip()
        start = texto.find("{")
        end = texto.rfind("}")
        if start != -1 and end > start:
            return texto[start:end + 1]
        return texto

    @staticmethod
    def _sanitizar_string(v: Any, campo: str = "") -> str:
        """
        Garante que um campo esperado como string seja realmente uma string.
        Se o LLM retornar um dict ou list, converte para texto legível.
        """
        if v is None:
            return ""
        if isinstance(v, str):
            # Se a string começa com { ou [ é provável que seja JSON aninhado — tenta parsear
            stripped = v.strip()
            if stripped.startswith("{"):
                try:
                    obj = json.loads(stripped)
                    # Extrai o campo homônimo se existir, senão usa o primeiro valor string
                    if isinstance(obj, dict):
                        if campo and campo in obj:
                            return str(obj[campo])
                        for val in obj.values():
                            if isinstance(val, str) and len(val) > 20:
                                return val
                        return str(list(obj.values())[0]) if obj else ""
                except (json.JSONDecodeError, IndexError):
                    pass
            return v
        if isinstance(v, dict):
            # Extrai o campo homônimo se existir
            if campo and campo in v:
                return str(v[campo])
            for val in v.values():
                if isinstance(val, str) and len(val) > 20:
                    return val
            return str(v)
        if isinstance(v, list):
            return "; ".join(str(i) for i in v if i)
        return str(v)

    @staticmethod
    def _sanitizar_lista(v: Any) -> list[str]:
        """
        Garante que um campo esperado como list[str] seja realmente uma lista de strings limpas.
        Trata casos onde o LLM retorna um dict, uma string JSON, etc.
        """
        if v is None:
            return []
        if isinstance(v, str):
            stripped = v.strip()
            if stripped.startswith("["):
                try:
                    parsed = json.loads(stripped)
                    if isinstance(parsed, list):
                        v = parsed
                    else:
                        return [stripped] if stripped else []
                except json.JSONDecodeError:
                    return [stripped] if stripped else []
            elif stripped:
                return [stripped]
            else:
                return []
        if isinstance(v, dict):
            # Pode ser {"constatacoes": [...]} — extrai o array
            for val in v.values():
                if isinstance(val, list):
                    return AgenteConsolidador._sanitizar_lista(val)
            return [str(v)]
        if isinstance(v, list):
            resultado = []
            for item in v:
                if isinstance(item, str):
                    resultado.append(item)
                elif isinstance(item, dict):
                    # Extrai o primeiro valor string significativo do dict
                    for val in item.values():
                        if isinstance(val, str) and len(val) > 5:
                            resultado.append(val)
                            break
                    else:
                        resultado.append(str(item))
                elif item is not None:
                    resultado.append(str(item))
            return resultado
        return []

    def _parsear(
        self,
        raw: str,
        pergunta: str,
        market: ResultadoAgente,
        social: ResultadoAgente,
        tokens_anteriores: int,
    ) -> ResultadoConsolidado:
        from pydantic import ValidationError

        if not raw or not raw.strip():
            logger.warning("Agente Consolidador retornou resposta vazia")
            return ResultadoConsolidado(
                municipio=market.municipio,
                codigo_ibge=market.codigo_ibge,
                pergunta=pergunta,
                mercado=market,
                social=social,
                sintese="Consolidação indisponível: resposta vazia do modelo.",
                conclusao="O modelo não retornou conteúdo. Verifique os logs do servidor.",
                modelo_consolidador=self._client.model,
            )

        try:
            texto = self._extrair_json(raw)
            data: dict[str, Any] = json.loads(texto)

            # Os validators do Pydantic em ViabilidadeFinanceira tratam todos os tipos —
            # passamos o dict diretamente sem sanitização manual prévia.
            vf_raw = data.get("viabilidade_financeira")

            return ResultadoConsolidado(
                municipio=market.municipio,
                codigo_ibge=market.codigo_ibge,
                pergunta=pergunta,
                mercado=market,
                social=social,
                sintese=self._sanitizar_string(data.get("sintese", ""), "sintese"),
                viabilidade_financeira=vf_raw,
                convergencias=self._sanitizar_lista(data.get("convergencias", [])),
                divergencias=self._sanitizar_lista(data.get("divergencias", [])),
                dados_insuficientes=self._sanitizar_lista(data.get("dados_insuficientes", [])),
                conclusao=self._sanitizar_string(data.get("conclusao", ""), "conclusao"),
                fontes_consultadas=self._sanitizar_lista(data.get("fontes_consolidadas", [])),
                periodos_referencia=self._sanitizar_lista(data.get("periodos_referencia", [])),
                limitacoes_gerais=self._sanitizar_lista(data.get("limitacoes_gerais", [])),
                modelo_consolidador=self._client.model,
                tokens_totais=tokens_anteriores,
            )
        except (json.JSONDecodeError, ValueError, KeyError, ValidationError) as exc:
            # Log detalhado para diagnóstico — inclui o tipo de erro e os primeiros 500 chars da resposta
            logger.warning(
                "Erro ao parsear resposta do Consolidador (%s: %s). "
                "Raw (primeiros 500 chars): %.500s",
                type(exc).__name__, exc, raw,
            )
            # Tenta extrair a sintese limpa mesmo da resposta malformada
            sintese_fallback = ""
            try:
                texto = self._extrair_json(raw)
                data_parcial = json.loads(texto)
                sintese_fallback = self._sanitizar_string(data_parcial.get("sintese", ""), "sintese")
            except Exception:
                sintese_fallback = self._sanitizar_string(raw[:800], "sintese")
            return ResultadoConsolidado(
                municipio=market.municipio,
                codigo_ibge=market.codigo_ibge,
                pergunta=pergunta,
                mercado=market,
                social=social,
                sintese=sintese_fallback or "Análise parcialmente concluída — formato de resposta inesperado.",
                conclusao=(
                    f"Análise gerada com limitações ({type(exc).__name__}). "
                    "Consulte os dados dos pilares de Mercado e Social abaixo."
                ),
                modelo_consolidador=self._client.model,
            )
