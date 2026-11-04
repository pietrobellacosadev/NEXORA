"""
Agente de Mercado — investiga o potencial comercial e técnico
de expansão da conectividade para um município paulista.

Consulta indicadores de:
- Características econômicas e demográficas
- Telefonia móvel e internet fixa (ANATEL)
- Presença de operadoras e provedores
- Oportunidades comerciais identificadas

Retorna ResultadoAgente com constatações, evidências, fontes e limitações.
Nunca inventa dados. Trata ausência de informação explicitamente.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.schemas import (
    TarefaAgente, ResultadoAgente, EvidenciaIndicador,
    TipoAgente, TipoDado,
)
from app.services.groq_client import GroqClient, GroqError, make_client

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é o Agente de Mercado do NEXORA, especialista em análise de potencial comercial de conectividade para municípios do Estado de São Paulo.

Suas responsabilidades:
- Investigar características econômicas e demográficas do município
- Analisar indicadores de telefonia móvel e internet fixa
- Identificar presença de operadoras e provedores (dados ANATEL quando disponíveis)
- Identificar oportunidades comerciais de expansão da conectividade
- Apontar limitações e dados ausentes com clareza

Regras obrigatórias:
- NUNCA invente indicadores, valores ou fontes
- Se um dado não estiver disponível, informe explicitamente como "indisponível"
- Não trate ausência de dado como valor zero
- Não confunda acessos contratados com cobertura geográfica
- Não infira renda disponível diretamente do PIB municipal
- Baseie-se apenas em dados oficiais: IBGE, ANATEL, fontes governamentais
- Apresente sempre: fonte, período de referência e limitações metodológicas

Responda APENAS em JSON válido, sem texto fora do JSON, seguindo exatamente o schema fornecido."""

SCHEMA_RESPOSTA = {
    "constatacoes": ["lista de constatações objetivas sobre o potencial de mercado"],
    "evidencias": [
        {
            "nome": "nome do indicador",
            "valor": "valor ou null se indisponível",
            "unidade": "unidade de medida ou null",
            "fonte": "fonte oficial",
            "periodo": "período de referência",
            "tipo": "oficial|calculado|estimado|indisponivel",
            "limitacoes": "limitações metodológicas ou null"
        }
    ],
    "fontes": ["lista de fontes consultadas"],
    "periodos": ["lista de períodos de referência"],
    "limitacoes": ["limitações gerais da análise"],
    "dados_ausentes": ["dados relevantes que não foram encontrados"]
}


class AgenteMarket:
    def __init__(self) -> None:
        self._client: GroqClient = make_client(TipoAgente.MARKET.value)

    async def investigar(self, tarefa: TarefaAgente) -> ResultadoAgente:
        """Executa a investigação de potencial de mercado para o município."""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Município: {tarefa.nome_municipio} (código IBGE: {tarefa.codigo_ibge})\n"
                    f"Estado: São Paulo\n"
                    f"Pergunta: {tarefa.pergunta}\n\n"
                    f"Analise o potencial de mercado para expansão da conectividade neste município.\n"
                    f"Responda no formato JSON exatamente conforme este schema:\n"
                    f"{json.dumps(SCHEMA_RESPOSTA, ensure_ascii=False, indent=2)}"
                ),
            },
        ]

        try:
            resposta_raw = await self._client.chat(messages, max_tokens=2048, temperature=0.1)
            return self._parsear(resposta_raw, tarefa)
        except GroqError as exc:
            logger.error("Agente de Mercado falhou: %s", exc)
            return ResultadoAgente(
                agente=TipoAgente.MARKET,
                municipio=tarefa.nome_municipio,
                codigo_ibge=tarefa.codigo_ibge,
                erro=str(exc),
                modelo_usado=self._client.model,
            )

    def _parsear(self, raw: str, tarefa: TarefaAgente) -> ResultadoAgente:
        """Converte a resposta JSON do modelo no schema ResultadoAgente."""
        try:
            # Remove possíveis blocos de código markdown
            texto = raw.strip()
            if texto.startswith("```"):
                texto = texto.split("```")[1]
                if texto.startswith("json"):
                    texto = texto[4:]
                texto = texto.strip()

            data: dict[str, Any] = json.loads(texto)

            evidencias = [
                EvidenciaIndicador(
                    nome=e.get("nome", ""),
                    valor=e.get("valor"),
                    unidade=e.get("unidade"),
                    fonte=e.get("fonte", "não informada"),
                    periodo=e.get("periodo", "não informado"),
                    tipo=TipoDado(e.get("tipo", "indisponivel")),
                    limitacoes=e.get("limitacoes"),
                )
                for e in data.get("evidencias", [])
            ]

            return ResultadoAgente(
                agente=TipoAgente.MARKET,
                municipio=tarefa.nome_municipio,
                codigo_ibge=tarefa.codigo_ibge,
                constatacoes=data.get("constatacoes", []),
                evidencias=evidencias,
                fontes=data.get("fontes", []),
                periodos=data.get("periodos", []),
                limitacoes=data.get("limitacoes", []),
                dados_ausentes=data.get("dados_ausentes", []),
                modelo_usado=self._client.model,
            )
        except (json.JSONDecodeError, ValueError, KeyError) as exc:
            logger.warning("Erro ao parsear resposta do Agente de Mercado: %s", exc)
            return ResultadoAgente(
                agente=TipoAgente.MARKET,
                municipio=tarefa.nome_municipio,
                codigo_ibge=tarefa.codigo_ibge,
                constatacoes=[raw[:500]],  # preserva parte da resposta para diagnóstico
                erro=f"Resposta fora do formato esperado: {exc}",
                modelo_usado=self._client.model,
            )
