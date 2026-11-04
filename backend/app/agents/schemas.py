"""
Contratos de comunicação entre os três agentes do NEXORA.
Define os schemas de entrada, saída e mensagens entre agentes.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
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
    modelo_usado: str = ""
    tokens_usados: Optional[int] = None
    erro: Optional[str] = None           # preenchido se o agente falhou


# ── Resultado final do Consolidador ───────────────────────────────────────────

class ResultadoConsolidado(BaseModel):
    municipio: str
    codigo_ibge: str
    pergunta: str

    # Resultados dos agentes especialistas
    mercado: ResultadoAgente
    social: ResultadoAgente

    # Síntese do Consolidador
    sintese: str
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
