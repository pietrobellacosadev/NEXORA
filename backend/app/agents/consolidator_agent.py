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

SYSTEM_PROMPT = """Você é o Agente Consolidador do NEXORA, responsável por integrar as análises dos Agentes de Mercado e Social e responder objetivamente à pergunta do usuário sobre instalação ou expansão de internet em municípios paulistas.

Contexto do projeto: O NEXORA apoia provedores de internet (ISPs) e operadoras na decisão estratégica de onde instalar infraestrutura de conectividade (fibra óptica, 4G/5G, banda larga fixa) em municípios do Estado de São Paulo. Sua análise deve sempre ser orientada a esse contexto.

Suas responsabilidades:
- Responder diretamente à pergunta original do usuário com foco em viabilidade de instalação de internet
- Comparar explicitamente o que o pilar de MERCADO e o pilar SOCIAL dizem sobre a pergunta
- Identificar convergências: onde mercado e social chegam à mesma conclusão sobre a viabilidade
- Identificar divergências: onde os pilares apontam em direções opostas (ex.: mercado favorável mas barreira social alta)
- Sinalizar dados insuficientes que impediram uma resposta mais completa
- Formular conclusão orientada à decisão de instalação de internet, sem prescrição definitiva

Regras obrigatórias:
- NUNCA invente dados, fontes ou conclusões sem evidências suficientes
- A síntese deve RESPONDER À PERGUNTA no contexto de instalação de internet
- Compare os pilares explicitamente: "O pilar de mercado indica X, enquanto o pilar social indica Y"
- Quando não houver informação suficiente, informe explicitamente
- Não substitua lacunas com suposições ou estimativas não fundamentadas
- A decisão final é do usuário (ISP/operadora) — não faça recomendações definitivas

Responda APENAS em JSON válido, sem texto fora do JSON, seguindo exatamente o schema fornecido."""

SCHEMA_RESPOSTA = {
    "sintese": "parágrafo que responde à pergunta comparando explicitamente os pilares de mercado e social",
    "convergencias": ["pontos em que mercado e social chegam à mesma conclusão sobre a pergunta"],
    "divergencias": ["pontos em que mercado e social divergem ou se contradizem em relação à pergunta"],
    "dados_insuficientes": ["dados que seriam necessários para responder à pergunta com mais precisão"],
    "conclusao": "resposta direta e equilibrada à pergunta, fundamentada nas evidências dos dois pilares",
    "fontes_consolidadas": ["fontes referenciadas na síntese"],
    "periodos_referencia": ["períodos cobertos pela análise"],
    "limitacoes_gerais": ["limitações que afetam a confiabilidade da resposta à pergunta"]
}


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

        resultado_market, resultado_social = await asyncio.gather(
            self._market.investigar(tarefa_market),
            self._social.investigar(tarefa_social),
        )

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
                    f"Município: {market.municipio} (código IBGE: {market.codigo_ibge})\n"
                    f"Pergunta do usuário: {pergunta}\n\n"
                    f"=== RESULTADO DO AGENTE DE MERCADO ===\n"
                    f"{json.dumps(resumo_market, ensure_ascii=False, indent=2)}\n\n"
                    f"=== RESULTADO DO AGENTE SOCIAL ===\n"
                    f"{json.dumps(resumo_social, ensure_ascii=False, indent=2)}\n\n"
                    f"Responda à pergunta \"{pergunta}\" comparando explicitamente os dois pilares. "
                    f"Produza o JSON conforme este schema:\n"
                    f"{json.dumps(SCHEMA_RESPOSTA, ensure_ascii=False, indent=2)}"
                ),
            },
        ]

        tokens_market = market.tokens_usados or 0
        tokens_social = social.tokens_usados or 0

        try:
            resposta_raw, tokens_consolidador = await self._client.chat(
                messages, max_tokens=4096, temperature=0.1, json_mode=True,
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
