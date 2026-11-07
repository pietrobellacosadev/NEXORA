/**
 * AIFab — Botão flutuante de IA global
 * Aparece em todas as páginas como uma bolinha roxa no canto inferior direito.
 * Abre um chat com o Agente Consolidador da NEXORA.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Bot, X, Send, Loader, MessageCircle, RefreshCw, ExternalLink } from 'lucide-react'
import api from '../../lib/api'
import type { ResultadoConsolidado } from '../../types'
import { salvarAnalise } from '../../pages/AnalisesPage'
import './AIFab.css'

export const AI_ANALYSIS_KEY = 'nexora-ai-analysis'

/** Abre o chat da IA pré-carregado com um município */
export function openAIChat(municipio: { codigo: string; nome: string }, pergunta?: string) {
  window.dispatchEvent(
    new CustomEvent('nexora:open-ai-chat', { detail: { municipio, pergunta } })
  )
}

interface ChatMsg {
  role: 'user' | 'assistant' | 'progress'
  text: string
}

const BOAS_VINDAS: ChatMsg = {
  role: 'assistant',
  text: 'Olá! Sou o assistente NEXORA. Posso analisar qualquer município paulista — viabilidade de internet, custos de implantação, programas públicos disponíveis e muito mais.\n\nDigite o nome de um município e sua dúvida para começar.',
}

// Mensagens de progresso exibidas sequencialmente durante a análise
const PASSOS_PROGRESSO = [
  '🔍 Agente de Mercado analisando indicadores econômicos e de conectividade…',
  '👥 Agente Social avaliando impacto social e programas elegíveis…',
  '🧠 Consolidador sintetizando e gerando recomendação final…',
]

// Extrai código IBGE e pergunta de uma mensagem livre
async function resolverMunicipio(texto: string): Promise<{ codigo: string; nome: string } | null> {
  try {
    // Tenta encontrar um número de 7 dígitos na mensagem
    const match = texto.match(/\b(\d{7})\b/)
    if (match) {
      const res = await api.get<{ municipios: Array<{ codigo_ibge: string; nome: string }> }>(
        `/municipios?q=${match[1]}&limite=1`
      )
      return res.data.municipios?.[0]
        ? { codigo: res.data.municipios[0].codigo_ibge, nome: res.data.municipios[0].nome }
        : null
    }
    // Busca por nome
    const palavras = texto.replace(/[,!?.]/g, ' ').split(/\s+/).filter(p => p.length > 3)
    for (const palavra of palavras) {
      const res = await api.get<{ municipios: Array<{ codigo_ibge: string; nome: string }> }>(
        `/municipios?q=${encodeURIComponent(palavra)}&limite=1`
      )
      if (res.data.municipios?.length) {
        return { codigo: res.data.municipios[0].codigo_ibge, nome: res.data.municipios[0].nome }
      }
    }
  } catch { /* ignora */ }
  return null
}

