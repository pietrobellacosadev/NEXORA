import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  BarChart3, TrendingUp, Users, Map, RefreshCw,
  AlertCircle, ArrowRight, GitCompare, Trophy,
  Plus, Search, X,
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import api from '../lib/api'
import type { PerfilMunicipio, IndicadorItem } from '../types'
import Spinner from '../components/ui/Spinner'
import './DashboardPage.css'

// ── Indicadores exibidos no dashboard ────────────────────────────────────────
const RELATORIOS_MERCADO = [
  { chave: 'penetracao_internet_fixa', label: 'Penetração Internet Fixa',  unidade: '%' },
  { chave: 'cobertura_4g',             label: 'Cobertura 4G',              unidade: '%' },
  { chave: 'pib_per_capita',           label: 'PIB per Capita',            unidade: 'R$' },
  { chave: 'densidade_movel',          label: 'Densidade Móvel',           unidade: 'acessos/100hab' },
]
const RELATORIOS_SOCIAL = [
  { chave: 'acesso_internet_domiciliar', label: 'Acesso à Internet Domiciliar', unidade: '%' },
  { chave: 'indice_inclusao_digital',    label: 'Índice de Inclusão Digital',   unidade: 'índice' },
  { chave: 'idhm',                       label: 'IDHM',                         unidade: 'índice' },
  { chave: 'pobreza_extrema_pct',        label: 'Pobreza Extrema',              unidade: '%' },
]

const MUNI_COLORS = [
  '#2d7dd2','#20B8A5','#7c3aed','#d97706','#dc2626',
  '#16a34a','#0891b2','#9333ea','#db2777','#65a30d',
]

const MAX_MUNICIPIOS = 10

type PilarKey = 'mercado' | 'social'
type ViewType = 'bar' | 'radar' | 'ranking'

interface MuniItem { codigo: string; nome: string }

interface MuniPerfil {
  perfil: PerfilMunicipio
  cor: string
}

function getValor(ind: IndicadorItem | undefined): number | null {
  if (!ind || ind.tipo === 'indisponivel' || ind.valor_num === null || ind.valor_num === undefined) return null
  return ind.valor_num
}

