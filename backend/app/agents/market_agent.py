"""
Agente de Mercado — investiga o potencial comercial e técnico
de expansão da conectividade para um município paulista.

Consulta indicadores do banco de dados (IBGE/ANATEL) e interpreta os dados
com o modelo de linguagem. Retorna ResultadoAgente com constatações,
evidências, fontes e limitações. Nunca inventa dados.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.agents.schemas import (
    TarefaAgente, ResultadoAgente, EvidenciaIndicador,
    TipoAgente, TipoDado,
)
from app.services.groq_client import GroqClient, GroqError, make_client

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Agente de Mercado NEXORA — viabilidade comercial e custos de implantação de internet em municípios paulistas.

Sua função: analisar indicadores reais do município e estimar a viabilidade de mercado para expansão de conectividade.

REGRAS OBRIGATÓRIAS:
1. Baseie-se EXCLUSIVAMENTE nos indicadores fornecidos — nunca invente valores.
2. Se um indicador estiver indisponível, diga explicitamente.
3. Inclua SEMPRE uma análise de custos de implantação baseada nos seguintes referenciais reais brasileiros:
   - FTTH (fibra até o domicílio): R$ 800–1.500/domicílio passado; R$ 1.200–2.500/domicílio ativado
   - Backhaul de fibra óptica: R$ 15.000–80.000/km (varia por área urbana/rural)
   - Infraestrutura wireless (WISP/LTE rural): R$ 120.000–400.000 por ERB com cobertura de 5–15 km
   - GPON OLT + splitters: R$ 25.000–80.000 por nó ativo (1:64, até 64 domicílios)
   - Fonte: ABINC, ANATEL, BNDESpar, Telebrasil (dados 2022–2024)
4. Calcule a estimativa de investimento usando a população/domicílios do município quando disponível.
5. Classifique o potencial de retorno: ALTO (payback < 3 anos), MÉDIO (3–6 anos), BAIXO (> 6 anos).
6. Responda APENAS em JSON válido sem markdown."""

SCHEMA_INSTRUCAO = 'Retorne JSON com chaves: "constatacoes" (array de strings com análise de mercado E custos), "custo_estimado" (objeto com {tipo_rede,custo_total_min_reais,custo_total_max_reais,custo_por_domicilio,payback_estimado_anos,classificacao_retorno,premissas}), "evidencias" (array de {nome,valor,unidade,fonte,periodo,tipo,limitacoes}), "fontes" (array), "periodos" (array), "limitacoes" (array), "dados_ausentes" (array).'


def _extrair_json(raw: str) -> str:
    """Remove markdown fences e extrai o conteúdo JSON da resposta."""
    texto = raw.strip()

    # Remove blocos ```json ... ``` ou ``` ... ```
    fence = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", texto)
    if fence:
        return fence.group(1).strip()

    # Se começa com ``` mas não fecha (truncamento), remove o prefixo
    if texto.startswith("```"):
        texto = re.sub(r"^```\w*\s*", "", texto).strip()

    # Localiza o primeiro { e o último } para isolar o objeto JSON
    start = texto.find("{")
    end = texto.rfind("}")
    if start != -1 and end > start:
        return texto[start:end + 1]

    return texto


class AgenteMarket:
    def __init__(self) -> None:
        self._client: GroqClient = make_client(TipoAgente.MARKET.value)

    async def investigar(self, tarefa: TarefaAgente) -> ResultadoAgente:
        """Executa a investigação de potencial de mercado para o município."""
        contexto = tarefa.contexto_extra or "Nenhum indicador de mercado disponível no banco de dados."

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Município: {tarefa.nome_municipio} ({tarefa.codigo_ibge}) — SP\n"
                    f"Pergunta: {tarefa.pergunta}\n\n"
                    f"INDICADORES DE MERCADO:\n{contexto}\n\n"
                    f"{SCHEMA_INSTRUCAO}"
                ),
            },
        ]

        try:
            resposta_raw = await self._client.chat(
                messages, max_tokens=1200, temperature=0.1, json_mode=False
            )
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
        if not raw or not raw.strip():
            logger.warning("Agente de Mercado retornou resposta vazia")
            return ResultadoAgente(
                agente=TipoAgente.MARKET,
                municipio=tarefa.nome_municipio,
                codigo_ibge=tarefa.codigo_ibge,
                erro="Resposta vazia do modelo.",
                modelo_usado=self._client.model,
            )

        try:
            texto = _extrair_json(raw)
            data: dict[str, Any] = json.loads(texto)

            evidencias = [
                EvidenciaIndicador(
                    nome=e.get("nome", ""),
                    valor=str(e["valor"]) if e.get("valor") is not None else None,
                    unidade=e.get("unidade"),
                    fonte=e.get("fonte", "não informada"),
                    periodo=e.get("periodo", "não informado"),
                    tipo=TipoDado(e.get("tipo", "indisponivel")),
                    limitacoes=e.get("limitacoes"),
                )
                for e in data.get("evidencias", [])
                if isinstance(e, dict)
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
                custo_estimado=data.get("custo_estimado"),
                modelo_usado=self._client.model,
            )

        except (json.JSONDecodeError, ValueError, KeyError) as exc:
            logger.warning(
                "Erro ao parsear resposta do Agente de Mercado (%s). Raw (primeiros 300 chars): %.300s",
                exc, raw,
            )
            return ResultadoAgente(
                agente=TipoAgente.MARKET,
                municipio=tarefa.nome_municipio,
                codigo_ibge=tarefa.codigo_ibge,
                constatacoes=[raw[:300]] if raw else [],
                erro=f"Resposta fora do formato esperado: {exc}",
                modelo_usado=self._client.model,
            )
