import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Brain, Trash2, Search, Clock, ChevronRight, ChevronDown,
  TrendingUp, Users, BookOpen, AlertCircle, CheckCircle2,
  ShieldCheck, BarChart2, Zap, AlertTriangle, DollarSign,
  GitMerge, FileText, MapPin, Wifi, Star, X,
} from 'lucide-react'
import type { ResultadoConsolidado, ViabilidadeFinanceira } from '../types'
import { openAIChat } from '../components/ui/AIFab'
import './AnalisesPage.css'

export const ANALISES_STORAGE_KEY = 'nexora-analises-recentes'
export const ANALISES_MAX = 20

export interface AnaliseRecord {
  id: string
  municipio: string
  codigo_ibge: string
  pergunta: string
  data: string
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
    const filtrado = lista.filter(
      a => !(a.codigo_ibge === nova.codigo_ibge && a.pergunta === nova.pergunta)
    )
    const atualizado = [nova, ...filtrado].slice(0, ANALISES_MAX)
    localStorage.setItem(ANALISES_STORAGE_KEY, JSON.stringify(atualizado))
  } catch { /* localStorage cheio */ }
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
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function classificacaoCor(c?: string): 'market' | 'ok' | 'warn' | 'muted' {
  if (!c) return 'muted'
  const u = c.toUpperCase()
  if (u.includes('ALTO') || u.includes('RECOMENDADO') && !u.includes('RESSALVAS')) return 'ok'
  if (u.includes('MÉDIO') || u.includes('RESSALVAS')) return 'market'
  if (u.includes('BAIXO') || u.includes('NÃO')) return 'warn'
  return 'market'
}

