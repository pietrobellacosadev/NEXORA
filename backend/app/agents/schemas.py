"""
Contratos de comunicação entre os três agentes do NEXORA.
Define os schemas de entrada, saída e mensagens entre agentes.
"""
from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import Any, Optional
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

    @classmethod
    def _missing_(cls, value: object) -> "TipoDado":
        """Aceita variantes em maiúsculas e grafias alternativas da IA."""
        if isinstance(value, str):
            normalizado = value.strip().lower()
            # Mapeamento de variações conhecidas
            _aliases: dict[str, str] = {
                "oficial":       "oficial",
                "calculado":     "calculado",
                "calculada":     "calculado",
                "estimado":      "estimado",
                "estimada":      "estimado",
                "interpretado":  "interpretado",
                "interpretada":  "interpretado",
                "indisponivel":  "indisponivel",
                "indisponível":  "indisponivel",
                "unavailable":   "indisponivel",
                "n/a":           "indisponivel",
                "na":            "indisponivel",
            }
            chave = _aliases.get(normalizado)
            if chave:
                return cls(chave)
        return cls.INDISPONIVEL


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

# ── Helpers de coerção reutilizáveis ─────────────────────────────────────────

def _coerce_str(v: Any) -> Optional[str]:
    """Normaliza qualquer valor retornado pela IA para Optional[str]."""
    if v is None:
        return None
    if isinstance(v, str):
        return v if v.strip() else None
    if isinstance(v, list):
        partes = [str(i).strip() for i in v if i not in (None, "", [])]
        return "; ".join(partes) if partes else None
    if isinstance(v, dict):
        # Tenta extrair o primeiro valor string significativo
        for val in v.values():
            if isinstance(val, str) and val.strip():
                return val.strip()
        return str(v)
    return str(v) if str(v).strip() else None


def _coerce_float(v: Any) -> Optional[float]:
    """
    Normaliza valores numéricos retornados pela IA para Optional[float].
    Aceita: float, int, string numérica com ou sem formatação BR (1.500.000 / R$ 2,5M).
    """
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        # Remove prefixo monetário e sufixos de unidade
        s = s.upper().replace("R$", "").replace("BRL", "").strip()
        # Trata abreviações: 2,5M → 2500000; 4.5K → 4500
        multiplier = 1.0
        if s.endswith("M"):
            multiplier = 1_000_000.0
            s = s[:-1].strip()
        elif s.endswith("K"):
            multiplier = 1_000.0
            s = s[:-1].strip()
        # Normaliza separadores BR: 1.500.000 → 1500000; 2,5 → 2.5
        # Heurística: se há vírgula e ponto, o último é o decimal
        if "," in s and "." in s:
            # ex: "1.500.000,50" → float
            s = s.replace(".", "").replace(",", ".")
        elif "," in s and "." not in s:
            # ex: "2,5" → "2.5"
            s = s.replace(",", ".")
        else:
            # Remove pontos de milhar isolados: "1.500.000" (sem vírgula)
            # Só remove pontos de milhar se o padrão bater (grupos de 3 dígitos)
            import re as _re
            if _re.fullmatch(r"\d{1,3}(\.\d{3})+", s):
                s = s.replace(".", "")
        try:
            return float(s) * multiplier
        except ValueError:
            return None
    if isinstance(v, list) and len(v) > 0:
        return _coerce_float(v[0])
    return None


class CustoEstimado(BaseModel):
    tipo_rede: Optional[str] = None                  # ex: "FTTH", "WISP/LTE"
    custo_total_min_reais: Optional[float] = None
    custo_total_max_reais: Optional[float] = None
    custo_por_domicilio: Optional[str] = None
    payback_estimado_anos: Optional[str] = None
    classificacao_retorno: Optional[str] = None       # "ALTO", "MÉDIO", "BAIXO"
    premissas: Optional[str] = None

    @field_validator(
        "tipo_rede", "custo_por_domicilio", "payback_estimado_anos",
        "classificacao_retorno", "premissas",
        mode="before",
    )
    @classmethod
    def coerce_str_fields(cls, v: Any) -> Optional[str]:
        return _coerce_str(v)

    @field_validator("custo_total_min_reais", "custo_total_max_reais", mode="before")
    @classmethod
    def coerce_float_fields(cls, v: Any) -> Optional[float]:
        return _coerce_float(v)


class ImpactoEstimado(BaseModel):
    domicilios_beneficiados: Optional[str] = None
    escolas_beneficiadas: Optional[str] = None
    reducao_exclusao_digital_pct: Optional[str] = None
    observacoes: Optional[str] = None

    @field_validator(
        "domicilios_beneficiados", "escolas_beneficiadas",
        "reducao_exclusao_digital_pct", "observacoes",
        mode="before",
    )
    @classmethod
    def coerce_str_fields(cls, v: Any) -> Optional[str]:
        return _coerce_str(v)


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
    # list[str] — a IA retorna um array; coercemos string ou None para list[str]
    financiamentos_disponiveis: list[str] = Field(default_factory=list)
    # Campos expandidos para análise detalhada de analista
    potencial_mercado: Optional[str] = None       # avaliação narrativa do potencial de mercado
    potencial_social: Optional[str] = None        # avaliação narrativa do impacto social
    tecnologia_recomendada: Optional[str] = None  # FTTH / WISP / LTE / 5G / misto
    justificativa: Optional[str] = None           # por que essa tecnologia
    riscos: Optional[str] = None                  # principais riscos do projeto
    recomendacao_analista: Optional[str] = None   # recomendação objetiva final

    @field_validator("financiamentos_disponiveis", mode="before")
    @classmethod
    def coerce_financiamentos(cls, v: Any) -> list[str]:
        """Aceita list, string CSV, None — sempre devolve list[str] limpa."""
        if v is None:
            return []
        if isinstance(v, list):
            return [str(i).strip() for i in v if i and str(i).strip()]
        if isinstance(v, str):
            stripped = v.strip()
            if not stripped:
                return []
            # Pode ser uma string JSON como '["FUST","BNDES"]'
            if stripped.startswith("["):
                import json as _json
                try:
                    parsed = _json.loads(stripped)
                    if isinstance(parsed, list):
                        return [str(i).strip() for i in parsed if i and str(i).strip()]
                except (_json.JSONDecodeError, ValueError):
                    pass
            # String CSV: "FUST, BNDES Telecom, PNBL"
            return [p.strip() for p in stripped.split(",") if p.strip()]
        return [str(v)] if str(v).strip() else []

    @field_validator(
        "tipo_rede_recomendado", "investimento_estimado_range", "payback_anos",
        "classificacao", "potencial_mercado", "potencial_social",
        "tecnologia_recomendada", "justificativa", "riscos", "recomendacao_analista",
        mode="before",
    )
    @classmethod
    def coerce_any_to_str(cls, v: Any) -> Optional[str]:
        return _coerce_str(v)


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
