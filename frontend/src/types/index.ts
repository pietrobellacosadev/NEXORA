// ─── Municípios ──────────────────────────────────────────────────────────────

export interface MunicipioResumo {
  codigo_ibge: string
  nome: string
  regiao_administrativa?: string
  populacao?: number
}

export interface MunicipioLista {
  total: number
  municipios: MunicipioResumo[]
}

export interface IndicadorValor {
  nome: string
  valor: number | null
  unidade: string
  fonte: string
  ano: number
  limitacoes?: string
  tipo: 'oficial' | 'calculado' | 'estimado' | 'indisponivel'
}

export interface PerfilMunicipio {
  municipio: MunicipioResumo
  mercado: IndicadorValor[]
  social: IndicadorValor[]
}

// ─── Agentes ─────────────────────────────────────────────────────────────────

export type PilarTipo = 'mercado' | 'social'
export type ContextoConectividade = 'movel' | 'fixa'

export interface ResultadoAgente {
  pilar: PilarTipo
  constatacoes: string[]
  indicadores_utilizados: string[]
  fontes: string[]
  periodos: string[]
  limitacoes: string[]
  dados_ausentes: string[]
}

export interface ResultadoConsolidador {
  municipio: string
  pergunta: string
  sintese: string
  mercado: ResultadoAgente
  social: ResultadoAgente
  convergencias: string[]
  divergencias: string[]
  dados_insuficientes: string[]
  conclusao: string
  is_ia: true
}

// ─── API genérica ─────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'