// ── Seção colapsável ──────────────────────────────────────────────────────────
function SecaoColapsavel({
  titulo, icone, cor, count, children, defaultOpen = false,
}: {
  titulo: string
  icone: React.ReactNode
  cor: 'market' | 'social' | 'ai' | 'warn' | 'ok'
  count?: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [aberto, setAberto] = useState(defaultOpen)
  return (
    <div className={`ar__secao ar__secao--${cor}`}>
      <button className="ar__secao-hd" onClick={() => setAberto(o => !o)}>
        <div className={`ar__secao-icon ar__secao-icon--${cor}`}>{icone}</div>
        <span className="ar__secao-titulo">{titulo}</span>
        {count !== undefined && <span className="ar__secao-count">{count}</span>}
        <ChevronDown size={14} className={`ar__secao-chevron${aberto ? ' ar__secao-chevron--open' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            className="ar__secao-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ar__secao-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Painel de relatório completo ──────────────────────────────────────────────
function RelatorioView({ analise }: { analise: AnaliseRecord }) {
  const navigate = useNavigate()
  const r = analise.resultado
  const vf = r.viabilidade_financeira as ViabilidadeFinanceira | undefined
  const cor = classificacaoCor(vf?.classificacao ?? vf?.recomendacao_analista)

  const kpis = [
    vf?.tipo_rede_recomendado && { label: 'Tecnologia', valor: vf.tipo_rede_recomendado, cor: 'ai' as const, icone: <Wifi size={13} /> },
    vf?.investimento_estimado_range && { label: 'Investimento', valor: vf.investimento_estimado_range, cor: 'market' as const, icone: <DollarSign size={13} /> },
    vf?.payback_anos && { label: 'Payback', valor: vf.payback_anos, cor: 'market' as const, icone: <Clock size={13} /> },
    vf?.classificacao && { label: 'Viabilidade', valor: vf.classificacao, cor: classificacaoCor(vf.classificacao) as 'ok' | 'market' | 'warn', icone: <Star size={13} /> },
  ].filter(Boolean) as Array<{ label: string; valor: string; cor: string; icone: React.ReactNode }>

  return (
    <div className="ar__relatorio">
      {/* ── Cabeçalho do relatório ── */}
      <div className="ar__rel-header">
        <div className="ar__rel-header-left">
          <div className="ar__rel-muni">
            <MapPin size={15} className="ar__rel-muni-icon" />
            <h2 className="ar__rel-muni-nome">{analise.municipio}</h2>
          </div>
          <p className="ar__rel-pergunta">"{analise.pergunta}"</p>
          <div className="ar__rel-meta">
            <span><Clock size={11} /> {formatarData(analise.data)}</span>
            <span>·</span>
            <span>{new Date(analise.data).toLocaleString('pt-BR')}</span>
            <span className="ar__ia-badge"><ShieldCheck size={10} /> Gerado por IA</span>
          </div>
        </div>
        <div className="ar__rel-header-actions">
          <button
            className="ar__action-btn ar__action-btn--ghost"
            onClick={() => navigate(`/comparar?comparar=${analise.codigo_ibge}`)}
          >
            <BarChart2 size={13} /> Indicadores
          </button>
          <button
            className="ar__action-btn ar__action-btn--primary"
            onClick={() => openAIChat({ codigo: analise.codigo_ibge, nome: analise.municipio })}
          >
            <Brain size={13} /> Nova análise
          </button>
        </div>
      </div>

      {/* ── Recomendação do analista ── */}
      {vf?.recomendacao_analista && (
        <div className={`ar__recomendacao ar__recomendacao--${cor}`}>
          <div className="ar__recomendacao-hd">
            <ShieldCheck size={15} />
            <strong>Recomendação do analista</strong>
          </div>
          <p className="ar__recomendacao-texto">{vf.recomendacao_analista}</p>
        </div>
      )}

      {/* ── KPIs rápidos ── */}
      {kpis.length > 0 && (
        <div className="ar__kpis">
          {kpis.map((k, i) => (
            <div key={i} className={`ar__kpi ar__kpi--${k.cor}`}>
              <div className="ar__kpi-icon">{k.icone}</div>
              <div className="ar__kpi-body">
                <span className="ar__kpi-label">{k.label}</span>
                <span className="ar__kpi-valor">{k.valor}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Síntese consolidada ── */}
      {r.sintese && (
        <div className="ar__sintese">
          <div className="ar__sintese-hd">
            <Brain size={14} />
            <span>Síntese Consolidada</span>
            <span className="ar__badge ar__badge--ai">Consolidador IA</span>
          </div>
          <div className="ar__sintese-texto">
            {r.sintese.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          {r.conclusao && (
            <div className="ar__conclusao">
              <strong>Conclusão:</strong> {r.conclusao}
            </div>
          )}
        </div>
      )}

      {/* ── Potencial de mercado + social ── */}
      {(vf?.potencial_mercado || vf?.potencial_social) && (
        <div className="ar__potenciais">
          {vf.potencial_mercado && (
            <div className="ar__potencial ar__potencial--market">
              <div className="ar__potencial-hd">
                <TrendingUp size={13} /> <strong>Potencial de Mercado</strong>
              </div>
              <p>{vf.potencial_mercado}</p>
            </div>
          )}
          {vf.potencial_social && (
            <div className="ar__potencial ar__potencial--social">
              <div className="ar__potencial-hd">
                <Users size={13} /> <strong>Potencial Social</strong>
              </div>
              <p>{vf.potencial_social}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Seções colapsáveis ── */}
      <div className="ar__secoes">

        {/* Constatações de Mercado */}
        {(r.mercado?.constatacoes?.length ?? 0) > 0 && (
          <SecaoColapsavel
            titulo="Constatações de Mercado"
            icone={<TrendingUp size={14} />}
            cor="market"
            count={r.mercado.constatacoes.length}
            defaultOpen
          >
            <ul className="ar__lista">
              {r.mercado.constatacoes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
            {(r.mercado.fontes?.length ?? 0) > 0 && (
              <div className="ar__fontes">
                <BookOpen size={11} /> <span>Fontes: {r.mercado.fontes.join(', ')}</span>
              </div>
            )}
          </SecaoColapsavel>
        )}

        {/* Constatações Sociais */}
        {(r.social?.constatacoes?.length ?? 0) > 0 && (
          <SecaoColapsavel
            titulo="Constatações Sociais"
            icone={<Users size={14} />}
            cor="social"
            count={r.social.constatacoes.length}
            defaultOpen
          >
            <ul className="ar__lista">
              {r.social.constatacoes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
            {(r.social.fontes?.length ?? 0) > 0 && (
              <div className="ar__fontes">
                <BookOpen size={11} /> <span>Fontes: {r.social.fontes.join(', ')}</span>
              </div>
            )}
          </SecaoColapsavel>
        )}

        {/* Justificativa técnica + Riscos */}
        {(vf?.justificativa || vf?.riscos) && (
          <SecaoColapsavel
            titulo="Análise Técnica e Riscos"
            icone={<Zap size={14} />}
            cor="ai"
          >
            {vf?.justificativa && (
              <div className="ar__campo">
                <div className="ar__campo-label"><Zap size={11} /> Justificativa da tecnologia</div>
                <p>{vf.justificativa}</p>
              </div>
            )}
            {vf?.riscos && (
              <div className="ar__campo ar__campo--warn">
                <div className="ar__campo-label"><AlertTriangle size={11} /> Riscos identificados</div>
                <p>{vf.riscos}</p>
              </div>
            )}
          </SecaoColapsavel>
        )}

        {/* Financiamentos e Programas */}
        {(vf?.financiamentos_disponiveis || (r.social?.programas_elegiveis?.length ?? 0) > 0) && (
          <SecaoColapsavel
            titulo="Financiamentos e Programas Públicos"
            icone={<ShieldCheck size={14} />}
            cor="ok"
          >
            {vf?.financiamentos_disponiveis && (
              <div className="ar__tags-wrap">
                <div className="ar__campo-label"><DollarSign size={11} /> Financiamentos aplicáveis</div>
                <div className="ar__tags">
                  {vf.financiamentos_disponiveis.split(',').map((f, i) => (
                    <span key={i} className="ar__tag ar__tag--ok">{f.trim()}</span>
                  ))}
                </div>
              </div>
            )}
            {(r.social?.programas_elegiveis?.length ?? 0) > 0 && (
              <div className="ar__campo">
                <div className="ar__campo-label"><FileText size={11} /> Programas elegíveis</div>
                <ul className="ar__lista ar__lista--compact">
                  {r.social!.programas_elegiveis!.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
          </SecaoColapsavel>
        )}

        {/* Convergências e Divergências */}
        {((r.convergencias?.length ?? 0) > 0 || (r.divergencias?.length ?? 0) > 0) && (
          <SecaoColapsavel
            titulo="Convergências e Divergências"
            icone={<GitMerge size={14} />}
            cor="ai"
          >
            <div className="ar__cvd">
              {(r.convergencias?.length ?? 0) > 0 && (
                <div className="ar__cvd-bloco ar__cvd-bloco--green">
                  <div className="ar__cvd-titulo"><CheckCircle2 size={12} /> Convergências entre pilares</div>
                  <ul>{r.convergencias.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
              {(r.divergencias?.length ?? 0) > 0 && (
                <div className="ar__cvd-bloco ar__cvd-bloco--warn">
                  <div className="ar__cvd-titulo"><AlertTriangle size={12} /> Divergências identificadas</div>
                  <ul>{r.divergencias.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
              )}
            </div>
          </SecaoColapsavel>
        )}

        {/* Dados insuficientes */}
        {(r.dados_insuficientes?.length ?? 0) > 0 && (
          <SecaoColapsavel
            titulo="Dados Insuficientes"
            icone={<AlertCircle size={14} />}
            cor="warn"
            count={r.dados_insuficientes.length}
          >
            <ul className="ar__lista">
              {r.dados_insuficientes.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </SecaoColapsavel>
        )}

        {/* Fontes e períodos */}
        {((r.fontes_consultadas?.length ?? 0) > 0 || (r.periodos_referencia?.length ?? 0) > 0) && (
          <SecaoColapsavel
            titulo="Fontes e Rastreabilidade"
            icone={<BookOpen size={14} />}
            cor="ai"
          >
            {(r.fontes_consultadas?.length ?? 0) > 0 && (
              <div className="ar__campo">
                <div className="ar__campo-label">Fontes consultadas</div>
                <div className="ar__tags">
                  {r.fontes_consultadas.map((f, i) => (
                    <span key={i} className="ar__tag ar__tag--neutral">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {(r.periodos_referencia?.length ?? 0) > 0 && (
              <div className="ar__campo">
                <div className="ar__campo-label">Períodos de referência</div>
                <div className="ar__tags">
                  {r.periodos_referencia!.map((p, i) => (
                    <span key={i} className="ar__tag ar__tag--neutral">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </SecaoColapsavel>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AnalisesPage() {
  const [analises, setAnalises] = useState<AnaliseRecord[]>([])
  const [aberta, setAberta] = useState<AnaliseRecord | null>(null)
  const [busca, setBusca] = useState('')
  const [modoLista, setModoLista] = useState(false)

  useEffect(() => {
    function carregar() {
      try {
        const lista: AnaliseRecord[] = JSON.parse(
          localStorage.getItem(ANALISES_STORAGE_KEY) ?? '[]'
        )
        setAnalises(lista)
        if (lista.length > 0 && !aberta) setAberta(lista[0])
      } catch { setAnalises([]) }
    }
    carregar()
    window.addEventListener('storage', carregar)
    return () => window.removeEventListener('storage', carregar)
  }, [])

  const remover = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const nova = analises.filter(a => a.id !== id)
    setAnalises(nova)
    localStorage.setItem(ANALISES_STORAGE_KEY, JSON.stringify(nova))
    if (aberta?.id === id) setAberta(nova[0] ?? null)
  }

  const limparTudo = () => {
    setAnalises([])
    setAberta(null)
    localStorage.removeItem(ANALISES_STORAGE_KEY)
  }

  const filtradas = busca.trim()
    ? analises.filter(a =>
        a.municipio.toLowerCase().includes(busca.toLowerCase()) ||
        a.pergunta.toLowerCase().includes(busca.toLowerCase())
      )
    : analises

  return (
    <motion.div
      className="analises"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Cabeçalho da página ── */}
      <div className="analises__header">
        <div className="analises__header-icon"><Brain size={22} /></div>
        <div className="analises__header-text">
          <h1 className="analises__title">
            Análises IA
            {analises.length > 0 && (
              <span className="analises__count-badge">{analises.length}</span>
            )}
          </h1>
          <p className="analises__subtitle">
            Relatórios gerados pelos agentes NEXORA — armazenados localmente
          </p>
        </div>
        {analises.length > 0 && (
          <button className="analises__limpar" onClick={limparTudo}>
            <Trash2 size={13} /> Limpar tudo
          </button>
        )}
      </div>

      {analises.length === 0 ? (
        /* ── Estado vazio ── */
        <motion.div
          className="analises__empty"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="analises__empty-icon"><Brain size={40} /></div>
          <h2 className="analises__empty-title">Nenhuma análise salva</h2>
          <p className="analises__empty-desc">
            Use o assistente IA para investigar qualquer município paulista.
            Os relatórios gerados aparecem aqui automaticamente.
          </p>
          <button className="analises__ir-btn" onClick={() => openAIChat({ codigo: '', nome: '' })}>
            <Brain size={14} /> Iniciar análise
          </button>
        </motion.div>
      ) : (
        <div className="analises__layout">

          {/* ── Painel lateral: lista de análises ── */}
          <aside className="analises__lista-wrap">

            {/* Busca */}
            <div className="analises__search-wrap">
              <Search size={13} className="analises__search-icon" />
              <input
                className="analises__search"
                placeholder="Filtrar análises…"
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
              {busca && (
                <button className="analises__search-clear" onClick={() => setBusca('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Lista */}
            <ul className="analises__lista">
              <AnimatePresence>
                {filtradas.map(a => {
                  const vf = a.resultado.viabilidade_financeira
                  const cor = classificacaoCor(vf?.classificacao ?? vf?.recomendacao_analista)
                  return (
                    <motion.li
                      key={a.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.18 }}
                    >
                      <button
                        className={`analises__item${aberta?.id === a.id ? ' analises__item--active' : ''}`}
                        onClick={() => setAberta(a)}
                      >
                        <div className="analises__item-main">
                          <div className="analises__item-top">
                            <span className="analises__item-municipio">{a.municipio}</span>
                            {vf?.classificacao && (
                              <span className={`analises__item-badge analises__item-badge--${cor}`}>
                                {vf.classificacao}
                              </span>
                            )}
                          </div>
                          <span className="analises__item-pergunta">{a.pergunta}</span>
                          <span className="analises__item-data">
                            <Clock size={10} /> {formatarData(a.data)}
                          </span>
                        </div>
                        <button
                          className="analises__item-del"
                          onClick={e => remover(a.id, e)}
                          title="Remover"
                        >
                          <Trash2 size={11} />
                        </button>
                        <ChevronRight size={12} className="analises__item-arrow" />
                      </button>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          </aside>

          {/* ── Painel principal: relatório ── */}
          <main className="analises__detalhe">
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
                  <p>Selecione uma análise para ver o relatório</p>
                </motion.div>
              ) : (
                <motion.div
                  key={aberta.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <RelatorioView analise={aberta} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      )}
    </motion.div>
  )
}
