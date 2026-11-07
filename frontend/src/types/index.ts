// ─── Municípios ──────────────────────────────────────────────────────────────

export interface MunicipioResumo {
  codigo_ibge: string
  nome: string
  regiao_administrativa?: string
  mesorregiao?: string
  microrregiao?: string
  populacao_estimada?: number
  // alias legado — mantido para compatibilidade
  populacao?: number
}

export interface MunicipioLista {
  total: number
  municipios: MunicipioResumo[]
}

export interface IndicadorItem {
  chave: string
  nome: string
  valor_num: number | null
  valor_txt: string | null
  unidade: string | null
  fonte: string
  periodo: string
  tipo: 'oficial' | 'calculado' | 'estimado' | 'interpretado' | 'indisponivel'
  limitacoes: string | null
}

export interface PerfilMunicipio {
  municipio: MunicipioResumo
  mercado: IndicadorItem[]
  social: IndicadorItem[]
}

// ─── Agentes ─────────────────────────────────────────────────────────────────

export type PilarTipo = 'mercado' | 'social'

export interface CustoEstimado {
  tipo_rede?: string
  custo_total_min_reais?: number
  custo_total_max_reais?: number
  custo_por_domicilio?: string
  payback_estimado_anos?: string
  classificacao_retorno?: string
  premissas?: string
}

export interface ImpactoEstimado {
  domicilios_beneficiados?: string
  escolas_beneficiadas?: string
  reducao_exclusao_digital_pct?: string
  observacoes?: string
}

export interface ResultadoAgente {
  pilar?: PilarTipo
  agente?: string
  municipio?: string
  codigo_ibge?: string
  constatacoes: string[]
  indicadores_utilizados?: string[]
  fontes: string[]
  periodos?: string[]
  limitacoes: string[]
  dados_ausentes: string[]
  custo_estimado?: CustoEstimado
  programas_elegiveis?: string[]
  impacto_estimado?: ImpactoEstimado
}

export interface ViabilidadeFinanceira {
  tipo_rede_recomendado?: string
  investimento_estimado_range?: string
  payback_anos?: string
  classificacao?: string
  /** Array de programas de financiamento — o backend sempre devolve list[str] */
  financiamentos_disponiveis?: string[]
  // Campos expandidos para análise detalhada
  potencial_mercado?: string
  potencial_social?: string
  tecnologia_recomendada?: string
  justificativa?: string
  riscos?: string
  recomendacao_analista?: string
}

export interface ResultadoConsolidado {
  municipio: string
  codigo_ibge: string
  pergunta: string
  sintese: string
  viabilidade_financeira?: ViabilidadeFinanceira
  mercado: ResultadoAgente
  social: ResultadoAgente
  convergencias: string[]
  divergencias: string[]
  dados_insuficientes: string[]
  conclusao: string
  fontes_consultadas: string[]
  periodos_referencia?: string[]
  limitacoes_gerais?: string[]
  is_ia: true
}

// ─── API genérica ─────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'
