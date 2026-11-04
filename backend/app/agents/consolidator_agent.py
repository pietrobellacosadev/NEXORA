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
from typing import Any

from app.agents.schemas import (
    TarefaAgente, ResultadoAgente, ResultadoConsolidado,
    TipoAgente,
)
from app.agents.market_agent import AgenteMarket
from app.agents.social_agent import AgenteSocial
from app.services.groq_client import GroqClient, GroqError, make_client

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é o Agente Consolidador do NEXORA, responsável por integrar as análises dos Agentes de Mercado e Social sobre municípios paulistas.

Suas responsabilidades:
- Receber os resultados dos dois agentes especialistas
- Verificar a coerência das evidências apresentadas
- Identificar convergências entre os pilares de mercado e social
- Identificar divergências e possíveis contradições
- Identificar dados insuficientes ou ausentes nos dois pilares
- Produzir uma síntese equilibrada, sem priorizar um pilar sobre o outro
- Formular uma conclusão fundamentada, sem inventar informações
- Apresentar fontes, períodos e limitações de forma consolidada

Regras obrigatórias:
- NUNCA invente dados, fontes ou conclusões sem evidências suficientes
- Quando não houver informação suficiente, informe explicitamente
- Não substitua lacunas com suposições ou estimativas não fundamentadas
- Mantenha equilíbrio entre potencial de mercado e potencial social
- A decisão final é do usuário — não faça recomendações prescritivas

Responda APENAS em JSON válido, sem texto fora do JSON, seguindo exatamente o schema fornecido."""

SCHEMA_RESPOSTA = {
    "sintese": "parágrafo de síntese integrada dos dois pilares",
    "convergencias": ["pontos em que mercado e social apontam na mesma direção"],
    "divergencias": ["pontos em que há tensão ou contradição entre os pilares"],
    "dados_insuficientes": ["informações que limitaram a análise nos dois pilares"],
    "conclusao": "conclusão fundamentada e equilibrada, sem prescrição",
    "fontes_consolidadas": ["fontes referenciadas na síntese"],
    "periodos_referencia": ["períodos cobertos pela análise"],
    "limitacoes_gerais": ["limitações gerais que afetam a confiabilidade da análise"]
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
    ) -> ResultadoConsolidado:
        """
        Orquestra a investigação completa:
        1. Aciona Mercado e Social em paralelo
        2. Consolida os resultados
        """
        tarefa = TarefaAgente(
            codigo_ibge=codigo_ibge,
            nome_municipio=nome_municipio,
            pergunta=pergunta,
        )

        # Execução paralela dos agentes especialistas
        resultado_market, resultado_social = await asyncio.gather(
            self._market.investigar(tarefa),
            self._social.investigar(tarefa),
        )

        return await self._consolidar(pergunta, resultado_market, resultado_social)

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
                    f"Pergunta original: {pergunta}\n\n"
                    f"=== RESULTADO DO AGENTE DE MERCADO ===\n"
                    f"{json.dumps(resumo_market, ensure_ascii=False, indent=2)}\n\n"
                    f"=== RESULTADO DO AGENTE SOCIAL ===\n"
                    f"{json.dumps(resumo_social, ensure_ascii=False, indent=2)}\n\n"
                    f"Produza a síntese consolidada no formato JSON conforme este schema:\n"
                    f"{json.dumps(SCHEMA_RESPOSTA, ensure_ascii=False, indent=2)}"
                ),
            },
        ]

        tokens_market = market.tokens_usados or 0
        tokens_social = social.tokens_usados or 0

        try:
            resposta_raw = await self._client.chat(messages, max_tokens=2048, temperature=0.1)
            return self._parsear(resposta_raw, pergunta, market, social, tokens_market + tokens_social)
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

    def _parsear(
        self,
        raw: str,
        pergunta: str,
        market: ResultadoAgente,
        social: ResultadoAgente,
        tokens_anteriores: int,
    ) -> ResultadoConsolidado:
        try:
            texto = raw.strip()
            if texto.startswith("```"):
                texto = texto.split("```")[1]
                if texto.startswith("json"):
                    texto = texto[4:]
                texto = texto.strip()

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
