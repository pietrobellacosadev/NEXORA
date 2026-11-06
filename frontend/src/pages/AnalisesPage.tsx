import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Brain, Trash2, Search, Clock, ChevronRight,
  TrendingUp, Users, BookOpen, AlertCircle, CheckCircle,
  ShieldCheck, BarChart2,
} from 'lucide-react'
import type { ResultadoConsolidado } from '../types'
import './AnalisesPage.css'

export const ANALISES_STORAGE_KEY = 'nexora-analises-recentes'
export const ANALISES_MAX = 20

export interface AnaliseRecord {
  id: string
  municipio: string
  codigo_ibge: string
  pergunta: string
  data: string          // ISO string
  resultado: ResultadoConsolidado
}

export function salvarAnalise(r: ResultadoConsolidado) {
  try {
    const lista: AnaliseRecord[] = JSON.parse(
      localStorage.getItem(ANALISES_STORAGE_KEY) ?? '[]'
    )
    const nova: AnaliseRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      municipio: r.municipio,
      codigo_ibge: r.codigo_ibge,
      pergunta: r.pergunta,
      data: new Date().toISOString(),
      resultado: r,
    }
    // Remove duplicata com mesma pergunta + município (mantém a mais recente)
    const filtrado = lista.filter(
      a => !(a.codigo_ibge === nova.codigo_ibge && a.pergunta === nova.pergunta)
    )
    const atualizado = [nova, ...filtrado].slice(0, ANALISES_MAX)
    localStorage.setItem(ANALISES_STORAGE_KEY, JSON.stringify(atualizado))
  } catch {
    // localStorage cheio ou bloqueado — ignora silenciosamente
  }
}

