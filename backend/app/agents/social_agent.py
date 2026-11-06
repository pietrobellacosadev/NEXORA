"""
Agente Social — investiga o potencial social e as necessidades
de conectividade de um município paulista.

Consulta indicadores do banco de dados (IBGE/INEP/DATASUS) e interpreta
os dados com o modelo de linguagem. Retorna ResultadoAgente com constatações,
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

SYSTEM_PROMPT = """Agente Social NEXORA — necessidade social, impacto e elegibilidade a programas de conectividade em municípios paulistas.

Sua função: analisar indicadores sociais reais e determinar a urgência e o impacto social da expansão de internet no município.

REGRAS OBRIGATÓRIAS:
1. Baseie-se EXCLUSIVAMENTE nos indicadores fornecidos — nunca invente valores.
2. Se um indicador estiver indisponível, diga explicitamente.
3. Avalie elegibilidade a programas públicos de conectividade com base nos dados:
   - PNBL / Programa Internet para Todos (MCom): municípios com < 30% acesso domiciliar
   - Conta de Internet (ANEEL/Anatel): municípios com vulnerabilidade social e baixo IDH
   - GESAC / EduConecta: escolas públicas sem internet ou com acesso precário
   - Emenda parlamentar e FUST: municípios com população < 30 mil hab em geral elegíveis
4. Quantifique o impacto esperado: nº de domicílios beneficiados, escolas, unidades de saúde.
5. Cite as fontes dos indicadores (IBGE PNAD, IBGE Censo, INEP, DATASUS, IPEA).
6. Responda APENAS em JSON válido sem markdown."""

SCHEMA_INSTRUCAO = 'Retorne JSON com chaves: "constatacoes" (array de strings com análise social E elegibilidade a programas), "programas_elegiveis" (array de strings com nomes de programas e justificativa), "impacto_estimado" (objeto com {domicilios_beneficiados,escolas_beneficiadas,reducao_exclusao_digital_pct,observacoes}), "evidencias" (array de {nome,valor,unidade,fonte,periodo,tipo,limitacoes}), "fontes" (array), "periodos" (array), "limitacoes" (array), "dados_ausentes" (array).'


def _extrair_json(raw: str) -> str:
    """Remove markdown fences e extrai o conteúdo JSON da resposta."""
    texto = raw.strip()

    fence = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", texto)
    if fence:
        return fence.group(1).strip()

    if texto.startswith("```"):
        texto = re.sub(r"^```\w*\s*", "", texto).strip()

    # Localiza o primeiro { e o último } para isolar o objeto JSON
    start = texto.find("{")
    end = texto.rfind("}")
    if start != -1 and end > start:
        return texto[start:end + 1]

    return texto


class AgenteSocial:
    def __init__(self) -> None:
        self._client: GroqClient = make_client(TipoAgente.SOCIAL.value)

    async def investigar(self, tarefa: TarefaAgente) -> ResultadoAgente:
        """Executa a investigação de potencial social para o município."""
        contexto = tarefa.contexto_extra or "Nenhum indicador social disponível no banco de dados."

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Município: {tarefa.nome_municipio} ({tarefa.codigo_ibge}) — SP\n"
                    f"Pergunta: {tarefa.pergunta}\n\n"
                    f"INDICADORES SOCIAIS:\n{contexto}\n\n"
                    f"{SCHEMA_INSTRUCAO}"
                ),
            },
        ]

        try:
            resposta_raw = await self._client.chat(
                messages, max_tokens=1200, temperature=0.1, json_mode=True
            )
            return self._parsear(resposta_raw, tarefa)
        except GroqError as exc:
            logger.error("Agente Social falhou: %s", exc)
            return ResultadoAgente(
                agente=TipoAgente.SOCIAL,
                municipio=tarefa.nome_municipio,
                codigo_ibge=tarefa.codigo_ibge,
                erro=str(exc),
                modelo_usado=self._client.model,
            )

    def _parsear(self, raw: str, tarefa: TarefaAgente) -> ResultadoAgente:
        """Converte a resposta JSON do modelo no schema ResultadoAgente."""
        if not raw or not raw.strip():
            logger.warning("Agente Social retornou resposta vazia")
            return ResultadoAgente(
                agente=TipoAgente.SOCIAL,
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
                agente=TipoAgente.SOCIAL,
                municipio=tarefa.nome_municipio,
                codigo_ibge=tarefa.codigo_ibge,
                constatacoes=data.get("constatacoes", []),
                evidencias=evidencias,
                fontes=data.get("fontes", []),
                periodos=data.get("periodos", []),
                limitacoes=data.get("limitacoes", []),
                dados_ausentes=data.get("dados_ausentes", []),
                programas_elegiveis=data.get("programas_elegiveis", []),
                impacto_estimado=data.get("impacto_estimado"),
                modelo_usado=self._client.model,
            )

        except (json.JSONDecodeError, ValueError, KeyError) as exc:
            logger.warning(
                "Erro ao parsear resposta do Agente Social (%s). Raw (primeiros 300 chars): %.300s",
                exc, raw,
            )
            return ResultadoAgente(
                agente=TipoAgente.SOCIAL,
                municipio=tarefa.nome_municipio,
                codigo_ibge=tarefa.codigo_ibge,
                constatacoes=[raw[:300]] if raw else [],
                erro=f"Resposta fora do formato esperado: {exc}",
                modelo_usado=self._client.model,
            )
