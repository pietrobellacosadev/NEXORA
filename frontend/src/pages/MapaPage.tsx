import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  MapPin, Search, X, ChevronRight,
  TrendingUp, Users, BarChart2, AlertCircle,
  GitCompare, Check, Info, Layers, Brain,
} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../lib/api'
import type { MunicipioResumo, PerfilMunicipio, IndicadorItem } from '../types'
import { openAIChat } from '../components/ui/AIFab'
import Spinner from '../components/ui/Spinner'
import './MapaPage.css'

const SP_BOUNDS = L.latLngBounds(
  L.latLng(-25.32, -53.11),
  L.latLng(-19.78, -44.16),
)

const DESTAQUES_MERCADO = ['penetracao_internet_fixa', 'cobertura_4g', 'pib_per_capita', 'densidade_movel']
const DESTAQUES_SOCIAL  = ['acesso_internet_domiciliar', 'indice_inclusao_digital', 'pobreza_extrema_pct', 'idhm']

const MAX_COMPARAR = 3
const COMPARAR_CORES = ['#f97316', '#a855f7', '#ec4899']

// Cor de seleção e hover do mapa
const COR_SELECIONADO = '#20B8A5'
const COR_HOVER       = '#2d7dd2'
const COR_PADRAO_FILL = '#2d7dd2'

function formatarValor(ind: IndicadorItem): string {
  if (ind.valor_num === null || ind.valor_num === undefined) return '–'
  const v = ind.valor_num
  if (ind.unidade?.includes('R$') || (ind.unidade?.includes('hab') && v > 1000))
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  if (v >= 1000) return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function buildMaskLayer(spGeoJSON: GeoJSON.FeatureCollection): L.GeoJSON {
  const world = [[-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180]]
  const holes: number[][][][] = []
  for (const feature of spGeoJSON.features) {
    const geom = feature.geometry
    if (geom.type === 'Polygon') holes.push(geom.coordinates as number[][][])
    else if (geom.type === 'MultiPolygon') {
      for (const poly of (geom.coordinates as number[][][][])) holes.push(poly)
    }
  }
  const maskFeature: GeoJSON.Feature = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [world as number[][], ...holes.map(h => h[0])],
    },
  }
  return L.geoJSON(maskFeature, {
    style: { fillColor: '#0f172a', fillOpacity: 0.5, color: 'transparent', weight: 0 },
    interactive: false,
  })
}