function formatNum(v: number | null, unidade: string): string {
  if (v === null) return 'N/D'
  if (unidade === 'R$') return 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  if (unidade === '%') return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

const EASE = [0.16, 1, 0.3, 1] as const

export default function DashboardPage() {
  const navigate = useNavigate()
  const [pilar, setPilar] = useState<PilarKey>('mercado')
  const [view, setView] = useState<ViewType>('bar')
  const [perfis, setPerfis] = useState<MuniPerfil[]>([])
  const [carregando, setCarregando] = useState(false)
  const [carregandoCod, setCarregandoCod] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [relatorioIdx, setRelatorioIdx] = useState(0)

  // Busca de municípios
  const [busca, setBusca] = useState('')
  const [sugestoes, setSugestoes] = useState<MuniItem[]>([])
  const [buscando, setBuscando] = useState(false)
  const buscaRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const relatorios = pilar === 'mercado' ? RELATORIOS_MERCADO : RELATORIOS_SOCIAL
  const relatorio = relatorios[relatorioIdx]

  // Reset índice ao trocar pilar se sair do range
  useEffect(() => {
    setRelatorioIdx(0)
  }, [pilar])

  // Busca reativa de municípios
  useEffect(() => {
    if (busca.trim().length < 2) {
      setSugestoes([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await api.get<{ municipios: MuniItem[] }>('/municipios', { params: { q: busca, limit: 8 } })
        const jáAdicionados = new Set(perfis.map(p => p.perfil.municipio.codigo_ibge))
        setSugestoes((res.data.municipios ?? []).filter(m => !jáAdicionados.has(m.codigo)))
      } catch {
        setSugestoes([])
      } finally {
        setBuscando(false)
      }
    }, 280)
  }, [busca, perfis])

  const adicionarMunicipio = useCallback(async (muni: MuniItem) => {
    if (perfis.length >= MAX_MUNICIPIOS) return
    if (perfis.some(p => p.perfil.municipio.codigo_ibge === muni.codigo)) return
    setBusca('')
    setSugestoes([])
    setCarregandoCod(muni.codigo)
    setErro('')
    try {
      const res = await api.get<PerfilMunicipio>(`/municipios/${muni.codigo}/perfil`)
      const cor = MUNI_COLORS[perfis.length % MUNI_COLORS.length]
      setPerfis(prev => [...prev, { perfil: res.data, cor }])
    } catch {
      setErro(`Não foi possível carregar ${muni.nome}.`)
    } finally {
      setCarregandoCod(null)
    }
  }, [perfis])

  const removerMunicipio = useCallback((codigo: string) => {
    setPerfis(prev => {
      const nova = prev.filter(p => p.perfil.municipio.codigo_ibge !== codigo)
      // Reaplica cores em ordem
      return nova.map((mp, i) => ({ ...mp, cor: MUNI_COLORS[i % MUNI_COLORS.length] }))
    })
  }, [])

  const recarregarTodos = useCallback(async () => {
    if (perfis.length === 0) return
    setCarregando(true)
    setErro('')
    const codigos = perfis.map(p => p.perfil.municipio.codigo_ibge)
    try {
      const resultados = await Promise.allSettled(
        codigos.map(cod => api.get<PerfilMunicipio>(`/municipios/${cod}/perfil`))
      )
      const novas: MuniPerfil[] = []
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          novas.push({ perfil: r.value.data, cor: MUNI_COLORS[i % MUNI_COLORS.length] })
        }
      })
      setPerfis(novas)
    } catch {
      setErro('Erro ao recarregar dados.')
    } finally {
      setCarregando(false)
    }
  }, [perfis])

  // Dados do indicador atual para todos os municípios
  const dadosIndicador = perfis.map(({ perfil, cor }) => {
    const lista = pilar === 'mercado' ? perfil.mercado : perfil.social
    const ind = lista.find(i => i.chave === relatorio.chave)
    return {
      nome: perfil.municipio.nome,
      codigo: perfil.municipio.codigo_ibge,
      valor: getValor(ind),
      cor,
    }
  }).filter(d => d.valor !== null).sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))

  // Opções ECharts — Barras horizontais
  const optionBar = {
    tooltip: {
      trigger: 'axis',
      formatter: (p: Array<{ value: number; name: string }>) =>
        `<b>${p[0].name}</b><br/>${formatNum(p[0].value, relatorio.unidade)}`,
    },
    grid: { left: 140, right: 20, top: 8, bottom: 8, containLabel: false },
    xAxis: {
      type: 'value' as const,
      axisLabel: { show: false },
      splitLine: { lineStyle: { type: 'dashed' as const, color: '#e5e7eb' } },
    },
    yAxis: {
      type: 'category' as const,
      data: dadosIndicador.map(d => d.nome),
      axisLabel: { fontSize: 11, width: 130, overflow: 'truncate' as const },
      inverse: false,
    },
    series: [{
      type: 'bar' as const,
      data: dadosIndicador.map((d, i) => ({
        value: d.valor,
        itemStyle: { color: MUNI_COLORS[i % MUNI_COLORS.length], borderRadius: [0, 4, 4, 0] },
      })),
      barMaxWidth: 22,
      label: {
        show: true,
        position: 'right' as const,
        fontSize: 10,
        formatter: (p: { value: number }) => formatNum(p.value, relatorio.unidade),
      },
    }],
  }

  // Opções ECharts — Radar
  const radarIndicadores = relatorios.slice(0, 4)
  const radarMax = radarIndicadores.map(ri => {
    const vals = perfis.map(({ perfil }) => {
      const lista = pilar === 'mercado' ? perfil.mercado : perfil.social
      return getValor(lista.find(i => i.chave === ri.chave)) ?? 0
    })
    return Math.max(...vals, 1)
  })

  const optionRadar = {
    tooltip: { trigger: 'item' as const },
    legend: { bottom: 0, textStyle: { fontSize: 10 }, type: 'scroll' as const },
    radar: {
      indicator: radarIndicadores.map((ri, idx) => ({
        name: ri.label.length > 18 ? ri.label.slice(0, 16) + '…' : ri.label,
        max: radarMax[idx],
      })),
      splitArea: { areaStyle: { color: ['rgba(45,125,210,0.02)', 'rgba(45,125,210,0.06)'] } },
    },
    series: [{
      type: 'radar' as const,
      data: perfis.map(({ perfil, cor }) => {
        const lista = pilar === 'mercado' ? perfil.mercado : perfil.social
        return {
          name: perfil.municipio.nome,
          value: radarIndicadores.map(ri => getValor(lista.find(i => i.chave === ri.chave)) ?? 0),
          lineStyle: { color: cor, width: 1.5 },
          areaStyle: { color: cor, opacity: 0.06 },
          itemStyle: { color: cor },
          symbol: 'circle',
          symbolSize: 5,
        }
      }),
    }],
  }

  const irParaComparar = () => {
    const codigos = perfis.slice(0, 4).map(p => p.perfil.municipio.codigo_ibge).join(',')
    navigate(`/comparar?comparar=${codigos}`)
  }

  return (
    <motion.div
      className="db"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: EASE }}
    >

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="db__header">
        <div className="db__header-icon"><BarChart3 size={20} /></div>
        <div className="db__header-text">
          <h1 className="db__title">Dashboard</h1>
          <p className="db__subtitle">Selecione municípios para comparar indicadores</p>
        </div>
        <div className="db__header-actions">
          {perfis.length >= 2 && (
            <button className="db__btn-ghost" onClick={irParaComparar}>
              <GitCompare size={14} />
              Comparar municípios
            </button>
          )}
          {perfis.length > 0 && (
            <button
              className="db__btn-ghost db__btn-refresh"
              onClick={recarregarTodos}
              disabled={carregando}
              aria-label="Recarregar"
            >
              <RefreshCw size={14} className={carregando ? 'db__spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* ── Buscador de municípios ──────────────────────────────────────────── */}
      <div className="db__search-wrap">
        <div className="db__search-field">
          <Search size={15} className="db__search-icon" />
          <input
            ref={buscaRef}
            type="text"
            className="db__search-input"
            placeholder={
              perfis.length >= MAX_MUNICIPIOS
                ? `Limite de ${MAX_MUNICIPIOS} municípios atingido`
                : 'Buscar e adicionar município…'
            }
            value={busca}
            onChange={e => setBusca(e.target.value)}
            disabled={perfis.length >= MAX_MUNICIPIOS || carregandoCod !== null}
            autoComplete="off"
          />
          {buscando && <Spinner size="sm" color="market" />}
          {busca && (
            <button className="db__search-clear" onClick={() => { setBusca(''); setSugestoes([]) }} aria-label="Limpar">
              <X size={13} />
            </button>
          )}
        </div>

        {sugestoes.length > 0 && (
          <ul className="db__search-dropdown">
            {sugestoes.map(m => (
              <li key={m.codigo}>
                <button
                  className="db__search-item"
                  onClick={() => adicionarMunicipio(m)}
                  disabled={carregandoCod !== null}
                >
                  <Plus size={13} className="db__search-item-icon" />
                  <span className="db__search-item-nome">{m.nome}</span>
                  <span className="db__search-item-cod">{m.codigo}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Chips dos municípios adicionados */}
      {perfis.length > 0 && (
        <div className="db__chips">
          {perfis.map(({ perfil, cor }) => (
            <span
              key={perfil.municipio.codigo_ibge}
              className="db__chip"
              style={{ '--chip-color': cor } as React.CSSProperties}
            >
              <span className="db__chip-dot" style={{ background: cor }} />
              {perfil.municipio.nome}
              <button
                className="db__chip-remove"
                onClick={() => removerMunicipio(perfil.municipio.codigo_ibge)}
                aria-label={`Remover ${perfil.municipio.nome}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {carregandoCod && (
            <span className="db__chip db__chip--loading">
              <Spinner size="sm" color="market" />
              Carregando…
            </span>
          )}
        </div>
      )}

      {/* Mensagem loading de adição */}
      {carregandoCod && perfis.length === 0 && (
        <div className="db__loading">
          <Spinner size="md" color="market" />
          <span>Carregando município…</span>
        </div>
      )}

      {/* ── Estado vazio ───────────────────────────────────────────────────── */}
      {!carregando && perfis.length === 0 && carregandoCod === null && (
        <motion.div
          className="db__empty-state"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <BarChart3 size={36} />
          <h2 className="db__empty-state-title">Nenhum município selecionado</h2>
          <p className="db__empty-state-desc">
            Use o campo acima para buscar e adicionar até {MAX_MUNICIPIOS} municípios.<br />
            Os gráficos comparativos serão gerados automaticamente.
          </p>
        </motion.div>
      )}

      {erro && (
        <div className="db__error">
          <AlertCircle size={15} />{erro}
        </div>
      )}

      {/* ── Controles (só visíveis quando há municípios) ────────────────────── */}
      {perfis.length > 0 && (
        <>
          <div className="db__controls">
            {/* Tabs pilar */}
            <div className="db__pilar-tabs">
              <button
                className={`db__pilar-tab${pilar === 'mercado' ? ' db__pilar-tab--on db__pilar-tab--market' : ''}`}
                onClick={() => setPilar('mercado')}
              >
                <TrendingUp size={14} /> Mercado
              </button>
              <button
                className={`db__pilar-tab${pilar === 'social' ? ' db__pilar-tab--on db__pilar-tab--social' : ''}`}
                onClick={() => setPilar('social')}
              >
                <Users size={14} /> Social
              </button>
            </div>

            {/* Seletor de indicador */}
            <div className="db__ind-tabs">
              {relatorios.map((r, i) => (
                <button
                  key={r.chave}
                  className={`db__ind-tab${relatorioIdx === i ? ' db__ind-tab--on' : ''}`}
                  onClick={() => setRelatorioIdx(i)}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Tipo de visualização */}
            <div className="db__view-tabs">
              <button className={`db__view-tab${view === 'bar' ? ' db__view-tab--on' : ''}`} onClick={() => setView('bar')}>
                <BarChart3 size={13} /> <span>Barras</span>
              </button>
              <button className={`db__view-tab${view === 'radar' ? ' db__view-tab--on' : ''}`} onClick={() => setView('radar')}>
                <Map size={13} /> <span>Radar</span>
              </button>
              <button className={`db__view-tab${view === 'ranking' ? ' db__view-tab--on' : ''}`} onClick={() => setView('ranking')}>
                <Trophy size={13} /> <span>Ranking</span>
              </button>
            </div>
          </div>

          {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
          {carregando ? (
            <div className="db__loading">
              <Spinner size="md" color="market" />
              <span>Atualizando dados…</span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${pilar}-${view}-${relatorioIdx}`}
                className="db__chart-area"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {view === 'ranking' ? (
                  <RankingView dados={dadosIndicador} relatorio={relatorio} pilar={pilar} onMunicipio={(cod) => navigate(`/comparar?comparar=${cod}`)} />
                ) : view === 'radar' ? (
                  <div className="db__chart-wrap">
                    <p className="db__chart-label">
                      {pilar === 'mercado' ? <TrendingUp size={13} /> : <Users size={13} />}
                      Comparativo radar — primeiros 4 indicadores de {pilar === 'mercado' ? 'Mercado' : 'Social'}
                    </p>
                    <ReactECharts option={optionRadar} style={{ height: 380 }} notMerge />
                  </div>
                ) : (
                  <div className="db__chart-wrap">
                    <p className="db__chart-label">
                      {pilar === 'mercado' ? <TrendingUp size={13} /> : <Users size={13} />}
                      {relatorio.label} — {dadosIndicador.length} municípios · unidade: {relatorio.unidade}
                    </p>
                    {dadosIndicador.length === 0 ? (
                      <div className="db__empty">
                        <Map size={28} />
                        <span>Nenhum dado disponível para este indicador nos municípios selecionados.</span>
                      </div>
                    ) : (
                      <ReactECharts
                        option={optionBar}
                        style={{ height: Math.max(260, dadosIndicador.length * 38) }}
                        notMerge
                      />
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ── Chips / lista de municípios com remoção rápida ────────────────── */}
          <div className="db__quick">
            <div className="db__section-header">
              <div className="db__section-bar" />
              <h2 className="db__section-title">Municípios selecionados</h2>
              <button className="db__btn-ghost db__btn-ghost--sm" onClick={() => setPerfis([])}>
                <X size={12} /> Limpar todos
              </button>
            </div>
            <div className="db__muni-grid">
              {perfis.map(({ perfil, cor }) => {
                const lista = pilar === 'mercado' ? perfil.mercado : perfil.social
                const ind = lista.find(i => i.chave === relatorio.chave)
                const valor = getValor(ind)
                return (
                  <button
                    key={perfil.municipio.codigo_ibge}
                    className="db__muni-card"
                    style={{ '--accent': cor } as React.CSSProperties}
                    onClick={() => navigate(`/comparar?comparar=${perfil.municipio.codigo_ibge}`)}
                  >
                    <span className="db__muni-dot" style={{ background: cor }} />
                    <div className="db__muni-text">
                      <span className="db__muni-nome">{perfil.municipio.nome}</span>
                      <span className="db__muni-val">
                        {valor !== null ? formatNum(valor, relatorio.unidade) : 'N/D'}
                      </span>
                    </div>
                    <ArrowRight size={12} className="db__muni-arrow" />
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}

// ── Ranking view ──────────────────────────────────────────────────────────────
function RankingView({
  dados,
  relatorio,
  pilar,
  onMunicipio,
}: {
  dados: { nome: string; codigo: string; valor: number | null; cor: string }[]
  relatorio: { chave: string; label: string; unidade: string }
  pilar: PilarKey
  onMunicipio: (cod: string) => void
}) {
  if (dados.length === 0) {
    return (
      <div className="db__empty">
        <Map size={28} />
        <span>Nenhum dado disponível para este indicador.</span>
      </div>
    )
  }

  const max = Math.max(...dados.map(d => d.valor ?? 0))

  return (
    <div className="db__ranking">
      <p className="db__chart-label">
        {pilar === 'mercado' ? <TrendingUp size={13} /> : <Users size={13} />}
        Ranking — {relatorio.label}
      </p>
      <ol className="db__ranking-list">
        {dados.map((d, i) => (
          <li key={d.codigo} className="db__ranking-item">
            <span className={`db__rank-num${i < 3 ? ' db__rank-num--top' : ''}`}>{i + 1}</span>
            <div className="db__rank-bar-wrap">
              <div className="db__rank-label">
                <button className="db__rank-nome" onClick={() => onMunicipio(d.codigo)}>{d.nome}</button>
                <span className="db__rank-val">{formatNum(d.valor, relatorio.unidade)}</span>
              </div>
              <div className="db__rank-track">
                <motion.div
                  className="db__rank-fill"
                  style={{ background: d.cor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${((d.valor ?? 0) / max) * 100}%` }}
                  transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
