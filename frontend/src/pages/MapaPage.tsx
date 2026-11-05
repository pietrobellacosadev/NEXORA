import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  MapPin, Search, X, ChevronRight,
  TrendingUp, Users, BarChart2, AlertCircle,
  GitCompare, Check, Info,
} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../lib/api'
import type { MunicipioResumo, PerfilMunicipio, IndicadorItem } from '../types'
import Spinner from '../components/ui/Spinner'
import './MapaPage.css'

/* ── Limites geográficos do Estado de São Paulo ───────────────────────────── */
const SP_BOUNDS = L.latLngBounds(
  L.latLng(-25.32, -53.11),   // SW
  L.latLng(-19.78, -44.16),   // NE
)

/* ── Indicadores que queremos destacar no painel lateral ──────────────────── */
const DESTAQUES_MERCADO = ['cobertura_4g', 'penetracao_internet_fixa', 'pib_per_capita', 'densidade_movel']
const DESTAQUES_SOCIAL  = ['idhm', 'acesso_internet_domiciliar', 'taxa_alfabetizacao', 'pobreza_extrema_pct']

const MAX_COMPARAR = 3

function formatarValor(ind: IndicadorItem): string {
  if (ind.valor_num === null || ind.valor_num === undefined) return '–'
  const v = ind.valor_num
  if (ind.unidade?.includes('R$') || (ind.unidade?.includes('hab') && v > 1000))
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  if (v >= 1000) return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export default function MapaPage() {
  const navigate = useNavigate()
  const mapRef        = useRef<L.Map | null>(null)
  const mapElRef      = useRef<HTMLDivElement>(null)
  const geoLayerRef   = useRef<L.GeoJSON | null>(null)
  const selectedLayerRef = useRef<L.Layer | null>(null)
  const layerByCodRef = useRef<Map<string, L.Layer>>(new Map())
  const nomesRef      = useRef<Map<string, string>>(new Map())

  const [busca, setBusca]           = useState('')
  const [resultados, setResultados] = useState<MunicipioResumo[]>([])
  const [buscando, setBuscando]     = useState(false)
  const [resumo, setResumo]         = useState<MunicipioResumo | null>(null)
  const [perfil, setPerfil]         = useState<PerfilMunicipio | null>(null)
  const [carregandoPerfil, setCarregandoPerfil] = useState(false)
  const [erroPerfil, setErroPerfil] = useState('')
  const [tooltip, setTooltip]       = useState('')
  const [pilar, setPilar]           = useState<'mercado' | 'social'>('mercado')
  const [comparar, setComparar]     = useState<MunicipioResumo[]>([])
  const [compararMsg, setComparMsg] = useState('')

  /* ── Inicializa Leaflet ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return

    const map = L.map(mapElRef.current, {
      center: [-22.5, -48.5],
      zoom: 7,
      minZoom: 6,
      maxZoom: 14,
      zoomControl: false,
      attributionControl: true,
      // Bounds suaves — serão substituídos pelo extent real após o GeoJSON carregar
      maxBounds: SP_BOUNDS,
      maxBoundsViscosity: 0.85,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map

    // Pré-carrega mapa código → nome para tooltip
    api.get<{ municipios: MunicipioResumo[] }>('/municipios?limite=700')
      .then(({ data }) => {
        data.municipios.forEach(m => nomesRef.current.set(m.codigo_ibge, m.nome))
      })
      .catch(() => {})

    // Carrega GeoJSON dos municípios de SP
    fetch('/sp_municipios.geojson')
      .then(r => r.json())
      .then(data => {
        const layer = L.geoJSON(data, {
          style: {
            fillColor: '#2d7dd2',
            fillOpacity: 0.10,
            color: '#2d7dd2',
            weight: 0.8,
            opacity: 0.55,
          },
          onEachFeature(feature, featureLayer) {
            const codigo = feature.properties?.codarea
            layerByCodRef.current.set(codigo, featureLayer)
            featureLayer.on({
              mouseover(e) {
                const l = e.target as L.Path
                l.setStyle({ fillOpacity: 0.25, weight: 1.8, color: '#2d7dd2' })
                const nome = nomesRef.current.get(codigo) ?? codigo
                setTooltip(nome || '')
              },
              mouseout(e) {
                if (selectedLayerRef.current !== e.target) {
                  layer.resetStyle(e.target as L.Path)
                }
                setTooltip('')
              },
              click() {
                if (selectedLayerRef.current && selectedLayerRef.current !== featureLayer) {
                  layer.resetStyle(selectedLayerRef.current as L.Path)
                }
                selectedLayerRef.current = featureLayer
                ;(featureLayer as L.Path).setStyle({
                  fillColor: '#20B8A5',
                  fillOpacity: 0.35,
                  color: '#20B8A5',
                  weight: 2.2,
                })
                selecionarMunicipio(codigo)
              },
            })
          },
        }).addTo(map)
        geoLayerRef.current = layer

        // Ajusta view e bounds ao extent REAL do GeoJSON carregado
        const geoBounds = layer.getBounds()
        if (geoBounds.isValid()) {
          const pad = L.point(8, 8)
          map.fitBounds(geoBounds, { padding: pad })
          // Calcula minZoom baseado no tamanho real do container
          const fitZoom = map.getBoundsZoom(geoBounds, false, pad)
          map.setMinZoom(Math.max(5, fitZoom - 1))
          // Trava: não pode sair dos limites reais do GeoJSON
          map.setMaxBounds(geoBounds.pad(0.05))
        }
      })

    return () => { map.remove(); mapRef.current = null }
  }, [])

  /* ── Seleciona município e carrega perfil ───────────────────────────────── */
  const selecionarMunicipio = useCallback(async (codigo: string) => {
    setPilar('mercado')
    setErroPerfil('')
    setPerfil(null)

    try {
      const { data } = await api.get<MunicipioResumo>(`/municipios/${codigo}`)
      setResumo(data)
    } catch {
      setResumo(null)
    }

    setCarregandoPerfil(true)
    try {
      const { data } = await api.get<PerfilMunicipio>(`/municipios/${codigo}/perfil`)
      setPerfil(data)
      setResumo(data.municipio)
    } catch {
      setErroPerfil('Não foi possível carregar os indicadores.')
    } finally {
      setCarregandoPerfil(false)
    }
  }, [])

  /* ── Fly-to no mapa ao selecionar resultado de busca ──────────────────── */
  const flyToMunicipio = useCallback((m: MunicipioResumo) => {
    setBusca('')
    setResultados([])
    selecionarMunicipio(m.codigo_ibge)

    // Destaca a camada no mapa e voa até ela
    const featureLayer = layerByCodRef.current.get(m.codigo_ibge)
    if (featureLayer && geoLayerRef.current && mapRef.current) {
      if (selectedLayerRef.current && selectedLayerRef.current !== featureLayer) {
        geoLayerRef.current.resetStyle(selectedLayerRef.current as L.Path)
      }
      selectedLayerRef.current = featureLayer
      ;(featureLayer as L.Path).setStyle({
        fillColor: '#20B8A5',
        fillOpacity: 0.35,
        color: '#20B8A5',
        weight: 2.2,
      })
      const bounds = (featureLayer as L.GeoJSON).getBounds?.()
      if (bounds?.isValid()) {
        mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 11, duration: 0.8 })
      }
    }
  }, [selecionarMunicipio])

  /* ── Busca por texto ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (busca.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const { data } = await api.get<{ municipios: MunicipioResumo[] }>(
          `/municipios?q=${encodeURIComponent(busca)}&limite=8`
        )
        setResultados(data.municipios)
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  /* ── Comparação ──────────────────────────────────────────────────────────── */
  const toggleComparar = useCallback(() => {
    if (!resumo) return
    setComparar(prev => {
      const jaEsta = prev.some(m => m.codigo_ibge === resumo.codigo_ibge)
      if (jaEsta) {
        setComparMsg('')
        return prev.filter(m => m.codigo_ibge !== resumo.codigo_ibge)
      }
      if (prev.length >= MAX_COMPARAR) {
        setComparMsg(`Máximo de ${MAX_COMPARAR} municípios para comparar.`)
        setTimeout(() => setComparMsg(''), 2500)
        return prev
      }
      setComparMsg(`${resumo.nome} adicionado à comparação (${prev.length + 1}/${MAX_COMPARAR})`)
      setTimeout(() => setComparMsg(''), 2000)
      return [...prev, resumo]
    })
  }, [resumo])

  const irParaComparar = () => {
    // Navega para InvestigarPage com o primeiro município (ou perfil)
    if (comparar.length === 1) {
      navigate(`/perfil/${comparar[0].codigo_ibge}`)
    } else if (comparar.length > 1) {
      const ids = comparar.map(m => m.codigo_ibge).join(',')
      navigate(`/perfil?comparar=${ids}`)
    }
  }

  /* ── Indicadores filtrados ──────────────────────────────────────────────── */
  const destaqueKeys = pilar === 'mercado' ? DESTAQUES_MERCADO : DESTAQUES_SOCIAL
  const indicadoresRaw = pilar === 'mercado' ? perfil?.mercado : perfil?.social
  const indicadores: IndicadorItem[] = indicadoresRaw
    ? [
        ...destaqueKeys.map(k => indicadoresRaw.find(i => i.chave === k)).filter(Boolean) as IndicadorItem[],
        ...indicadoresRaw.filter(i => !destaqueKeys.includes(i.chave)),
      ].slice(0, 6)
    : []

  const jaComparando = resumo ? comparar.some(m => m.codigo_ibge === resumo.codigo_ibge) : false

  const fechar = () => {
    setResumo(null)
    setPerfil(null)
    setErroPerfil('')
    if (selectedLayerRef.current && geoLayerRef.current) {
      geoLayerRef.current.resetStyle(selectedLayerRef.current as L.Path)
      selectedLayerRef.current = null
    }
  }

  return (
    <motion.div
      className="mapa-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* ── Painel lateral ──────────────────────────────────────────────────── */}
      <aside className="mapa-panel">

        {/* Cabeçalho */}
        <div className="mapa-panel__header">
          <div className="mapa-panel__header-row">
            <div className="mapa-panel__header-icon">
              <MapPin size={16} />
            </div>
            <div>
              <h1 className="mapa-panel__title">Municípios SP</h1>
              <span className="mapa-panel__sub">645 municípios · Estado de São Paulo</span>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="mapa-search">
          <Search size={13} className="mapa-search__icon" aria-hidden="true" />
          <input
            className="mapa-search__input"
            type="search"
            placeholder="Buscar e ir para município…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            aria-label="Buscar município"
          />
          {(busca || buscando) && (
            <button
              className="mapa-search__clear"
              onClick={() => { setBusca(''); setResultados([]) }}
              aria-label="Limpar"
            >
              {buscando ? <Spinner size="sm" /> : <X size={13} />}
            </button>
          )}
        </div>

        {/* Dropdown de resultados */}
        <AnimatePresence>
          {resultados.length > 0 && (
            <motion.ul
              className="mapa-results"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.13 }}
            >
              {resultados.map(m => (
                <li key={m.codigo_ibge}>
                  <button
                    className="mapa-results__item"
                    onClick={() => flyToMunicipio(m)}
                  >
                    <MapPin size={12} aria-hidden="true" />
                    <span className="mapa-results__nome">{m.nome}</span>
                    {m.regiao_administrativa && (
                      <span className="mapa-results__region">{m.regiao_administrativa}</span>
                    )}
                    <ChevronRight size={12} className="mapa-results__arrow" />
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {/* Barra de comparação (flutuante se tiver itens) */}
        <AnimatePresence>
          {comparar.length > 0 && (
            <motion.div
              className="mapa-comparar-bar"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="mapa-comparar-bar__info">
                <GitCompare size={13} />
                <span>{comparar.length} {comparar.length === 1 ? 'município' : 'municípios'} selecionado{comparar.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="mapa-comparar-bar__chips">
                {comparar.map(m => (
                  <span key={m.codigo_ibge} className="mapa-comparar-chip">
                    {m.nome}
                    <button
                      onClick={() => setComparar(p => p.filter(x => x.codigo_ibge !== m.codigo_ibge))}
                      aria-label={`Remover ${m.nome}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <button className="mapa-comparar-bar__btn" onClick={irParaComparar}>
                <BarChart2 size={13} />
                {comparar.length === 1 ? 'Ver perfil' : 'Comparar'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conteúdo principal do painel */}
        <div className="mapa-panel__body">
          <AnimatePresence mode="wait">
            {!resumo ? (
              /* Estado vazio */
              <motion.div
                key="vazio"
                className="mapa-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mapa-empty__icon">
                  <MapPin size={22} />
                </div>
                <p className="mapa-empty__title">Selecione um município</p>
                <p className="mapa-empty__desc">
                  Clique no mapa ou busque pelo nome acima para ver indicadores e comparar municípios.
                </p>
                <div className="mapa-empty__dica">
                  <Info size={12} />
                  Use a busca para navegar diretamente até o município no mapa.
                </div>
              </motion.div>
            ) : (
              /* Município selecionado */
              <motion.div
                key={resumo.codigo_ibge}
                className="mapa-info"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Header do município */}
                <div className="mapa-info__header">
                  <div className="mapa-info__header-text">
                    <h2 className="mapa-info__nome">{resumo.nome}</h2>
                    <p className="mapa-info__meta">
                      {[resumo.mesorregiao, resumo.regiao_administrativa]
                        .filter(Boolean)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .join(' · ')}
                    </p>
                  </div>
                  <button className="mapa-info__close" onClick={fechar} aria-label="Fechar">
                    <X size={13} />
                  </button>
                </div>

                {/* Botão de comparação */}
                <button
                  className={`mapa-comparar-btn${jaComparando ? ' mapa-comparar-btn--active' : ''}`}
                  onClick={toggleComparar}
                >
                  {jaComparando
                    ? <><Check size={13} /> Na comparação</>
                    : <><GitCompare size={13} /> Adicionar à comparação</>
                  }
                </button>

                {/* Tabs mercado / social */}
                <div className="mapa-tabs" role="tablist">
                  <button
                    role="tab"
                    aria-selected={pilar === 'mercado'}
                    className={`mapa-tab mapa-tab--market${pilar === 'mercado' ? ' mapa-tab--active' : ''}`}
                    onClick={() => setPilar('mercado')}
                  >
                    <TrendingUp size={13} />
                    Mercado
                  </button>
                  <button
                    role="tab"
                    aria-selected={pilar === 'social'}
                    className={`mapa-tab mapa-tab--social${pilar === 'social' ? ' mapa-tab--active' : ''}`}
                    onClick={() => setPilar('social')}
                  >
                    <Users size={13} />
                    Social
                  </button>
                </div>

                {/* Indicadores reais */}
                {carregandoPerfil ? (
                  <div className="mapa-info__loading">
                    <Spinner size="sm" color="market" />
                    <span>Carregando indicadores…</span>
                  </div>
                ) : erroPerfil ? (
                  <div className="mapa-info__error">
                    <AlertCircle size={14} />
                    {erroPerfil}
                  </div>
                ) : (
                  <div className="mapa-indicadores">
                    {indicadores.map(ind => (
                      <div key={ind.chave} className="mapa-ind">
                        <span className="mapa-ind__nome">{ind.nome}</span>
                        <div className="mapa-ind__valor-row">
                          <span className={`mapa-ind__valor mapa-ind__valor--${pilar}`}>
                            {formatarValor(ind)}
                          </span>
                          {ind.unidade && (
                            <span className="mapa-ind__unidade">{ind.unidade}</span>
                          )}
                        </div>
                        <span className="mapa-ind__fonte">{ind.fonte} · {ind.periodo}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ações */}
                <div className="mapa-info__actions">
                  <button
                    className="mapa-info__btn mapa-info__btn--primary"
                    onClick={() => navigate(`/perfil/${resumo.codigo_ibge}`)}
                  >
                    <BarChart2 size={13} />
                    Perfil completo
                  </button>
                  <button
                    className="mapa-info__btn mapa-info__btn--ghost"
                    onClick={() => navigate(`/investigar?municipio=${resumo.codigo_ibge}&nome=${encodeURIComponent(resumo.nome)}`)}
                  >
                    Investigar com IA
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Legenda */}
        <div className="mapa-legend">
          <span className="mapa-legend__item">
            <span className="mapa-legend__dot mapa-legend__dot--default" /> Município
          </span>
          <span className="mapa-legend__item">
            <span className="mapa-legend__dot mapa-legend__dot--selected" /> Selecionado
          </span>
          {comparar.length > 0 && (
            <span className="mapa-legend__comparar">
              <GitCompare size={10} /> {comparar.length} na comparação
            </span>
          )}
        </div>
      </aside>

      {/* ── Área do mapa ─────────────────────────────────────────────────────── */}
      <div className="mapa-container">
        <div
          ref={mapElRef}
          className="mapa-leaflet"
          aria-label="Mapa interativo dos municípios do Estado de São Paulo"
        />
        {tooltip && (
          <div className="mapa-tooltip">{tooltip}</div>
        )}
        {/* Toast de feedback da comparação */}
        <AnimatePresence>
          {compararMsg && (
            <motion.div
              className="mapa-toast"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              {compararMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
