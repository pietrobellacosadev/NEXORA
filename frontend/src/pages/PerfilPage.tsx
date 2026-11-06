import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  BarChart2, Search, X, TrendingUp, Users, MapPin,
  Brain, AlertCircle, Info, ShieldCheck, ExternalLink,
  CheckCircle, HelpCircle, LayoutGrid, BarChart,
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import api from '../lib/api'
import type { MunicipioResumo, PerfilMunicipio, IndicadorItem } from '../types'
import Spinner from '../components/ui/Spinner'
import './PerfilPage.css'

export default function PerfilPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()

  const [busca, setBusca] = useState('')
  const [sugestoes, setSugestoes] = useState<MunicipioResumo[]>([])
  const [buscando, setBuscando] = useState(false)

  const [perfil, setPerfil] = useState<PerfilMunicipio | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [pilarAtivo, setPilarAtivo] = useState<'mercado' | 'social'>('mercado')
  const [viewMode, setViewMode] = useState<'cards' | 'chart'>('cards')

  const carregarPerfil = useCallback(async (codigo: string) => {
    setCarregando(true)
    setErro('')
    setPerfil(null)
    try {
      const { data } = await api.get<PerfilMunicipio>(`/municipios/${codigo}/perfil`)
      setPerfil(data)
    } catch {
      setErro('Não foi possível carregar o perfil deste município.')
    } finally {
      setCarregando(false)
    }
  }, [])

  // Carrega automaticamente se vier com :id na rota
  useEffect(() => {
    if (id) carregarPerfil(id)
  }, [id, carregarPerfil])

  // Debounce da busca por texto
  useEffect(() => {
    if (busca.length < 2) { setSugestoes([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const { data } = await api.get<{ municipios: MunicipioResumo[] }>(
          `/municipios?q=${encodeURIComponent(busca)}&limite=8`
        )
        setSugestoes(data.municipios)
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  function selecionarMunicipio(m: MunicipioResumo) {
    setBusca('')
    setSugestoes([])
    navigate(`/perfil/${m.codigo_ibge}`, { replace: true })
  }

  const indicadoresAtivos = perfil
    ? pilarAtivo === 'mercado' ? perfil.mercado : perfil.social
    : []

  return (
    <motion.div
      className="perfil"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >

      {/* Cabeçalho */}
      <div className="perfil__header">
        <div className="perfil__header-icon">
          <BarChart2 size={22} />
        </div>
        <div>
          <h1 className="perfil__title">Perfil Municipal</h1>
          <p className="perfil__subtitle">
            Indicadores detalhados com fontes, períodos e limitações sempre à vista.
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="perfil__search-wrap">
        <div className="perfil__search">
          <Search size={15} className="perfil__search-icon" aria-hidden="true" />
          <input
            className="perfil__search-input"
            type="search"
            placeholder="Buscar município por nome…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            aria-label="Buscar município"
            autoComplete="off"
          />
          {buscando && <Spinner size="sm" />}
          {busca && !buscando && (
            <button
              className="perfil__search-clear"
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
              className="perfil__sugestoes"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {sugestoes.map(m => (
                <li key={m.codigo_ibge}>
                  <button className="perfil__sugestao-item" onClick={() => selecionarMunicipio(m)}>
                    <MapPin size={13} aria-hidden="true" />
                    <span className="perfil__sugestao-nome">{m.nome}</span>
                    {m.regiao_administrativa && (
                      <span className="perfil__sugestao-region">{m.regiao_administrativa}</span>
                    )}
                    <span className="perfil__sugestao-ibge">{m.codigo_ibge}</span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Estado de carregamento */}
      {carregando && (
        <div className="perfil__loading">
          <Spinner />
          <span>Carregando perfil…</span>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="perfil__error">
          <AlertCircle size={16} />
          {erro}
        </div>
      )}

      {/* Estado vazio */}
      {!carregando && !erro && !perfil && (
        <motion.div
          className="perfil__empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <BarChart2 size={40} className="perfil__empty-icon" />
          <h2 className="perfil__empty-title">Nenhum município selecionado</h2>
          <p className="perfil__empty-desc">
            Use a busca acima ou acesse um município pelo Mapa Territorial.
          </p>
        </motion.div>
      )}

      {/* Perfil carregado */}
      <AnimatePresence mode="wait">
        {perfil && !carregando && (
          <motion.div
            key={perfil.municipio.codigo_ibge}
            className="perfil__content"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Cabeçalho do município */}
            <div className="perfil__muni-header">
              <div className="perfil__muni-info">
                <div className="perfil__muni-icon">
                  <MapPin size={20} />
                </div>
                <div>
                  <h2 className="perfil__muni-nome">{perfil.municipio.nome}</h2>
                  <div className="perfil__muni-meta">
                    {perfil.municipio.mesorregiao && (
                      <span>{perfil.municipio.mesorregiao}</span>
                    )}
                    {perfil.municipio.microrregiao && (
                      <span className="perfil__muni-sep">·</span>
                    )}
                    {perfil.municipio.microrregiao && (
                      <span>{perfil.municipio.microrregiao}</span>
                    )}
                    {perfil.municipio.populacao_estimada && (
                      <>
                        <span className="perfil__muni-sep">·</span>
                        <span>{perfil.municipio.populacao_estimada.toLocaleString('pt-BR')} hab.</span>
                      </>
                    )}
                    <span className="perfil__muni-sep">·</span>
                    <span className="perfil__muni-ibge">IBGE {perfil.municipio.codigo_ibge}</span>
                  </div>
                </div>
              </div>
              <div className="perfil__muni-btns">
                <button
                  className="perfil__muni-btn perfil__muni-btn--ghost"
                  onClick={() => navigate(`/mapa`)}
                >
                  <MapPin size={14} aria-hidden="true" />
                  Ver no mapa
                </button>
                <button
                  className="perfil__muni-btn"
                  onClick={() => navigate(`/investigar?municipio=${perfil.municipio.codigo_ibge}&nome=${encodeURIComponent(perfil.municipio.nome)}`)}
                >
                  <Brain size={14} aria-hidden="true" />
                  Investigar com IA
                  <ExternalLink size={13} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Tabs de pilar + toggle de visualização */}
            <div className="perfil__tabs-row">
              <div className="perfil__tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={pilarAtivo === 'mercado'}
                  className={`perfil__tab perfil__tab--market ${pilarAtivo === 'mercado' ? 'perfil__tab--active' : ''}`}
                  onClick={() => setPilarAtivo('mercado')}
                >
                  <TrendingUp size={15} aria-hidden="true" />
                  Potencial de Mercado
                  <span className="perfil__tab-count">{perfil.mercado.length}</span>
                </button>
                <button
                  role="tab"
                  aria-selected={pilarAtivo === 'social'}
                  className={`perfil__tab perfil__tab--social ${pilarAtivo === 'social' ? 'perfil__tab--active' : ''}`}
                  onClick={() => setPilarAtivo('social')}
                >
                  <Users size={15} aria-hidden="true" />
                  Potencial Social
                  <span className="perfil__tab-count">{perfil.social.length}</span>
                </button>
              </div>
              <div className="perfil__view-toggle" role="group" aria-label="Modo de visualização">
                <button
                  className={`perfil__view-btn${viewMode === 'cards' ? ' perfil__view-btn--active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  title="Visualização em cards"
                >
                  <LayoutGrid size={14} />
                  <span>Cards</span>
                </button>
                <button
                  className={`perfil__view-btn${viewMode === 'chart' ? ' perfil__view-btn--active' : ''}`}
                  onClick={() => setViewMode('chart')}
                  title="Visualização em gráfico"
                >
                  <BarChart size={14} />
                  <span>Gráfico</span>
                </button>
              </div>
            </div>

            {/* Indicadores */}
            <AnimatePresence mode="wait">
              <motion.div
                key={pilarAtivo}
                className="perfil__indicadores"
                initial={{ opacity: 0, x: pilarAtivo === 'mercado' ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {indicadoresAtivos.length === 0 ? (
                    <div className="perfil__sem-dados">
                      <Info size={16} />
                      Nenhum indicador disponível para este pilar.
                    </div>
                  ) : viewMode === 'chart' ? (
                    <IndicadoresChart indicadores={indicadoresAtivos} pilar={pilarAtivo} />
                  ) : (
                    <div className="perfil__grid">
                      {indicadoresAtivos.map((ind) => (
                        <IndicadorCard key={ind.chave} indicador={ind} pilar={pilarAtivo} />
                      ))}
                    </div>
                  )}
              </motion.div>
            </AnimatePresence>

            {/* Nota de integridade */}
            <div className="perfil__integrity">
              <ShieldCheck size={15} className="perfil__integrity-icon" aria-hidden="true" />
              <p>
                <strong>Integridade dos dados:</strong> indicadores classificados como{' '}
                <BadgeInline tipo="oficial" />, <BadgeInline tipo="calculado" />,{' '}
                <BadgeInline tipo="estimado" /> ou <BadgeInline tipo="indisponivel" />.
                Fontes e períodos sempre à vista. A decisão permanece com o analista.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}

/* ── Componentes auxiliares ──────────────────────────────────────────────── */

function IndicadorCard({ indicador: ind, pilar }: { indicador: IndicadorItem; pilar: 'mercado' | 'social' }) {
  const valorFormatado =
    ind.valor_num !== null && ind.valor_num !== undefined
      ? ind.valor_num.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
      : ind.valor_txt ?? null

  const indisponivel = ind.tipo === 'indisponivel' || valorFormatado === null

  return (
    <div className={`ind-card ind-card--${pilar} ${indisponivel ? 'ind-card--indisponivel' : ''}`}>
      <div className="ind-card__top">
        <span className="ind-card__nome">{ind.nome}</span>
        <TipoBadge tipo={ind.tipo} />
      </div>

      <div className="ind-card__valor">
        {indisponivel ? (
          <span className="ind-card__nd">
            <HelpCircle size={14} /> N/D
          </span>
        ) : (
          <>
            <span className="ind-card__num">{valorFormatado}</span>
            {ind.unidade && <span className="ind-card__unidade">{ind.unidade}</span>}
          </>
        )}
      </div>

      <div className="ind-card__meta">
        <span className="ind-card__fonte">{ind.fonte}</span>
        <span className="ind-card__periodo">{ind.periodo}</span>
      </div>

      {ind.limitacoes && (
        <div className="ind-card__limitacao">
          <AlertCircle size={11} />
          {ind.limitacoes}
        </div>
      )}
    </div>
  )
}

const TIPO_CONFIG = {
  oficial:       { label: 'Oficial',       icon: CheckCircle,   cls: 'oficial'      },
  calculado:     { label: 'Calculado',      icon: BarChart2,     cls: 'calculado'    },
  estimado:      { label: 'Estimado',       icon: Info,          cls: 'estimado'     },
  interpretado:  { label: 'Interpretado',   icon: Brain,         cls: 'interpretado' },
  indisponivel:  { label: 'Indisponível',   icon: HelpCircle,    cls: 'indisponivel' },
} as const

function TipoBadge({ tipo }: { tipo: IndicadorItem['tipo'] }) {
  const cfg = TIPO_CONFIG[tipo] ?? TIPO_CONFIG.indisponivel
  const Icon = cfg.icon
  return (
    <span className={`tipo-badge tipo-badge--${cfg.cls}`}>
      <Icon size={10} aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

function BadgeInline({ tipo }: { tipo: IndicadorItem['tipo'] }) {
  const cfg = TIPO_CONFIG[tipo] ?? TIPO_CONFIG.indisponivel
  return <span className={`tipo-badge tipo-badge--${cfg.cls}`}>{cfg.label}</span>
}

/* ── Gráfico de indicadores ─────────────────────────────────────────────── */
function IndicadoresChart({ indicadores, pilar }: { indicadores: IndicadorItem[]; pilar: 'mercado' | 'social' }) {
  const cor = pilar === 'mercado' ? '#2d7dd2' : '#20B8A5'
  const corAlt = pilar === 'mercado' ? '#63A7F2' : '#34d4bf'

  // Só indicadores com valor numérico positivo (exclui zeros e negativos para
  // que a normalização por máximo faça sentido visualmente)
  const dadosRaw = indicadores
    .filter(i => i.valor_num !== null && i.valor_num !== undefined && i.tipo !== 'indisponivel' && (i.valor_num as number) > 0)
    .map(i => ({
      nome: i.nome.length > 30 ? i.nome.slice(0, 28) + '…' : i.nome,
      nomeCompleto: i.nome,
      valor: i.valor_num as number,
      unidade: i.unidade ?? '',
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 12)

  const semDados = indicadores.filter(i => i.tipo === 'indisponivel' || i.valor_num === null || (i.valor_num as number) <= 0)

  if (dadosRaw.length === 0) {
    return (
      <div className="perfil__chart-empty">
        <Info size={16} />
        Nenhum indicador com valor numérico disponível para gráfico.
      </div>
    )
  }

  // Normalização: cada valor como % do máximo da série (0–100)
  // Isso resolve o problema de escalas incompatíveis (ex: população vs IDHM)
  // O tooltip sempre mostra o valor real + unidade original
  const maxValor = Math.max(...dadosRaw.map(d => d.valor))
  const dados = dadosRaw.map(d => ({
    ...d,
    valorNorm: maxValor > 0 ? (d.valor / maxValor) * 100 : 0,
  }))

  // Grid left dinâmico: caracteres do nome mais longo × ~7px, limitado entre 140–240px
  const maxNomeLen = Math.max(...dados.map(d => d.nome.length))
  const gridLeft = Math.min(240, Math.max(140, maxNomeLen * 7))

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' as const },
      formatter: (params: Array<{ value: number; name: string }>) => {
        const p = params[0]
        const item = dados.find(d => d.nome === p.name)
        if (!item) return p.name
        const unidade = item.unidade ? ` ${item.unidade}` : ''
        return `<b>${item.nomeCompleto}</b><br/>${item.valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${unidade}`
      },
    },
    grid: { left: gridLeft, right: 24, top: 8, bottom: 8, containLabel: false },
    xAxis: {
      type: 'value' as const,
      max: 100,
      axisLabel: { show: false },
      splitLine: { lineStyle: { type: 'dashed' as const, color: '#e5e7eb' } },
    },
    yAxis: {
      type: 'category' as const,
      data: dados.map(d => d.nome),
      axisLabel: { fontSize: 11, width: gridLeft - 8, overflow: 'truncate' as const },
    },
    series: [{
      type: 'bar' as const,
      data: dados.map((d, i) => ({
        value: d.valorNorm,
        itemStyle: { color: i % 2 === 0 ? cor : corAlt, borderRadius: [0, 3, 3, 0] },
      })),
      barMaxWidth: 22,
    }],
  }

  const chartHeight = Math.max(220, dados.length * 42)

  return (
    <div className="perfil__chart-wrap">
      <p className="perfil__chart-note">
        Barras normalizadas (% do maior valor da série). Passe o cursor para ver o valor real.
      </p>
      <ReactECharts option={option} style={{ height: chartHeight }} notMerge={true} />
      {semDados.length > 0 && (
        <div className="perfil__chart-nd">
          <Info size={12} />
          <span>{semDados.length} indicador{semDados.length !== 1 ? 'es' : ''} sem valor numérico não exibido{semDados.length !== 1 ? 's' : ''} no gráfico</span>
        </div>
      )}
    </div>
  )
}
