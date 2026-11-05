import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  GitCompare, Search, X, TrendingUp, Users, MapPin,
  Plus, AlertCircle, Info, ShieldCheck, ChevronDown, ChevronUp,
  TableProperties, BarChart3,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import api from '../lib/api'
import type { MunicipioResumo, PerfilMunicipio, IndicadorItem } from '../types'
import Spinner from '../components/ui/Spinner'
import './CompararPage.css'

const MAX_MUNICIPIOS = 4

export default function CompararPage() {
  const [selecionados, setSelecionados] = useState<PerfilMunicipio[]>([])
  const [carregando, setCarregando] = useState<Record<string, boolean>>({})

  // Busca
  const [busca, setBusca] = useState('')
  const [sugestoes, setSugestoes] = useState<MunicipioResumo[]>([])
  const [buscando, setBuscando] = useState(false)

  const [pilarAtivo, setPilarAtivo] = useState<'mercado' | 'social'>('mercado')
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [erro, setErro] = useState('')

  // Debounce busca
  useEffect(() => {
    if (busca.length < 2) { setSugestoes([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const { data } = await api.get<{ municipios: MunicipioResumo[] }>(
          `/municipios?q=${encodeURIComponent(busca)}&limite=8`
        )
        // Filtra os já selecionados
        const ibgesAtivos = new Set(selecionados.map(p => p.municipio.codigo_ibge))
        setSugestoes(data.municipios.filter(m => !ibgesAtivos.has(m.codigo_ibge)))
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [busca, selecionados])

  const adicionarMunicipio = useCallback(async (m: MunicipioResumo) => {
    if (selecionados.length >= MAX_MUNICIPIOS) return
    setBusca('')
    setSugestoes([])
    setErro('')
    setCarregando(c => ({ ...c, [m.codigo_ibge]: true }))
    try {
      const { data } = await api.get<PerfilMunicipio>(`/municipios/${m.codigo_ibge}/perfil`)
      setSelecionados(s => [...s, data])
    } catch {
      setErro(`Não foi possível carregar o perfil de ${m.nome}.`)
    } finally {
      setCarregando(c => { const n = { ...c }; delete n[m.codigo_ibge]; return n })
    }
  }, [selecionados.length])

  const remover = (ibge: string) =>
    setSelecionados(s => s.filter(p => p.municipio.codigo_ibge !== ibge))

  const indicadores = selecionados.length > 0
    ? (pilarAtivo === 'mercado' ? selecionados[0].mercado : selecionados[0].social)
    : []

  const estaCarregando = Object.keys(carregando).length > 0

  return (
    <div className="comp">

      {/* Cabeçalho */}
      <div className="comp__header">
        <div className="comp__header-icon">
          <GitCompare size={22} />
        </div>
        <div>
          <h1 className="comp__title">Comparação Municipal</h1>
          <p className="comp__subtitle">
            Compare até {MAX_MUNICIPIOS} municípios lado a lado por pilar de análise.
          </p>
        </div>
      </div>

      {/* Seleção de municípios */}
      <div className="comp__selecao">

        {/* Chips dos selecionados */}
        <div className="comp__chips">
          {selecionados.map(p => (
            <motion.div
              key={p.municipio.codigo_ibge}
              className="comp__chip"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MapPin size={12} aria-hidden="true" />
              <span className="comp__chip-nome">{p.municipio.nome}</span>
              <button
                className="comp__chip-remove"
                onClick={() => remover(p.municipio.codigo_ibge)}
                aria-label={`Remover ${p.municipio.nome}`}
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}

          {estaCarregando && (
            <div className="comp__chip comp__chip--loading">
              <Spinner size="sm" />
              <span>Carregando…</span>
            </div>
          )}

          {selecionados.length < MAX_MUNICIPIOS && !estaCarregando && (
            <div className="comp__add-hint">
              <Plus size={13} />
              Adicione até {MAX_MUNICIPIOS - selecionados.length} município{MAX_MUNICIPIOS - selecionados.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Campo de busca */}
        {selecionados.length < MAX_MUNICIPIOS && (
          <div className="comp__search-wrap">
            <div className="comp__search">
              <Search size={15} className="comp__search-icon" aria-hidden="true" />
              <input
                className="comp__search-input"
                type="search"
                placeholder="Buscar e adicionar município…"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                aria-label="Buscar município para comparar"
                autoComplete="off"
              />
              {buscando && <Spinner size="sm" />}
              {busca && !buscando && (
                <button
                  className="comp__search-clear"
                  onClick={() => { setBusca(''); setSugestoes([]) }}
                  aria-label="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <AnimatePresence>
              {sugestoes.length > 0 && (
                <motion.ul
                  className="comp__sugestoes"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {sugestoes.map(m => (
                    <li key={m.codigo_ibge}>
                      <button className="comp__sugestao-item" onClick={() => adicionarMunicipio(m)}>
                        <Plus size={12} className="comp__sugestao-plus" />
                        <MapPin size={12} aria-hidden="true" />
                        <span className="comp__sugestao-nome">{m.nome}</span>
                        {m.regiao_administrativa && (
                          <span className="comp__sugestao-region">{m.regiao_administrativa}</span>
                        )}
                        <span className="comp__sugestao-ibge">{m.codigo_ibge}</span>
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div className="comp__error">
          <AlertCircle size={15} />
          {erro}
        </div>
      )}

      {/* Estado vazio */}
      {selecionados.length === 0 && !estaCarregando && (
        <motion.div className="comp__empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <GitCompare size={40} className="comp__empty-icon" />
          <h2 className="comp__empty-title">Nenhum município selecionado</h2>
          <p className="comp__empty-desc">
            Busque municípios acima para começar a comparação.
            Você pode selecionar até {MAX_MUNICIPIOS}.
          </p>
        </motion.div>
      )}

      {/* Tabela comparativa */}
      {selecionados.length >= 1 && (
        <motion.div
          className="comp__content"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Tabs de pilar + toggle */}
          <div className="comp__tabs-row">
            <div className="comp__tabs" role="tablist">
              <button
                role="tab"
                aria-selected={pilarAtivo === 'mercado'}
                className={`comp__tab comp__tab--market ${pilarAtivo === 'mercado' ? 'comp__tab--active' : ''}`}
                onClick={() => setPilarAtivo('mercado')}
              >
                <TrendingUp size={15} />
                Potencial de Mercado
                <span className="comp__tab-count">{selecionados[0]?.mercado.length ?? 0}</span>
              </button>
              <button
                role="tab"
                aria-selected={pilarAtivo === 'social'}
                className={`comp__tab comp__tab--social ${pilarAtivo === 'social' ? 'comp__tab--active' : ''}`}
                onClick={() => setPilarAtivo('social')}
              >
                <Users size={15} />
                Potencial Social
                <span className="comp__tab-count">{selecionados[0]?.social.length ?? 0}</span>
              </button>
            </div>
            <div className="comp__view-toggle">
              <button
                className={`comp__view-btn${viewMode === 'table' ? ' comp__view-btn--active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                <TableProperties size={14} />
                <span>Tabela</span>
              </button>
              <button
                className={`comp__view-btn${viewMode === 'chart' ? ' comp__view-btn--active' : ''}`}
                onClick={() => setViewMode('chart')}
              >
                <BarChart3 size={14} />
                <span>Gráfico</span>
              </button>
            </div>
          </div>

          {/* Tabela / Gráfico */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${pilarAtivo}-${viewMode}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {viewMode === 'chart' ? (
                <GraficoComparacao
                  selecionados={selecionados}
                  indicadoresBase={indicadores}
                  pilar={pilarAtivo}
                />
              ) : (
                <TabelaComparacao
                  selecionados={selecionados}
                  indicadoresBase={indicadores}
                  pilar={pilarAtivo}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nota de integridade */}
          <div className="comp__integrity">
            <ShieldCheck size={14} className="comp__integrity-icon" />
            <p>
              <strong>Atenção:</strong> indicadores classificados como{' '}
              <em>estimado</em> são derivados de coeficientes metodológicos por porte populacional.
              Não substituem dados oficiais por município.{' '}
              <span className="comp__best-note">
                ✦ Destaque indica o maior valor válido entre os municípios comparados.
              </span>
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

/* ── Tabela comparativa ──────────────────────────────────────────────────── */

function TabelaComparacao({
  selecionados,
  indicadoresBase,
  pilar,
}: {
  selecionados: PerfilMunicipio[]
  indicadoresBase: IndicadorItem[]
  pilar: 'mercado' | 'social'
}) {
  const [expandido, setExpandido] = useState(true)

  // Constrói mapa: chave → { label, valores por município }
  type LinhaComparacao = {
    chave: string
    nome: string
    unidade: string | null
    valores: (IndicadorItem | null)[]
    melhorIdx: number  // índice do município com melhor valor numérico (-1 se nenhum)
  }

  const linhas: LinhaComparacao[] = indicadoresBase.map(indBase => {
    const valores = selecionados.map(p => {
      const inds = pilar === 'mercado' ? p.mercado : p.social
      return inds.find(i => i.chave === indBase.chave) ?? null
    })

    // Determina o melhor valor (maior número válido)
    let melhorIdx = -1
    let melhorVal = -Infinity
    valores.forEach((v, i) => {
      if (v?.valor_num !== null && v?.valor_num !== undefined && v.tipo !== 'indisponivel') {
        if (v.valor_num > melhorVal) {
          melhorVal = v.valor_num
          melhorIdx = i
        }
      }
    })

    return { chave: indBase.chave, nome: indBase.nome, unidade: indBase.unidade, valores, melhorIdx }
  })

  return (
    <div className="comp-tabela">
      <button className="comp-tabela__toggle" onClick={() => setExpandido(e => !e)}>
        <span>
          {pilar === 'mercado' ? <TrendingUp size={14} /> : <Users size={14} />}
          {linhas.length} indicadores
        </span>
        {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="comp-tabela__wrap"
          >
            <div className="comp-tabela__scroll">
              <table className="comp-tabela__table">
                <thead>
                  <tr>
                    <th className="comp-tabela__th-ind">Indicador</th>
                    {selecionados.map((p, i) => (
                      <th key={p.municipio.codigo_ibge} className={`comp-tabela__th-muni comp-tabela__th-muni--${i}`}>
                        <span className="comp-tabela__muni-nome">{p.municipio.nome}</span>
                        {p.municipio.mesorregiao && (
                          <span className="comp-tabela__muni-reg">{p.municipio.mesorregiao}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(linha => (
                    <tr key={linha.chave} className="comp-tabela__tr">
                      <td className="comp-tabela__td-ind">
                        <span className="comp-tabela__ind-nome">{linha.nome}</span>
                        {linha.unidade && (
                          <span className="comp-tabela__ind-unidade">{linha.unidade}</span>
                        )}
                      </td>
                      {linha.valores.map((v, i) => (
                        <td
                          key={i}
                          className={`comp-tabela__td-val ${i === linha.melhorIdx ? 'comp-tabela__td-val--best' : ''} ${v?.tipo === 'indisponivel' || v === null ? 'comp-tabela__td-val--nd' : ''}`}
                        >
                          <CelulaValor valor={v} isBest={i === linha.melhorIdx} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CelulaValor({ valor, isBest }: { valor: IndicadorItem | null; isBest: boolean }) {
  if (!valor || valor.tipo === 'indisponivel') {
    return (
      <span className="comp-cell__nd">
        <Info size={11} />
        N/D
      </span>
    )
  }

  const num =
    valor.valor_num !== null && valor.valor_num !== undefined
      ? valor.valor_num.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
      : valor.valor_txt

  return (
    <span className={`comp-cell__val ${isBest ? 'comp-cell__val--best' : ''}`}>
      {isBest && <span className="comp-cell__star" aria-label="Melhor valor">✦</span>}
      {num}
    </span>
  )
}

/* ── Gráfico comparativo ─────────────────────────────────────────────────── */
const MUNI_COLORS = ['#2d7dd2', '#20B8A5', '#7c3aed', '#d97706']

function GraficoComparacao({
  selecionados,
  indicadoresBase,
  pilar,
}: {
  selecionados: PerfilMunicipio[]
  indicadoresBase: IndicadorItem[]
  pilar: 'mercado' | 'social'
}) {
  // Build chart data: each row = one indicator, each key = one municipality
  const dados = indicadoresBase
    .filter(ind => {
      // at least one municipality has a numeric value for this indicator
      return selecionados.some(p => {
        const inds = pilar === 'mercado' ? p.mercado : p.social
        const found = inds.find(i => i.chave === ind.chave)
        return found?.valor_num !== null && found?.valor_num !== undefined && found?.tipo !== 'indisponivel'
      })
    })
    .map(ind => {
      const row: Record<string, string | number | null> = {
        indicador: ind.nome.length > 22 ? ind.nome.slice(0, 20) + '…' : ind.nome,
      }
      selecionados.forEach((p, i) => {
        const inds = pilar === 'mercado' ? p.mercado : p.social
        const found = inds.find(item => item.chave === ind.chave)
        row[`muni_${i}`] = found?.valor_num ?? null
      })
      return row
    })
    .slice(0, 10)

  if (dados.length === 0) {
    return (
      <div className="comp__chart-empty">
        <Info size={16} />
        Nenhum indicador com valor numérico para comparar em gráfico.
      </div>
    )
  }

  const chartHeight = Math.max(240, dados.length * 44)

  return (
    <div className="comp__chart-wrap">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={dados}
          layout="vertical"
          margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
          barCategoryGap="28%"
          barGap={3}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: 'var(--color-muted)', fontFamily: 'Inter' }}
            domain={[0, 'auto']}
          />
          <YAxis
            type="category"
            dataKey="indicador"
            width={180}
            tick={{ fontSize: 11, fill: 'var(--color-ink)', fontFamily: 'Inter' }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-line)',
              borderRadius: '10px',
              fontSize: '12px',
              boxShadow: 'var(--shadow-lg)',
            }}
            formatter={(value) => {
              const v = value as number | null
              return v !== null && v !== undefined ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : 'N/D'
            }}
          />
          <Legend
            formatter={(value: string) => {
              const idx = parseInt(value.replace('muni_', ''))
              return selecionados[idx]?.municipio.nome ?? value
            }}
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          />
          {selecionados.map((_p, i) => (
            <Bar
              key={`muni_${i}`}
              dataKey={`muni_${i}`}
              name={`muni_${i}`}
              fill={MUNI_COLORS[i % MUNI_COLORS.length]}
              radius={[0, 4, 4, 0]}
              maxBarSize={18}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
