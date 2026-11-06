import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Brain, TrendingUp, Users, Search, Send,
  CheckCircle, AlertCircle, Loader, ChevronDown, ChevronUp,
  ShieldCheck, BookOpen, MapPin, X,
} from 'lucide-react'
import api from '../lib/api'
import type { MunicipioResumo, ResultadoConsolidado } from '../types'
import { salvarAnalise } from './AnalisesPage'
import './InvestigarPage.css'

type EstadoAgente = 'idle' | 'running' | 'done' | 'error'

interface EstadoInvestigacao {
  geral: 'idle' | 'loading' | 'done' | 'error'
  market: EstadoAgente
  social: EstadoAgente
  consolidator: EstadoAgente
}

const ESTADO_INICIAL: EstadoInvestigacao = {
  geral: 'idle', market: 'idle', social: 'idle', consolidator: 'idle',
}

export default function InvestigarPage() {
  const [params] = useSearchParams()

  // Município pode vir por URL como código ou nome
  const codigoParam = params.get('municipio') ?? ''
  const nomeParam   = params.get('nome') ?? ''

  const [codigoIBGE, setCodigoIBGE] = useState(codigoParam)
  const [nomeBusca, setNomeBusca]   = useState(nomeParam || codigoParam)
  // municipioResolvido: quando o usuário já selecionou um município válido
  const [municipioResolvido, setMunicipioResolvido] = useState<MunicipioResumo | null>(
    codigoParam && nomeParam ? { codigo_ibge: codigoParam, nome: nomeParam } : null
  )
  const [sugestoes, setSugestoes]   = useState<MunicipioResumo[]>([])
  const [buscandoMuni, setBuscandoMuni] = useState(false)
  const dropdownRef = useRef<HTMLUListElement>(null)

  const [pergunta, setPergunta] = useState('')
  const [estado, setEstado] = useState<EstadoInvestigacao>(ESTADO_INICIAL)
  const [resultado, setResultado] = useState<ResultadoConsolidado | null>(null)
  const [erro, setErro] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Busca reativa por nome
  useEffect(() => {
    if (municipioResolvido) return   // já resolvido, não busca mais
    if (nomeBusca.trim().length < 2) { setSugestoes([]); return }
    const t = setTimeout(async () => {
      setBuscandoMuni(true)
      try {
        const { data } = await api.get<{ municipios: MunicipioResumo[] }>(
          `/municipios?q=${encodeURIComponent(nomeBusca.trim())}&limite=8`
        )
        setSugestoes(data.municipios)
      } finally {
        setBuscandoMuni(false)
      }
    }, 280)
    return () => clearTimeout(t)
  }, [nomeBusca, municipioResolvido])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setSugestoes([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selecionarMunicipio(m: MunicipioResumo) {
    setCodigoIBGE(m.codigo_ibge)
    setNomeBusca(m.nome)
    setMunicipioResolvido(m)
    setSugestoes([])
  }

  function limparMunicipio() {
    setCodigoIBGE('')
    setNomeBusca('')
    setMunicipioResolvido(null)
    setSugestoes([])
  }

  const podeInvestigar = codigoIBGE.trim().length >= 7 && pergunta.trim().length >= 10

  async function investigar() {
    if (!podeInvestigar) return
    setErro('')
    setResultado(null)
    setEstado({ geral: 'loading', market: 'running', social: 'running', consolidator: 'idle' })

    try {
      const timer = setTimeout(() => {
        setEstado(s => ({ ...s, market: 'done', social: 'done', consolidator: 'running' }))
      }, 2000)

      const { data } = await api.post<ResultadoConsolidado>('/investigar', {
        codigo_ibge: codigoIBGE.trim(),
        pergunta: pergunta.trim(),
      })

      clearTimeout(timer)
      setEstado({ geral: 'done', market: 'done', social: 'done', consolidator: 'done' })
      setResultado(data)
      salvarAnalise(data)
      // Auto-expande ambos os pilares na primeira exibição
      setExpanded('market')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (e as { message?: string })?.message ?? 'Erro desconhecido'
      setEstado({ geral: 'error', market: 'error', social: 'error', consolidator: 'error' })
      setErro(msg)
    }
  }

  const toggle = (key: string) => setExpanded(e => e === key ? null : key)

  return (
    <motion.div
      className="inv"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >

      {/* Cabeçalho */}
      <div className="inv__header">
        <div className="inv__header-icon">
          <Brain size={22} />
        </div>
        <div>
          <h1 className="inv__title">Investigação por IA</h1>
          <p className="inv__subtitle">
            Três agentes especializados investigam em paralelo e o Consolidador sintetiza a análise.
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="inv__form">
        <div className="inv__fields">

          {/* Campo do município — busca por nome ou código */}
          <div className="inv__field">
            <label className="inv__label" htmlFor="inv-municipio">Município</label>

            {municipioResolvido ? (
              /* Município confirmado — mostra pill */
              <div className="inv__muni-resolved">
                <MapPin size={13} />
                <span style={{ flex: 1 }}>{municipioResolvido.nome}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{municipioResolvido.codigo_ibge}</span>
                <button onClick={limparMunicipio} aria-label="Remover município">
                  <X size={13} />
                </button>
              </div>
            ) : (
              /* Campo de busca */
              <div className="inv__muni-wrap">
                <input
                  id="inv-municipio"
                  className="inv__input"
                  type="search"
                  placeholder="Nome ou código IBGE…"
                  value={nomeBusca}
                  onChange={e => { setNomeBusca(e.target.value); setCodigoIBGE('') }}
                  autoComplete="off"
                />
                <AnimatePresence>
                  {(sugestoes.length > 0 || buscandoMuni) && (
                    <motion.ul
                      ref={dropdownRef}
                      className="inv__muni-dropdown"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                    >
                      {buscandoMuni && (
                        <li style={{ padding: '8px 12px', color: 'var(--color-muted)', fontSize: 'var(--text-xs)' }}>
                          <Loader size={12} style={{ display: 'inline', marginRight: 6, animation: 'spin 0.9s linear infinite' }} />
                          Buscando…
                        </li>
                      )}
                      {sugestoes.map(m => (
                        <li key={m.codigo_ibge}>
                          <button
                            className="inv__muni-item"
                            onMouseDown={() => selecionarMunicipio(m)}
                          >
                            <MapPin size={12} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
                            <span className="inv__muni-nome">{m.nome}</span>
                            <span className="inv__muni-codigo">{m.codigo_ibge}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Campo da pergunta */}
          <div className="inv__field inv__field--grow">
            <label className="inv__label" htmlFor="inv-pergunta">Pergunta de investigação</label>
            <input
              id="inv-pergunta"
              className="inv__input"
              type="text"
              placeholder="Ex: Quais são as oportunidades de expansão de conectividade neste município?"
              value={pergunta}
              onChange={e => setPergunta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && investigar()}
            />
          </div>
        </div>

        <motion.button
          className="inv__btn"
          onClick={investigar}
          disabled={!podeInvestigar || estado.geral === 'loading'}
          whileTap={{ scale: 0.97 }}
          whileHover={podeInvestigar ? { scale: 1.02 } : undefined}
        >
          {estado.geral === 'loading'
            ? <><Loader size={15} className="inv__btn-spin" /> Investigando…</>
            : <><Send size={15} /> Investigar</>
          }
        </motion.button>
      </div>

      {/* Fluxo dos agentes */}
      <AnimatePresence>
        {estado.geral !== 'idle' && (
          <motion.div
            className="inv__flow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AgentStep
              icon={<TrendingUp size={16} />}
              label="Agente de Mercado"
              desc="Potencial comercial e indicadores ANATEL/IBGE"
              estado={estado.market}
              color="market"
            />
            <AgentStep
              icon={<Users size={16} />}
              label="Agente Social"
              desc="Necessidades sociais e indicadores INEP/DATASUS"
              estado={estado.social}
              color="social"
            />
            <div className="inv__flow-arrow" aria-hidden="true" />
            <AgentStep
              icon={<Brain size={16} />}
              label="Agente Consolidador"
              desc="Síntese equilibrada dos dois pilares"
              estado={estado.consolidator}
              color="ai"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Erro */}
      <AnimatePresence>
        {erro && (
          <motion.div
            className="inv__error"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <AlertCircle size={16} />
            {erro}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resultado */}
      <AnimatePresence>
        {resultado && (
          <motion.div
            className="inv__resultado"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Síntese */}
            <div className="inv__sintese">
              <div className="inv__sintese-header">
                <Brain size={16} className="inv__sintese-icon" />
                <span className="inv__badge inv__badge--ai">Consolidador</span>
                <span className="inv__ia-flag">
                  <ShieldCheck size={11} />
                  Gerado por IA
                </span>
              </div>
              <p className="inv__sintese-text">{resultado.sintese}</p>
              <p className="inv__conclusao">{resultado.conclusao}</p>
            </div>

            {/* Pilares */}
            <div className="inv__pilares">
              <ResultSection
                title="Potencial de Mercado"
                icon={<TrendingUp size={15} />}
                color="market"
                items={resultado.mercado?.constatacoes ?? []}
                fontes={resultado.mercado?.fontes ?? []}
                limitacoes={resultado.mercado?.limitacoes ?? []}
                ausentes={resultado.mercado?.dados_ausentes ?? []}
                expanded={expanded === 'market'}
                onToggle={() => toggle('market')}
              />
              <ResultSection
                title="Potencial Social"
                icon={<Users size={15} />}
                color="social"
                items={resultado.social?.constatacoes ?? []}
                fontes={resultado.social?.fontes ?? []}
                limitacoes={resultado.social?.limitacoes ?? []}
                ausentes={resultado.social?.dados_ausentes ?? []}
                expanded={expanded === 'social'}
                onToggle={() => toggle('social')}
              />
            </div>

            {/* Convergências / Divergências */}
            {(resultado.convergencias?.length > 0 || resultado.divergencias?.length > 0) && (
              <div className="inv__cvd">
                {resultado.convergencias?.length > 0 && (
                  <div className="inv__cvd-block inv__cvd-block--green">
                    <h3 className="inv__cvd-title">
                      <CheckCircle size={14} />
                      Convergências
                    </h3>
                    <ul>{resultado.convergencias.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </div>
                )}
                {resultado.divergencias?.length > 0 && (
                  <div className="inv__cvd-block inv__cvd-block--warn">
                    <h3 className="inv__cvd-title">
                      <AlertCircle size={14} />
                      Divergências
                    </h3>
                    <ul>{resultado.divergencias.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {/* Dados ausentes */}
            {resultado.dados_insuficientes?.length > 0 && (
              <div className="inv__ausentes">
                <Search size={14} />
                <div>
                  <strong>Dados insuficientes:</strong>
                  <ul>{resultado.dados_insuficientes.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
              </div>
            )}

            {/* Fontes */}
            {resultado.fontes_consultadas?.length > 0 && (
              <div className="inv__fontes">
                <BookOpen size={14} />
                <div>
                  <strong>Fontes consultadas:</strong>{' '}
                  {resultado.fontes_consultadas.join(' · ')}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}

/* ── Componentes auxiliares ──────────────────────────────────────────────── */

function AgentStep({ icon, label, desc, estado, color }: {
  icon: React.ReactNode
  label: string
  desc: string
  estado: EstadoAgente
  color: 'market' | 'social' | 'ai'
}) {
  return (
    <div className={`inv__agent inv__agent--${color} inv__agent--${estado}`}>
      <div className="inv__agent-icon">{icon}</div>
      <div className="inv__agent-body">
        <div className="inv__agent-label">{label}</div>
        <div className="inv__agent-desc">{desc}</div>
      </div>
      <div className="inv__agent-status">
        {estado === 'running' && <Loader size={14} className="inv__agent-spin" />}
        {estado === 'done'    && <CheckCircle size={14} />}
        {estado === 'error'   && <AlertCircle size={14} />}
      </div>
    </div>
  )
}

function ResultSection({ title, icon, color, items, fontes, limitacoes, ausentes, expanded, onToggle }: {
  title: string
  icon: React.ReactNode
  color: 'market' | 'social'
  items: string[]
  fontes: string[]
  limitacoes: string[]
  ausentes: string[]
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className={`inv__pilar inv__pilar--${color}`}>
      <button className="inv__pilar-header" onClick={onToggle}>
        <div className="inv__pilar-icon">{icon}</div>
        <span className="inv__pilar-title">{title}</span>
        <span className="inv__pilar-count">{items.length} constatações</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="inv__pilar-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {items.length > 0 && (
              <ul className="inv__pilar-list">
                {items.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            )}
            {fontes.length > 0 && (
              <div className="inv__pilar-meta">
                <BookOpen size={11} /> Fontes: {fontes.join(', ')}
              </div>
            )}
            {limitacoes.length > 0 && (
              <div className="inv__pilar-meta inv__pilar-meta--warn">
                <AlertCircle size={11} /> Limitações: {limitacoes.join('. ')}
              </div>
            )}
            {ausentes.length > 0 && (
              <div className="inv__pilar-meta inv__pilar-meta--warn">
                <Search size={11} /> Ausentes: {ausentes.join(', ')}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