function formatarData(iso: string): string {
  const d = new Date(iso)
  const agora = new Date()
  const diff = agora.getTime() - d.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1)  return 'Agora mesmo'
  if (min < 60) return `Há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `Há ${h}h`
  const dias = Math.floor(h / 24)
  if (dias === 1) return 'Ontem'
  if (dias < 7)   return `Há ${dias} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function AnalisesPage() {
  const navigate = useNavigate()
  const [analises, setAnalises] = useState<AnaliseRecord[]>([])
  const [aberta, setAberta] = useState<AnaliseRecord | null>(null)
  const [busca, setBusca] = useState('')
  const [secaoAberta, setSecaoAberta] = useState<string | null>(null)

  useEffect(() => {
    function carregarAnalises() {
      try {
        const lista: AnaliseRecord[] = JSON.parse(
          localStorage.getItem(ANALISES_STORAGE_KEY) ?? '[]'
        )
        setAnalises(lista)
      } catch {
        setAnalises([])
      }
    }
    carregarAnalises()
    // Relê quando outra aba salva uma análise
    window.addEventListener('storage', carregarAnalises)
    window.addEventListener('focus', carregarAnalises)
    return () => {
      window.removeEventListener('storage', carregarAnalises)
      window.removeEventListener('focus', carregarAnalises)
    }
  }, [])

  function remover(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const nova = analises.filter(a => a.id !== id)
    setAnalises(nova)
    localStorage.setItem(ANALISES_STORAGE_KEY, JSON.stringify(nova))
    if (aberta?.id === id) setAberta(null)
  }

  function limparTudo() {
    setAnalises([])
    setAberta(null)
    localStorage.removeItem(ANALISES_STORAGE_KEY)
  }

  const filtradas = busca.trim().length >= 2
    ? analises.filter(a =>
        a.municipio.toLowerCase().includes(busca.toLowerCase()) ||
        a.pergunta.toLowerCase().includes(busca.toLowerCase())
      )
    : analises

  const toggleSecao = (key: string) =>
    setSecaoAberta(s => s === key ? null : key)

  return (
    <motion.div
      className="analises"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Cabeçalho */}
      <div className="analises__header">
        <div className="analises__header-icon">
          <Brain size={22} />
        </div>
        <div className="analises__header-text">
          <h1 className="analises__title">
            Análises Recentes
            {analises.length > 0 && (
              <span className="analises__count-badge">{analises.length}</span>
            )}
          </h1>
          <p className="analises__subtitle">
            Histórico das investigações por IA — salvo localmente no navegador.
          </p>
        </div>
        {analises.length > 0 && (
          <button className="analises__limpar" onClick={limparTudo} title="Limpar histórico">
            <Trash2 size={14} />
            Limpar tudo
          </button>
        )}
      </div>

      {/* Grid principal */}
      <div className="analises__layout">
        {/* Lista */}
        <aside className="analises__lista-wrap">
          {/* Busca */}
          <div className="analises__search-wrap">
            <Search size={13} className="analises__search-icon" aria-hidden="true" />
            <input
              className="analises__search"
              type="search"
              placeholder="Filtrar por município ou pergunta…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          {filtradas.length === 0 ? (
            <div className="analises__empty">
              {analises.length === 0 ? (
                <>
                  <div className="analises__empty-icon"><Brain size={24} /></div>
                  <p className="analises__empty-title">Nenhuma análise ainda</p>
                  <p className="analises__empty-desc">
                    Use a página <strong>Investigar</strong> para gerar análises por IA.
                    Elas aparecerão aqui automaticamente.
                  </p>
                  <button
                    className="analises__ir-btn"
                    onClick={() => navigate('/investigar')}
                  >
                    <Brain size={14} />
                    Ir para Investigar
                  </button>
                </>
              ) : (
                <>
                  <div className="analises__empty-icon"><Search size={24} /></div>
                  <p className="analises__empty-title">Nenhum resultado</p>
                  <p className="analises__empty-desc">Tente outro termo de busca.</p>
                </>
              )}
            </div>
          ) : (
            <ul className="analises__lista">
              {filtradas.map(a => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                >
                  <button
                    className={`analises__item${aberta?.id === a.id ? ' analises__item--active' : ''}`}
                    onClick={() => { setAberta(a); setSecaoAberta(null) }}
                  >
                    <div className="analises__item-main">
                      <span className="analises__item-municipio">{a.municipio}</span>
                      <span className="analises__item-pergunta">{a.pergunta}</span>
                    </div>
                    <div className="analises__item-meta">
                      <span className="analises__item-data">
                        <Clock size={11} />
                        {formatarData(a.data)}
                      </span>
                      <button
                        className="analises__item-del"
                        onClick={e => remover(a.id, e)}
                        title="Remover"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <ChevronRight size={13} className="analises__item-arrow" />
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </aside>

        {/* Detalhe */}
        <div className="analises__detalhe">
          <AnimatePresence mode="wait">
            {!aberta ? (
              <motion.div
                key="vazio"
                className="analises__detalhe-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Brain size={28} />
                <p>Selecione uma análise para visualizar</p>
              </motion.div>
            ) : (
              <motion.div
                key={aberta.id}
                className="analises__detalhe-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Cabeçalho do detalhe */}
                <div className="analises__det-header">
                  <div>
                    <h2 className="analises__det-municipio">{aberta.municipio}</h2>
                    <p className="analises__det-pergunta">"{aberta.pergunta}"</p>
                    <span className="analises__det-data">
                      <Clock size={11} /> {formatarData(aberta.data)} · {new Date(aberta.data).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="analises__det-actions">
                    <button
                      className="analises__det-btn"
                      onClick={() => navigate(`/perfil/${aberta.codigo_ibge}`)}
                      title="Ver perfil completo"
                    >
                      <BarChart2 size={13} /> Perfil
                    </button>
                    <button
                      className="analises__det-btn analises__det-btn--ghost"
                      onClick={() => navigate(`/investigar?municipio=${aberta.codigo_ibge}&nome=${encodeURIComponent(aberta.municipio)}`)}
                      title="Nova investigação"
                    >
                      <Brain size={13} /> Nova investigação
                    </button>
                  </div>
                </div>

                {/* Síntese */}
                <div className="analises__sintese">
                  <div className="analises__sintese-hd">
                    <Brain size={14} className="analises__sintese-icon" />
                    <span className="analises__badge">Consolidador</span>
                    <span className="analises__ia-flag"><ShieldCheck size={11} /> Gerado por IA</span>
                  </div>
                  <p className="analises__sintese-text">{aberta.resultado.sintese}</p>
                  <p className="analises__conclusao">{aberta.resultado.conclusao}</p>
                </div>

                {/* Pilares */}
                <div className="analises__pilares">
                  {(['mercado', 'social'] as const).map(pilar => {
                    const r = aberta.resultado[pilar]
                    const isOpen = secaoAberta === pilar
                    return (
                      <div key={pilar} className={`analises__pilar analises__pilar--${pilar}`}>
                        <button className="analises__pilar-hd" onClick={() => toggleSecao(pilar)}>
                          <div className="analises__pilar-icon">
                            {pilar === 'mercado' ? <TrendingUp size={14} /> : <Users size={14} />}
                          </div>
                          <span className="analises__pilar-title">
                            {pilar === 'mercado' ? 'Mercado' : 'Social'}
                          </span>
                          <span className="analises__pilar-count">{r?.constatacoes?.length ?? 0} constatações</span>
                          <ChevronRight size={13} className={`analises__pilar-chevron${isOpen ? ' analises__pilar-chevron--open' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              className="analises__pilar-body"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              {(r?.constatacoes ?? []).length > 0 && (
                                <ul className="analises__pilar-list">
                                  {r.constatacoes.map((c, i) => <li key={i}>{c}</li>)}
                                </ul>
                              )}
                              {(r?.fontes ?? []).length > 0 && (
                                <div className="analises__pilar-meta">
                                  <BookOpen size={11} /> Fontes: {r.fontes.join(', ')}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>

                {/* Convergências / Divergências */}
                {(aberta.resultado.convergencias?.length > 0 || aberta.resultado.divergencias?.length > 0) && (
                  <div className="analises__cvd">
                    {aberta.resultado.convergencias?.length > 0 && (
                      <div className="analises__cvd-block analises__cvd-block--green">
                        <h3 className="analises__cvd-title"><CheckCircle size={13} /> Convergências</h3>
                        <ul>{aberta.resultado.convergencias.map((c, i) => <li key={i}>{c}</li>)}</ul>
                      </div>
                    )}
                    {aberta.resultado.divergencias?.length > 0 && (
                      <div className="analises__cvd-block analises__cvd-block--warn">
                        <h3 className="analises__cvd-title"><AlertCircle size={13} /> Divergências</h3>
                        <ul>{aberta.resultado.divergencias.map((d, i) => <li key={i}>{d}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
