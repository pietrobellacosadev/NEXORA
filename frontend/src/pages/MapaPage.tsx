import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { MapPin, Search, X, Layers, ExternalLink } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../lib/api'
import type { MunicipioResumo } from '../types'
import Spinner from '../components/ui/Spinner'
import './MapaPage.css'

export default function MapaPage() {
  const navigate = useNavigate()
  const mapRef = useRef<L.Map | null>(null)
  const mapElRef = useRef<HTMLDivElement>(null)
  const geoLayerRef = useRef<L.GeoJSON | null>(null)
  const selectedLayerRef = useRef<L.Layer | null>(null)
  const nomesRef = useRef<Map<string, string>>(new Map())

  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<MunicipioResumo[]>([])
  const [buscando, setBuscando] = useState(false)
  const [selecionado, setSelecionado] = useState<MunicipioResumo | null>(null)
  const [tooltip, setTooltip] = useState('')

  // Inicializa o mapa Leaflet
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return

    const map = L.map(mapElRef.current, {
      center: [-22.5, -48.5],
      zoom: 7,
      zoomControl: false,
      attributionControl: true,
    })

    // Dark "no-labels" tile — matches NEXORA's #101827 palette
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      maxZoom: 13,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/" target="_blank">CARTO</a>',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    mapRef.current = map

    // Pré-carrega mapa de nomes (código → nome) para o tooltip
    api.get<{ municipios: MunicipioResumo[] }>('/municipios?limite=700')
      .then(({ data }) => {
        data.municipios.forEach(m => nomesRef.current.set(m.codigo_ibge, m.nome))
      })
      .catch(() => { /* tooltip degradará para código IBGE */ })

    // Carrega GeoJSON
    fetch('/sp_municipios.geojson')
      .then(r => r.json())
      .then(data => {
        const layer = L.geoJSON(data, {
          style: {
            fillColor: '#63A7F2',
            fillOpacity: 0.12,
            color: '#63A7F2',
            weight: 0.9,
            opacity: 0.7,
          },
          onEachFeature(feature, featureLayer) {
            const codigo = feature.properties?.codarea
            featureLayer.on({
              mouseover(e) {
                const l = e.target as L.Path
                l.setStyle({ fillOpacity: 0.2, weight: 1.5 })
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
                // Restaura estilo anterior selecionado
                if (selectedLayerRef.current) {
                  layer.resetStyle(selectedLayerRef.current as L.Path)
                }
                selectedLayerRef.current = featureLayer
                ;(featureLayer as L.Path).setStyle({
                  fillColor: '#20B8A5',
                  fillOpacity: 0.40,
                  color: '#20B8A5',
                  weight: 2.5,
                })
                buscarMunicipio(codigo)
              },
            })
          },
        }).addTo(map)
        geoLayerRef.current = layer
      })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  const buscarMunicipio = useCallback(async (codigo: string) => {
    try {
      const { data } = await api.get<MunicipioResumo>(`/municipios/${codigo}`)
      setSelecionado(data)
    } catch {
      setSelecionado(null)
    }
  }, [])

  // Busca por texto
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

  return (
    <motion.div
      className="mapa-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >

      {/* Painel lateral */}
      <aside className="mapa-panel">
        <div className="mapa-panel__header">
          <MapPin size={16} className="mapa-panel__header-icon" aria-hidden="true" />
          <h1 className="mapa-panel__title">Mapa territorial</h1>
        </div>

        {/* Busca */}
        <div className="mapa-search">
          <Search size={15} className="mapa-search__icon" aria-hidden="true" />
          <input
            className="mapa-search__input"
            type="search"
            placeholder="Buscar município…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            aria-label="Buscar município"
          />
          {busca && (
            <button className="mapa-search__clear" onClick={() => { setBusca(''); setResultados([]) }} aria-label="Limpar busca">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Resultados da busca */}
        <AnimatePresence>
          {resultados.length > 0 && (
            <motion.ul
              className="mapa-results"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {resultados.map(m => (
                <li key={m.codigo_ibge}>
                  <button
                    className="mapa-results__item"
                    onClick={() => {
                      setBusca('')
                      setResultados([])
                      setSelecionado(m)
                    }}
                  >
                    <MapPin size={13} aria-hidden="true" />
                    <span>{m.nome}</span>
                    {m.regiao_administrativa && (
                      <span className="mapa-results__region">{m.regiao_administrativa}</span>
                    )}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {/* Info do município selecionado */}
        <AnimatePresence mode="wait">
          {selecionado ? (
            <motion.div
              key={selecionado.codigo_ibge}
              className="mapa-info"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mapa-info__header">
                <div>
                  <h2 className="mapa-info__nome">{selecionado.nome}</h2>
                  {selecionado.mesorregiao && (
                    <p className="mapa-info__region">{selecionado.mesorregiao}</p>
                  )}
                </div>
                <button className="mapa-info__close" onClick={() => setSelecionado(null)} aria-label="Fechar">
                  <X size={14} />
                </button>
              </div>
              <dl className="mapa-info__dl">
                <dt>Código IBGE</dt><dd>{selecionado.codigo_ibge}</dd>
                {selecionado.microrregiao && <><dt>Microrregião</dt><dd>{selecionado.microrregiao}</dd></>}
                {selecionado.populacao_estimada && (
                  <><dt>População estimada</dt><dd>{selecionado.populacao_estimada.toLocaleString('pt-BR')}</dd></>
                )}
              </dl>
              <div className="mapa-info__actions">
                <button
                  className="mapa-info__btn mapa-info__btn--primary"
                  onClick={() => navigate(`/perfil/${selecionado.codigo_ibge}`)}
                >
                  <Layers size={14} aria-hidden="true" />
                  Ver perfil
                </button>
                <button
                  className="mapa-info__btn mapa-info__btn--ghost"
                  onClick={() => navigate(`/investigar?municipio=${selecionado.codigo_ibge}&nome=${encodeURIComponent(selecionado.nome)}`)}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  Investigar
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="hint"
              className="mapa-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <img src="/nexora-icon.svg" alt="" className="mapa-hint__logo" />
              <p>Clique em um município no mapa ou use a busca acima para ver suas informações.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legenda */}
        <div className="mapa-legend">
          <div className="mapa-legend__title">Legenda</div>
          <div className="mapa-legend__items">
            <div className="mapa-legend__item">
              <span className="mapa-legend__dot mapa-legend__dot--default" />
              <span>Município</span>
            </div>
            <div className="mapa-legend__item">
              <span className="mapa-legend__dot mapa-legend__dot--selected" />
              <span>Selecionado</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mapa */}
      <div className="mapa-container">
        <div ref={mapElRef} className="mapa-leaflet" aria-label="Mapa interativo dos municípios do Estado de São Paulo" />
        {buscando && (
          <div className="mapa-loading">
            <Spinner size="sm" />
          </div>
        )}
        {tooltip && (
          <div className="mapa-tooltip">{tooltip}</div>
        )}
      </div>

    </motion.div>
  )
}
