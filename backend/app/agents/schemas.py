"""
Contratos de comunicação entre os três agentes do NEXORA.
Define os schemas de entrada, saída e mensagens entre agentes.
"""
from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from enum import Enum


class TipoAgente(str, Enum):
    MARKET = "market"
    SOCIAL = "social"
    CONSOLIDATOR = "consolidator"


class TipoDado(str, Enum):
    OFICIAL = "oficial"
    CALCULADO = "calculado"
    ESTIMADO = "estimado"
    INTERPRETADO = "interpretado"
    INDISPONIVEL = "indisponivel"


# ── Entrada comum para qualquer agente ───────────────────────────────────────

class TarefaAgente(BaseModel):
    codigo_ibge: str
    nome_municipio: str
    pergunta: str
    contexto_extra: Optional[str] = None  # dados já coletados, se houver


# ── Resultado de um indicador individual ──────────────────────────────────────

class EvidenciaIndicador(BaseModel):
    nome: str
    valor: Optional[str] = None           # None = indisponível
    unidade: Optional[str] = None
    fonte: str
    periodo: str
    tipo: TipoDado
    limitacoes: Optional[str] = None


# ── Resultado de um agente especialista ───────────────────────────────────────

class CustoEstimado(BaseModel):
    tipo_rede: Optional[str] = None                  # ex: "FTTH", "WISP/LTE"
    custo_total_min_reais: Optional[float] = None
    custo_total_max_reais: Optional[float] = None
    custo_por_domicilio: Optional[str] = None
    payback_estimado_anos: Optional[str] = None
    classificacao_retorno: Optional[str] = None       # "ALTO", "MÉDIO", "BAIXO"
    premissas: Optional[str] = None


class ImpactoEstimado(BaseModel):
    domicilios_beneficiados: Optional[str] = None
    escolas_beneficiadas: Optional[str] = None
    reducao_exclusao_digital_pct: Optional[str] = None
    observacoes: Optional[str] = None


class ResultadoAgente(BaseModel):
    agente: TipoAgente
    municipio: str
    codigo_ibge: str
    constatacoes: list[str] = Field(default_factory=list)
    evidencias: list[EvidenciaIndicador] = Field(default_factory=list)
    fontes: list[str] = Field(default_factory=list)
    periodos: list[str] = Field(default_factory=list)
    limitacoes: list[str] = Field(default_factory=list)
    dados_ausentes: list[str] = Field(default_factory=list)
    custo_estimado: Optional[CustoEstimado] = None       # estimativa de custos (agente market)
    programas_elegiveis: list[str] = Field(default_factory=list)  # programas públicos (agente social)
    impacto_estimado: Optional[ImpactoEstimado] = None   # impacto social esperado
    modelo_usado: str = ""
    tokens_usados: Optional[int] = None
    erro: Optional[str] = None           # preenchido se o agente falhou


# ── Resultado final do Consolidador ───────────────────────────────────────────

class ViabilidadeFinanceira(BaseModel):
    tipo_rede_recomendado: Optional[str] = None
    investimento_estimado_range: Optional[str] = None
    payback_anos: Optional[str] = None
    classificacao: Optional[str] = None          # "ALTO", "MÉDIO", "BAIXO"
    financiamentos_disponiveis: Optional[str] = None
    # Campos expandidos para análise detalhada de analista
    potencial_mercado: Optional[str] = None       # avaliação narrativa do potencial de mercado
    potencial_social: Optional[str] = None        # avaliação narrativa do impacto social
    tecnologia_recomendada: Optional[str] = None  # FTTH / WISP / LTE / 5G / misto
    justificativa: Optional[str] = None           # por que essa tecnologia
    riscos: Optional[str] = None                  # principais riscos do projeto
    recomendacao_analista: Optional[str] = None   # recomendação objetiva final

    @field_validator("financiamentos_disponiveis", mode="before")
    @classmethod
    def coerce_financiamentos(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, list):
            return ", ".join(str(i) for i in v if i)
        return str(v) if v else None

    @field_validator(
        "tipo_rede_recomendado", "investimento_estimado_range", "payback_anos",
        "classificacao", "potencial_mercado", "potencial_social",
        "tecnologia_recomendada", "justificativa", "riscos", "recomendacao_analista",
        mode="before",
    )
    @classmethod
    def coerce_any_to_str(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, list):
            return "; ".join(str(i) for i in v if i)
        return str(v) if v else None


class ResultadoConsolidado(BaseModel):
    municipio: str
    codigo_ibge: str
    pergunta: str

    # Resultados dos agentes especialistas
    mercado: ResultadoAgente
    social: ResultadoAgente

    # Síntese do Consolidador
    sintese: str
    viabilidade_financeira: Optional[ViabilidadeFinanceira] = None
    convergencias: list[str] = Field(default_factory=list)
    divergencias: list[str] = Field(default_factory=list)
    dados_insuficientes: list[str] = Field(default_factory=list)
    conclusao: str

    # Rastreabilidade
    fontes_consultadas: list[str] = Field(default_factory=list)
    periodos_referencia: list[str] = Field(default_factory=list)
    limitacoes_gerais: list[str] = Field(default_factory=list)

    # Meta
    modelo_consolidador: str = ""
    tokens_totais: Optional[int] = None
    is_ia: bool = True                   # sempre True — identifica resposta gerada por IA
