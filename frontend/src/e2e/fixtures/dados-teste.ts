/**
 * Dados de teste isolados para os testes E2E do NEXORA.
 * Nunca representam dados reais de produção — são apenas dados sintéticos de teste.
 */

import type { MunicipioResumo, PerfilMunicipio } from '../types'

// ── Municípios sintéticos de teste ──────────────────────────────────────────

export const MUNICIPIO_A: MunicipioResumo = {
  codigo_ibge: '3500105',
  nome: 'Adamantina',
  regiao_administrativa: 'Marília',
  mesorregiao: 'Presidente Prudente',
  microrregiao: 'Adamantina',
  populacao_estimada: 35_000,
}

export const MUNICIPIO_B: MunicipioResumo = {
  codigo_ibge: '3500204',
  nome: 'Adolfo',
  regiao_administrativa: 'São José do Rio Preto',
  mesorregiao: 'São José do Rio Preto',
  microrregiao: 'São José do Rio Preto',
  populacao_estimada: 3_500,
}

export const MUNICIPIO_LISTA = {
  total: 2,
  municipios: [MUNICIPIO_A, MUNICIPIO_B],
}

// ── Indicadores sintéticos de teste ─────────────────────────────────────────

export const INDICADORES_MERCADO = [
  {
    chave: 'densidade_pop',
    nome: 'Densidade Populacional',
    valor_num: 45.2,
    valor_txt: null,
    unidade: 'hab/km²',
    fonte: 'IBGE',
    periodo: '2022',
    tipo: 'oficial',
    limitacoes: null,
  },
  {
    chave: 'pib_per_capita',
    nome: 'PIB per capita',
    valor_num: 28_500,
    valor_txt: null,
    unidade: 'R$/ano',
    fonte: 'IBGE',
    periodo: '2021',
    tipo: 'oficial',
    limitacoes: null,
  },
  {
    chave: 'cobertura_4g',
    nome: 'Cobertura 4G',
    valor_num: null,
    valor_txt: null,
    unidade: null,
    fonte: 'ANATEL',
    periodo: '2023',
    tipo: 'indisponivel',
    limitacoes: 'Dado não disponível para este município.',
  },
]

export const INDICADORES_SOCIAL = [
  {
    chave: 'ideb_ai',
    nome: 'IDEB Anos Iniciais',
    valor_num: 6.2,
    valor_txt: null,
    unidade: null,
    fonte: 'INEP',
    periodo: '2021',
    tipo: 'oficial',
    limitacoes: null,
  },
  {
    chave: 'cobertura_sus',
    nome: 'Cobertura SUS',
    valor_num: 78.4,
    valor_txt: null,
    unidade: '%',
    fonte: 'DATASUS',
    periodo: '2022',
    tipo: 'estimado',
    limitacoes: 'Estimativa por porte populacional.',
  },
]

export const PERFIL_A: PerfilMunicipio = {
  municipio: MUNICIPIO_A,
  mercado: INDICADORES_MERCADO,
  social: INDICADORES_SOCIAL,
}

export const PERFIL_B: PerfilMunicipio = {
  municipio: MUNICIPIO_B,
  mercado: INDICADORES_MERCADO.map(i => ({ ...i, valor_num: i.valor_num ? i.valor_num * 0.8 : null })),
  social: INDICADORES_SOCIAL.map(i => ({ ...i, valor_num: i.valor_num ? i.valor_num * 0.9 : null })),
}

// ── Resultado sintético de investigação ─────────────────────────────────────

export const RESULTADO_INVESTIGACAO = {
  sintese: '[TESTE] Síntese consolidada gerada pelo agente de teste.',
  conclusao: '[TESTE] O município apresenta potencial moderado de expansão.',
  mercado: {
    constatacoes: ['[TESTE] Densidade suficiente para viabilidade econômica.'],
    fontes: ['IBGE', 'ANATEL'],
    limitacoes: ['Dados parciais de cobertura.'],
    dados_ausentes: ['Cobertura 4G por área'],
  },
  social: {
    constatacoes: ['[TESTE] IDEB acima da média estadual.'],
    fontes: ['INEP', 'DATASUS'],
    limitacoes: [],
    dados_ausentes: [],
  },
  convergencias: ['[TESTE] Infraestrutura básica presente.'],
  divergencias: ['[TESTE] Retorno financeiro limitado no curto prazo.'],
  dados_insuficientes: ['Cobertura 4G detalhada'],
  fontes_consultadas: ['IBGE', 'ANATEL', 'INEP', 'DATASUS'],
  municipio: MUNICIPIO_A.nome,
  codigo_ibge: MUNICIPIO_A.codigo_ibge,
  pergunta: 'Quais oportunidades de conectividade existem neste município?',
}