export default function AIFab() {
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([BOAS_VINDAS])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [passoAtual, setPassoAtual] = useState(-1) // índice do passo de progresso ativo
  const [municipioAtual, setMunicipioAtual] = useState<{ codigo: string; nome: string } | null>(null)
  const [ultimaAnalise, setUltimaAnalise] = useState<ResultadoConsolidado | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Abre o chat quando disparado por outras páginas
  useEffect(() => {
    const handler = (e: Event) => {
      const { municipio, pergunta } = (e as CustomEvent<{ municipio: { codigo: string; nome: string }; pergunta?: string }>).detail
      const muniValido = municipio.codigo.trim().length >= 7
      if (muniValido) setMunicipioAtual(municipio)
      setAberto(true)
      if (pergunta) {
        setInput(pergunta)
      } else {
        setMsgs(prev => {
          const jaTemBoasVindas = prev.length === 1 && prev[0].role === 'assistant'
          if (jaTemBoasVindas) {
            return [{
              role: 'assistant',
              text: muniValido
                ? `Olá! Vou analisar **${municipio.nome}**. O que você gostaria de saber? (viabilidade de internet, custos, programas públicos…)`
                : BOAS_VINDAS.text,
            }]
          }
          return prev
        })
      }
    }
    window.addEventListener('nexora:open-ai-chat', handler)
    return () => window.removeEventListener('nexora:open-ai-chat', handler)
  }, [])

  useEffect(() => {
    if (aberto) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [aberto])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, enviando, passoAtual])

  // Limpa timers ao desmontar
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current)
    }
  }, [])

  /** Avança o passo de progresso com delay entre cada etapa */
  function iniciarProgresso() {
    setPassoAtual(0)
    // Passo 1 → 2 após ~4s (market agent delay + processamento)
    progressTimerRef.current = setTimeout(() => {
      setPassoAtual(1)
      // Passo 2 → 3 após ~6s (social agent delay)
      progressTimerRef.current = setTimeout(() => {
        setPassoAtual(2)
      }, 6000)
    }, 4000)
  }

  function pararProgresso() {
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setPassoAtual(-1)
  }

  const enviar = async () => {
    const txt = input.trim()
    if (!txt || enviando) return
    setInput('')
    setMsgs(prev => [...prev, { role: 'user', text: txt }])
    setEnviando(true)
    iniciarProgresso()

    try {
      // Tenta resolver município a partir do contexto atual ou da mensagem
      let muni = municipioAtual
      const resolvidoNaMensagem = await resolverMunicipio(txt)
      if (resolvidoNaMensagem) {
        muni = resolvidoNaMensagem
        setMunicipioAtual(resolvidoNaMensagem)
      }

      if (!muni) {
        pararProgresso()
        setMsgs(prev => [...prev, {
          role: 'assistant',
          text: 'Não encontrei um município na sua mensagem. Tente algo como:\n"Analise Campinas — viabilidade de fibra óptica"\n\nOu mencione o código IBGE do município.',
        }])
        return
      }

      const { data } = await api.post<ResultadoConsolidado>('/investigar', {
        codigo_ibge: muni.codigo,
        pergunta: txt,
      })

      pararProgresso()

      // Salva análise completa para o Dashboard e para o histórico de análises
      localStorage.setItem(AI_ANALYSIS_KEY, JSON.stringify(data))
      salvarAnalise(data)
      setUltimaAnalise(data)

      const vf = data.viabilidade_financeira
      const linhas = [
        `**${muni.nome}** — Análise concluída ✅`,
        '',
        data.sintese,
      ]

      if (vf) {
        if (vf.tecnologia_recomendada || vf.tipo_rede_recomendado) {
          linhas.push(`**Tecnologia recomendada:** ${vf.tecnologia_recomendada ?? vf.tipo_rede_recomendado}`)
        }
        if (vf.investimento_estimado_range) {
          linhas.push(`**Investimento estimado:** ${vf.investimento_estimado_range} · Payback: ${vf.payback_anos ?? 'N/D'}`)
        }
        if (vf.classificacao) {
          linhas.push(`**Viabilidade:** ${vf.classificacao}`)
        }
        if (vf.recomendacao_analista) {
          linhas.push(`**Recomendação:** ${vf.recomendacao_analista}`)
        }
        if (vf.financiamentos_disponiveis) {
          linhas.push(`**Financiamentos:** ${vf.financiamentos_disponiveis}`)
        }
      }

      if (data.conclusao) {
        linhas.push('', `**Conclusão:** ${data.conclusao}`)
      }

      linhas.push('', 'Os dados completos foram enviados para o **Dashboard** e salvos em **Análises**.')

      setMsgs(prev => [...prev, { role: 'assistant', text: linhas.filter(Boolean).join('\n') }])
    } catch {
      pararProgresso()
      setMsgs(prev => [...prev, {
        role: 'assistant',
        text: 'Erro ao consultar a IA. Verifique se o servidor está rodando e tente novamente.',
      }])
    } finally {
      setEnviando(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  const limpar = () => {
    pararProgresso()
    setMsgs([BOAS_VINDAS])
    setMunicipioAtual(null)
    setUltimaAnalise(null)
  }

  const irParaDashboard = () => {
    setAberto(false)
    navigate('/dashboard')
  }

  return (
    <>
      {/* ── Bolinha flutuante ──────────────────────────────────────────────── */}
      <motion.button
        className={`ai-fab${aberto ? ' ai-fab--active' : ''}`}
        onClick={() => setAberto(o => !o)}
        aria-label={aberto ? 'Fechar assistente NEXORA' : 'Abrir assistente NEXORA'}
        title="Assistente NEXORA IA"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {aberto
            ? <motion.span key="x"   initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.14 }}><X size={22} /></motion.span>
            : <motion.span key="bot" initial={{ scale: 0.6, opacity: 0 }}  animate={{ scale: 1, opacity: 1 }}  exit={{ scale: 0.6, opacity: 0 }}  transition={{ duration: 0.14 }}><MessageCircle size={22} /></motion.span>
          }
        </AnimatePresence>
        {/* Pulsação quando fechado */}
        {!aberto && <span className="ai-fab__pulse" />}
      </motion.button>

      {/* ── Chat panel ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {aberto && (
          <motion.div
            className="ai-fab__panel"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="ai-fab__header">
              <div className="ai-fab__header-icon"><Bot size={16} /></div>
              <div className="ai-fab__header-text">
                <span className="ai-fab__header-title">NEXORA IA</span>
                <span className="ai-fab__header-sub">
                  {municipioAtual ? `📍 ${municipioAtual.nome}` : 'Assistente de conectividade'}
                </span>
              </div>
              {ultimaAnalise && (
                <button className="ai-fab__header-dash" onClick={irParaDashboard} title="Ver análise no Dashboard">
                  <ExternalLink size={12} />
                </button>
              )}
              <button className="ai-fab__header-clear" onClick={limpar} title="Nova conversa">
                <RefreshCw size={12} />
              </button>
              <button className="ai-fab__header-close" onClick={() => setAberto(false)} aria-label="Fechar">
                <X size={14} />
              </button>
            </div>

            {/* Mensagens */}
            <div className="ai-fab__body">
              {msgs.map((m, i) => (
                <div key={i} className={`ai-fab__msg ai-fab__msg--${m.role}`}>
                  {m.role === 'assistant' && (
                    <div className="ai-fab__avatar"><Bot size={11} /></div>
                  )}
                  <div className="ai-fab__bubble">
                   {m.text.split('\n').map((line, j) => {
                     if (!line) return <br key={j} />
                     // Render **bold** segments
                     const parts = line.split(/(\*\*[^*]+\*\*)/)
                     return (
                       <span key={j} style={{ display: 'block' }}>
                         {parts.map((p, k) =>
                           p.startsWith('**') && p.endsWith('**')
                             ? <strong key={k}>{p.slice(2, -2)}</strong>
                             : p
                         )}
                       </span>
                     )
                   })}
                 </div>
                </div>
              ))}

              {/* Indicador de progresso dos agentes */}
              {enviando && passoAtual >= 0 && (
                <div className="ai-fab__msg ai-fab__msg--assistant">
                  <div className="ai-fab__avatar"><Bot size={11} /></div>
                  <div className="ai-fab__bubble ai-fab__bubble--progress">
                    <div className="ai-fab__progress-steps">
                      {PASSOS_PROGRESSO.map((passo, idx) => (
                        <div
                          key={idx}
                          className={`ai-fab__progress-step${idx === passoAtual ? ' ai-fab__progress-step--active' : idx < passoAtual ? ' ai-fab__progress-step--done' : ' ai-fab__progress-step--pending'}`}
                        >
                          <span className="ai-fab__progress-dot" />
                          <span>{passo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Typing dots quando aguardando resposta mas sem passo ainda */}
              {enviando && passoAtual < 0 && (
                <div className="ai-fab__msg ai-fab__msg--assistant">
                  <div className="ai-fab__avatar"><Bot size={11} /></div>
                  <div className="ai-fab__bubble ai-fab__bubble--typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="ai-fab__footer">
              <input
                ref={inputRef}
                type="text"
                className="ai-fab__input"
                placeholder="Ex: Analise Campinas — fibra óptica"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={enviando}
              />
              <button
                className="ai-fab__send"
                onClick={enviar}
                disabled={!input.trim() || enviando}
                aria-label="Enviar"
              >
                {enviando ? <Loader size={14} className="ai-fab__spin" /> : <Send size={14} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
