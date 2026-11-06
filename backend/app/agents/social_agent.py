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

SYSTEM_PROMPT = """Você é o Agente Social do NEXORA, especialista em análise do impacto e necessidade social para instalação de internet em municípios do Estado de São Paulo.

Contexto do projeto: O NEXORA apoia provedores de internet (ISPs) e operadoras na decisão de onde instalar ou expandir redes de banda larga. O pilar social avalia a necessidade da população por conectividade e o impacto social que a instalação de internet traria.

Suas responsabilidades:
- Responder à pergunta específica do usuário usando os indicadores sociais fornecidos
- Avaliar a necessidade social de conectividade: inclusão digital, acesso a serviços públicos online, educação, saúde
- Identificar populações vulneráveis que se beneficiariam mais da instalação de internet
- Analisar barreiras socioeconômicas para adoção da internet (pobreza, alfabetização)
- Focar as constatações diretamente no que foi perguntado — não faça análise genérica

Indicadores-chave para avaliar necessidade social de internet:
- acesso_internet_domiciliar: percentual de domicílios já conectados (inversamente indica exclusão digital)
- indice_inclusao_digital: medida de inclusão digital da população
- idhm: desenvolvimento humano geral — impacta disposição e capacidade de adotar internet
- taxa_alfabetizacao: capacidade da população de utilizar internet
- escolas_publicas: demanda por internet para educação
- unidades_basicas_saude: demanda por telemedicina e serviços de saúde digitais
- pobreza_extrema_pct: barreira econômica para contratação de planos

Regras obrigatórias:
- Baseie suas constatações EXCLUSIVAMENTE nos indicadores fornecidos
- NUNCA invente indicadores, valores ou fontes além dos fornecidos
- Se um indicador estiver marcado como 'indisponivel', mencione a ausência explicitamente
- Não trate ausência de dado como valor zero
- Não confunda área geográfica com cobertura de serviço
- Apresente sempre a fonte e o período conforme fornecidos
- Não faça afirmações que não estejam respaldadas pelos dados fornecidos
- Cada constatação deve ser diretamente relevante para a pergunta feita

Responda APENAS em JSON válido, sem texto fora do JSON, sem blocos de código markdown."""

SCHEMA_RESPOSTA = {
    "constatacoes": ["lista de constatações objetivas que respondem diretamente à pergunta, baseadas nos dados fornecidos"],
    "evidencias": [
        {
            "nome": "nome do indicador",
            "valor": "valor formatado ou null se indisponível",
            "unidade": "unidade de medida ou null",
            "fonte": "fonte conforme fornecida",
            "periodo": "período conforme fornecido",
            "tipo": "oficial|calculado|estimado|interpretado|indisponivel",
            "limitacoes": "limitações metodológicas ou null"
        }
    ],
    "fontes": ["lista de fontes dos dados fornecidos"],
    "periodos": ["lista de períodos dos dados fornecidos"],
    "limitacoes": ["limitações da análise com base nos dados disponíveis"],
    "dados_ausentes": ["indicadores que seriam úteis para responder à pergunta mas estão indisponíveis"]
}


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
                    f"Município: {tarefa.nome_municipio} (código IBGE: {tarefa.codigo_ibge})\n"
                    f"Estado: São Paulo\n"
                    f"Pergunta: {tarefa.pergunta}\n\n"
                    f"=== INDICADORES SOCIAIS DO BANCO DE DADOS NEXORA ===\n"
                    f"{contexto}\n\n"
                    f"Com base EXCLUSIVAMENTE nos indicadores sociais acima, responda à pergunta: \"{tarefa.pergunta}\"\n"
                    f"Foque as constatações naquilo que a pergunta pede — não faça análise genérica.\n"
                    f"Responda em JSON válido exatamente conforme este schema:\n"
                    f"{json.dumps(SCHEMA_RESPOSTA, ensure_ascii=False, indent=2)}"
                ),
            },
        ]

        try:
            resposta_raw = await self._client.chat(
                messages, max_tokens=8192, temperature=0.1, json_mode=True
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
