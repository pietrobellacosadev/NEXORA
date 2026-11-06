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

SYSTEM_PROMPT = """Agente Consolidador NEXORA — integra análises de Mercado e Social sobre instalação de internet em municípios paulistas, incluindo viabilidade financeira.

Sua função: sintetizar as análises dos dois pilares e produzir uma visão integrada de viabilidade.

REGRAS OBRIGATÓRIAS:
1. Compare os dois pilares (mercado e social) de forma equilibrada.
2. Inclua na síntese: viabilidade técnica, custo estimado de implantação e retorno esperado.
3. Indique claramente o tipo de rede mais adequado para o município (FTTH, WISP, LTE, misto).
4. Mencione programas de financiamento público aplicáveis (FUST, BNDES, PNBL, editais ANATEL).
5. Nunca invente dados — use apenas o que foi fornecido pelos agentes especialistas.
6. Responda APENAS em JSON válido sem markdown."""

SCHEMA_INSTRUCAO = 'Retorne JSON com: "sintese" (string descrevendo viabilidade geral, tipo de rede recomendado E custo consolidado), "viabilidade_financeira" (objeto com {tipo_rede_recomendado,investimento_estimado_range,payback_anos,classificacao,financiamentos_disponiveis}), "convergencias" (array), "divergencias" (array), "dados_insuficientes" (array), "conclusao" (string com recomendação final objetiva), "fontes_consolidadas" (array), "periodos_referencia" (array), "limitacoes_gerais" (array).'


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
        # Pequeno delay antes do consolidador para aliviar pressão no TPM da janela de 60s.
        resultado_market = await self._market.investigar(tarefa_market)
        resultado_social = await self._social.investigar(tarefa_social)
        await asyncio.sleep(5)

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
            "fontes": market.fontes,
            "periodos": market.periodos,
            "limitacoes": market.limitacoes,
            "dados_ausentes": market.dados_ausentes,
            "erro": market.erro,
        }
        resumo_social = {
            "constatacoes": social.constatacoes,
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
                messages, max_tokens=1000, temperature=0.1, json_mode=True,
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

    def _parsear(
        self,
        raw: str,
        pergunta: str,
        market: ResultadoAgente,
        social: ResultadoAgente,
        tokens_anteriores: int,
    ) -> ResultadoConsolidado:
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

            return ResultadoConsolidado(
                municipio=market.municipio,
                codigo_ibge=market.codigo_ibge,
                pergunta=pergunta,
                mercado=market,
                social=social,
                sintese=data.get("sintese", ""),
                viabilidade_financeira=data.get("viabilidade_financeira"),
                convergencias=data.get("convergencias", []),
                divergencias=data.get("divergencias", []),
                dados_insuficientes=data.get("dados_insuficientes", []),
                conclusao=data.get("conclusao", ""),
                fontes_consultadas=data.get("fontes_consolidadas", []),
                periodos_referencia=data.get("periodos_referencia", []),
                limitacoes_gerais=data.get("limitacoes_gerais", []),
                modelo_consolidador=self._client.model,
                tokens_totais=tokens_anteriores,
            )
        except (json.JSONDecodeError, ValueError, KeyError) as exc:
            logger.warning("Erro ao parsear resposta do Consolidador: %s", exc)
            return ResultadoConsolidado(
                municipio=market.municipio,
                codigo_ibge=market.codigo_ibge,
                pergunta=pergunta,
                mercado=market,
                social=social,
                sintese=raw[:500],
                conclusao=f"Resposta fora do formato esperado: {exc}",
                modelo_consolidador=self._client.model,
            )