export default function MapaPage() {
  const navigate = useNavigate()
  const mapRef           = useRef<L.Map | null>(null)
  const mapElRef         = useRef<HTMLDivElement>(null)
  const geoLayerRef      = useRef<L.GeoJSON | null>(null)
  const selectedLayerRef = useRef<L.Layer | null>(null)
  const layerByCodRef    = useRef<Map<string, L.Layer>>(new Map())
  const nomesRef         = useRef<Map<string, string>>(new Map())
  const compararLayersRef = useRef<Map<string, string>>(new Map())

  const [busca, setBusca]           = useState('')
  const [resultados, setResultados] = useState<MunicipioResumo[]>([])
  const [buscando, setBuscando]     = useState(false)
  const [resumo, setResumo]         = useState<MunicipioResumo | null>(null)
  const [perfil, setPerfil]         = useState<PerfilMunicipio | null>(null)
  const [carregandoPerfil, setCarregandoPerfil] = useState(false)
  const [erroPerfil, setErroPerfil] = useState('')
  const [tooltip, setTooltip]       = useState<{ nome: string; x: number; y: number } | null>(null)
  const [pilar, setPilar]           = useState<'mercado' | 'social'>('mercado')
  const [comparar, setComparar]     = useState<MunicipioResumo[]>([])
  const [compararMsg, setComparMsg] = useState('')
  const [drawerAberto, setDrawerAberto] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const aplicarEstiloComparar = useCallback(() => {
    compararLayersRef.current.forEach((cor, codigo) => {
      const layer = layerByCodRef.current.get(codigo)
      if (layer && layer !== selectedLayerRef.current) {
        ;(layer as L.Path).setStyle({ fillColor: cor, fillOpacity: 0.35, color: cor, weight: 2 })
      }
    })
  }, [])

  /* ── Inicializa Leaflet ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return

    const map = L.map(mapElRef.current, {
      center: [-22.5, -48.5],
      zoom: 7,
      minZoom: 6,
      maxZoom: 14,
      zoomControl: false,
      attributionControl: true,
      maxBounds: SP_BOUNDS,
      maxBoundsViscosity: 0.85,
    })

    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map

    api.get<{ municipios: MunicipioResumo[] }>('/municipios?limite=700')
      .then(({ data }) => data.municipios.forEach(m => nomesRef.current.set(m.codigo_ibge, m.nome)))
      .catch(() => {})

    fetch('/sp_municipios.geojson')
      .then(r => r.json())
      .then((data: GeoJSON.FeatureCollection) => {
        const layer = L.geoJSON(data, {
          style: {
            fillColor: COR_PADRAO_FILL,
            fillOpacity: 0.10,
            color: COR_PADRAO_FILL,
            weight: 0.8,
            opacity: 0.50,
          },
          onEachFeature(feature, featureLayer) {
            const codigo = feature.properties?.codarea
            layerByCodRef.current.set(codigo, featureLayer)
            featureLayer.on({
              mouseover(e) {
                const l = e.target as L.Path
                if (!compararLayersRef.current.has(codigo) && selectedLayerRef.current !== e.target) {
                  l.setStyle({ fillOpacity: 0.30, weight: 2, color: COR_HOVER })
                }
                const nome = nomesRef.current.get(codigo) ?? codigo
                // Posição do mouse no container do mapa
                const point = map.latLngToContainerPoint((e as L.LeafletMouseEvent).latlng)
                setTooltip({ nome, x: point.x, y: point.y })
              },
              mousemove(e) {
                const point = map.latLngToContainerPoint((e as L.LeafletMouseEvent).latlng)
                const nome = nomesRef.current.get(codigo) ?? codigo
                setTooltip({ nome, x: point.x, y: point.y })
              },
              mouseout(e) {
                if (selectedLayerRef.current !== e.target) {
                  if (compararLayersRef.current.has(codigo)) {
                    const cor = compararLayersRef.current.get(codigo)!
                    ;(e.target as L.Path).setStyle({ fillColor: cor, fillOpacity: 0.35, color: cor, weight: 2 })
                  } else {
                    layer.resetStyle(e.target as L.Path)
                  }
                }
                setTooltip(null)
              },
              click() {
                // Reseta o anterior
                if (selectedLayerRef.current && selectedLayerRef.current !== featureLayer) {
                  const prevCod = [...layerByCodRef.current.entries()]
                    .find(([, v]) => v === selectedLayerRef.current)?.[0]
                  if (prevCod && compararLayersRef.current.has(prevCod)) {
                    const cor = compararLayersRef.current.get(prevCod)!
                    ;(selectedLayerRef.current as L.Path).setStyle({ fillColor: cor, fillOpacity: 0.35, color: cor, weight: 2 })
                  } else {
                    layer.resetStyle(selectedLayerRef.current as L.Path)
                  }
                }
                selectedLayerRef.current = featureLayer
                ;(featureLayer as L.Path).setStyle({
                  fillColor: COR_SELECIONADO,
                  fillOpacity: 0.45,
                  color: COR_SELECIONADO,
                  weight: 2.5,
                })
                selecionarMunicipio(codigo)
              },
            })
          },
        }).addTo(map)
        geoLayerRef.current = layer
        buildMaskLayer(data).addTo(map)

        const geoBounds = layer.getBounds()
        if (geoBounds.isValid()) {
          const pad = L.point(8, 8)
          map.fitBounds(geoBounds, { padding: pad })
          const fitZoom = map.getBoundsZoom(geoBounds, false, pad)
          map.setMinZoom(Math.max(5, fitZoom - 1))
          map.setMaxBounds(geoBounds.pad(0.06))
        }
      })

    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Seleciona município ────────────────────────────────────────────────── */
  const selecionarMunicipio = useCallback(async (codigo: string) => {
    setPilar('mercado')
    setErroPerfil('')
    setPerfil(null)
    setDrawerAberto(true)

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

  /* ── Fly-to ─────────────────────────────────────────────────────────────── */
  const flyToMunicipio = useCallback((m: MunicipioResumo) => {
    setBusca('')
    setResultados([])
    selecionarMunicipio(m.codigo_ibge)

    const featureLayer = layerByCodRef.current.get(m.codigo_ibge)
    if (featureLayer && geoLayerRef.current && mapRef.current) {
      if (selectedLayerRef.current && selectedLayerRef.current !== featureLayer) {
        const prevCod = [...layerByCodRef.current.entries()]
          .find(([, v]) => v === selectedLayerRef.current)?.[0]
        if (prevCod && compararLayersRef.current.has(prevCod)) {
          const cor = compararLayersRef.current.get(prevCod)!
          ;(selectedLayerRef.current as L.Path).setStyle({ fillColor: cor, fillOpacity: 0.35, color: cor, weight: 2 })
        } else {
          geoLayerRef.current.resetStyle(selectedLayerRef.current as L.Path)
        }
      }
      selectedLayerRef.current = featureLayer
      ;(featureLayer as L.Path).setStyle({
        fillColor: COR_SELECIONADO, fillOpacity: 0.45, color: COR_SELECIONADO, weight: 2.5,
      })
      const bounds = (featureLayer as L.GeoJSON).getBounds?.()
      if (bounds?.isValid()) {
        mapRef.current.flyToBounds(bounds, { padding: [80, 80], maxZoom: 11, duration: 0.7 })
      }
    }
  }, [selecionarMunicipio])

  /* ── Busca ──────────────────────────────────────────────────────────────── */
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
    }, 280)
    return () => clearTimeout(t)
  }, [busca])

  /* ── Comparação ─────────────────────────────────────────────────────────── */
  const toggleComparar = useCallback((alvo?: MunicipioResumo) => {
    const mun = alvo ?? resumo
    if (!mun) return
    setComparar(prev => {
      const jaEsta = prev.some(m => m.codigo_ibge === mun.codigo_ibge)
      if (jaEsta) {
        compararLayersRef.current.delete(mun.codigo_ibge)
        const layer = layerByCodRef.current.get(mun.codigo_ibge)
        if (layer && geoLayerRef.current && selectedLayerRef.current !== layer) {
          geoLayerRef.current.resetStyle(layer as L.Path)
        }
        setComparMsg('')
        return prev.filter(m => m.codigo_ibge !== mun.codigo_ibge)
      }
      if (prev.length >= MAX_COMPARAR) {
        setComparMsg(`Máx. ${MAX_COMPARAR} municípios.`)
        setTimeout(() => setComparMsg(''), 2000)
        return prev
      }
      const cor = COMPARAR_CORES[prev.length % COMPARAR_CORES.length]
      compararLayersRef.current.set(mun.codigo_ibge, cor)
      const layer = layerByCodRef.current.get(mun.codigo_ibge)
      if (layer && selectedLayerRef.current !== layer) {
        ;(layer as L.Path).setStyle({ fillColor: cor, fillOpacity: 0.35, color: cor, weight: 2 })
      }
      setComparMsg(`${mun.nome} adicionado (${prev.length + 1}/${MAX_COMPARAR})`)
      setTimeout(() => setComparMsg(''), 2000)
      return [...prev, mun]
    })
  }, [resumo])

  const irParaComparar = () => {
    if (comparar.length >= 1) navigate(`/comparar?comparar=${comparar.map(m => m.codigo_ibge).join(',')}`)
  }

  useEffect(() => { aplicarEstiloComparar() }, [comparar, aplicarEstiloComparar])

  /* ── Fechar ─────────────────────────────────────────────────────────────── */
  const fechar = () => {
    setResumo(null)
    setPerfil(null)
    setErroPerfil('')
    setDrawerAberto(false)
    if (selectedLayerRef.current && geoLayerRef.current) {
      const codigo = [...layerByCodRef.current.entries()]
        .find(([, v]) => v === selectedLayerRef.current)?.[0]
      if (codigo && compararLayersRef.current.has(codigo)) {
        const cor = compararLayersRef.current.get(codigo)!
        ;(selectedLayerRef.current as L.Path).setStyle({ fillColor: cor, fillOpacity: 0.35, color: cor, weight: 2 })
      } else {
        geoLayerRef.current.resetStyle(selectedLayerRef.current as L.Path)
      }
      selectedLayerRef.current = null
    }
  }

  /* ── Indicadores ────────────────────────────────────────────────────────── */
  const destaqueKeys   = pilar === 'mercado' ? DESTAQUES_MERCADO : DESTAQUES_SOCIAL
  const indicadoresRaw = pilar === 'mercado' ? perfil?.mercado : perfil?.social
  const indicadores: IndicadorItem[] = indicadoresRaw
    ? [
        ...destaqueKeys.map(k => indicadoresRaw.find(i => i.chave === k)).filter(Boolean) as IndicadorItem[],
        ...indicadoresRaw.filter(i => !destaqueKeys.includes(i.chave)),
      ].slice(0, 4)
    : []

  const jaComparando = resumo ? comparar.some(m => m.codigo_ibge === resumo.codigo_ibge) : false

  /* ── Painel interno (reutilizado em desktop sidebar e mobile drawer) ─────── */
  const painelConteudo = (
    <>
      {/* Busca */}
      <div className="mp-search">
        <Search size={14} className="mp-search__icon" aria-hidden />
        <input
          ref={searchInputRef}
          className="mp-search__input"
          type="search"
          placeholder="Buscar município…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          aria-label="Buscar município"
        />
        {(busca || buscando) && (
          <button className="mp-search__clear" onClick={() => { setBusca(''); setResultados([]) }} aria-label="Limpar">
            {buscando ? <Spinner size="sm" /> : <X size={13} />}
          </button>
        )}
        <AnimatePresence>
          {resultados.length > 0 && (
            <motion.ul
              className="mp-results"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
            >
              {resultados.map(m => (
                <li key={m.codigo_ibge}>
                  <button className="mp-results__item" onClick={() => flyToMunicipio(m)}>
                    <MapPin size={12} />
                    <span className="mp-results__nome">{m.nome}</span>
                    {m.regiao_administrativa && (
                      <span className="mp-results__region">{m.regiao_administrativa}</span>
                    )}
                    <ChevronRight size={12} className="mp-results__arrow" />
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Barra comparação */}
      <AnimatePresence>
        {comparar.length > 0 && (
          <motion.div
            className="mp-compare-bar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16 }}
          >
            <div className="mp-compare-bar__head">
              <GitCompare size={13} />
              <span>{comparar.length} selecionado{comparar.length > 1 ? 's' : ''}</span>
              <button className="mp-compare-bar__go" onClick={irParaComparar}>
                <BarChart2 size={12} />
                {comparar.length === 1 ? 'Ver perfil' : 'Comparar'}
              </button>
            </div>
            <div className="mp-compare-bar__chips">
              {comparar.map((m, idx) => (
                <span
                  key={m.codigo_ibge}
                  className="mp-chip"
                  style={{ '--c': COMPARAR_CORES[idx % COMPARAR_CORES.length] } as React.CSSProperties}
                >
                  {m.nome.split(' ')[0]}
                  <button onClick={() => toggleComparar(m)} aria-label={`Remover ${m.nome}`}><X size={9} /></button>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corpo */}
      <div className="mp-body">
        <AnimatePresence mode="wait">
          {!resumo ? (
            <motion.div key="vazio" className="mp-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mp-empty__icon"><MapPin size={24} /></div>
              <p className="mp-empty__title">Selecione um município</p>
              <p className="mp-empty__desc">Clique no mapa ou use a busca acima.</p>
              <div className="mp-empty__tip">
                <Info size={12} />
                <span>Adicione até {MAX_COMPARAR} municípios para comparar.</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={resumo.codigo_ibge}
              className="mp-info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {/* Header município */}
              <div className="mp-info__head">
                <div className="mp-info__head-text">
                  <h2 className="mp-info__nome">{resumo.nome}</h2>
                  <p className="mp-info__meta">
                    {[resumo.mesorregiao, resumo.regiao_administrativa]
                      .filter(Boolean)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .join(' · ')}
                  </p>
                </div>
                <button className="mp-info__close" onClick={fechar} aria-label="Fechar"><X size={14} /></button>
              </div>

              {/* Botão comparar */}
              <button
                className={`mp-compare-btn${jaComparando ? ' mp-compare-btn--on' : ''}`}
                onClick={() => toggleComparar()}
              >
                {jaComparando
                  ? <><Check size={13} /> Na comparação</>
                  : <><GitCompare size={13} /> Adicionar à comparação</>}
              </button>

              {/* Tabs */}
              <div className="mp-tabs" role="tablist">
                <button
                  role="tab" aria-selected={pilar === 'mercado'}
                  className={`mp-tab${pilar === 'mercado' ? ' mp-tab--on mp-tab--market' : ''}`}
                  onClick={() => setPilar('mercado')}
                >
                  <TrendingUp size={13} /> Mercado
                </button>
                <button
                  role="tab" aria-selected={pilar === 'social'}
                  className={`mp-tab${pilar === 'social' ? ' mp-tab--on mp-tab--social' : ''}`}
                  onClick={() => setPilar('social')}
                >
                  <Users size={13} /> Social
                </button>
              </div>

              {/* Indicadores */}
              {carregandoPerfil ? (
                <div className="mp-loading"><Spinner size="sm" color="market" /><span>Carregando…</span></div>
              ) : erroPerfil ? (
                <div className="mp-error"><AlertCircle size={14} />{erroPerfil}</div>
              ) : (
                <div className="mp-inds">
                  {indicadores.map(ind => (
                    <div key={ind.chave} className="mp-ind">
                      <span className="mp-ind__label">{ind.nome}</span>
                      <div className="mp-ind__val-row">
                        <span className={`mp-ind__val mp-ind__val--${pilar}`}>{formatarValor(ind)}</span>
                        {ind.unidade && <span className="mp-ind__unit">{ind.unidade}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ações */}
              <div className="mp-actions">
                <button className="mp-btn mp-btn--primary" onClick={() => navigate(`/comparar?comparar=${resumo.codigo_ibge}`)}>
                  <BarChart2 size={13} /> Ver indicadores
                </button>
                <button
                  className="mp-btn mp-btn--ghost"
                  onClick={() => openAIChat({ codigo: resumo.codigo_ibge, nome: resumo.nome })}
                >
                  <Brain size={13} /> Analisar com IA
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legenda (só desktop) */}
      <div className="mp-legend">
        <span className="mp-legend__item"><span className="mp-legend__dot mp-legend__dot--default" />Município</span>
        <span className="mp-legend__item"><span className="mp-legend__dot mp-legend__dot--sel" />Selecionado</span>
        {comparar.map((m, i) => (
          <span key={m.codigo_ibge} className="mp-legend__item">
            <span className="mp-legend__dot" style={{ background: COMPARAR_CORES[i] + '55', borderColor: COMPARAR_CORES[i] }} />
            {m.nome.split(' ')[0]}
          </span>
        ))}
      </div>
    </>
  )

  return (
    <div className="mp-page">
      {/* ── PAINEL DESKTOP (sidebar esquerdo) ─────────────────────────────── */}
      <aside className="mp-sidebar">
        <div className="mp-sidebar__header">
          <div className="mp-sidebar__icon"><Layers size={16} /></div>
          <div>
            <h1 className="mp-sidebar__title">Municípios SP</h1>
            <span className="mp-sidebar__sub">645 municípios · Estado de São Paulo</span>
          </div>
        </div>
        {painelConteudo}
      </aside>

      {/* ── ÁREA DO MAPA ──────────────────────────────────────────────────── */}
      <div className="mp-map-area">
        <div ref={mapElRef} className="mp-map" aria-label="Mapa interativo dos municípios de SP" />

        {/* Tooltip seguindo o cursor */}
        {tooltip && (
          <div
            className="mp-tooltip"
            style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
          >
            {tooltip.nome}
          </div>
        )}

        {/* Toast comparação */}
        <AnimatePresence>
          {compararMsg && (
            <motion.div className="mp-toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
              {compararMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTÃO MOBILE: abre painel quando há município selecionado */}
        <AnimatePresence>
          {resumo && !drawerAberto && (
            <motion.button
              className="mp-fab"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              onClick={() => setDrawerAberto(true)}
            >
              <MapPin size={16} />
              <span>{resumo.nome}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── DRAWER MOBILE ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerAberto && (
          <>
            <motion.div
              className="mp-drawer-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerAberto(false)}
            />
            <motion.div
              className="mp-drawer"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              <div className="mp-drawer__handle" onClick={() => setDrawerAberto(false)} />
              <div className="mp-drawer__header">
                <div className="mp-sidebar__icon"><Layers size={15} /></div>
                <div>
                  <h2 className="mp-sidebar__title">Municípios SP</h2>
                </div>
                <button className="mp-drawer__close" onClick={() => setDrawerAberto(false)} aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>
              <div className="mp-drawer__scroll">
                {painelConteudo}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
