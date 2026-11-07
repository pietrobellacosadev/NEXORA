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
import './AIFab.css'

export const AI_ANALYSIS_KEY = 'nexora-ai-analysis'

interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

const BOAS_VINDAS: ChatMsg = {
  role: 'assistant',
  text: 'Olá! Sou o assistente NEXORA. Posso analisar qualquer município paulista — viabilidade de internet, custos de implantação, programas públicos disponíveis e muito mais.\n\nDigite o nome de um município e sua dúvida para começar.',
}

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
  const [municipioAtual, setMunicipioAtual] = useState<{ codigo: string; nome: string } | null>(null)
  const [ultimaAnalise, setUltimaAnalise] = useState<ResultadoConsolidado | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (aberto) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [aberto])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, enviando])

  const enviar = async () => {
    const txt = input.trim()
    if (!txt || enviando) return
    setInput('')
    setMsgs(prev => [...prev, { role: 'user', text: txt }])
    setEnviando(true)

    try {
      // Tenta resolver município a partir do contexto atual ou da mensagem
      let muni = municipioAtual
      const resolvidoNaMensagem = await resolverMunicipio(txt)
      if (resolvidoNaMensagem) {
        muni = resolvidoNaMensagem
        setMunicipioAtual(resolvidoNaMensagem)
      }

      if (!muni) {
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

      // Salva análise completa para o Dashboard
      localStorage.setItem(AI_ANALYSIS_KEY, JSON.stringify(data))
      setUltimaAnalise(data)

      const resposta = [
        `**${muni.nome}** — Análise concluída ✅`,
        '',
        data.sintese,
        data.viabilidade_financeira
          ? `**Rede recomendada:** ${data.viabilidade_financeira.tipo_rede_recomendado ?? ''} · Retorno: ${data.viabilidade_financeira.classificacao ?? ''}`
          : '',
        data.conclusao ? `**Conclusão:** ${data.conclusao}` : '',
        '',
        'Os dados completos (mercado, social, custos) foram enviados para o **Dashboard**.',
      ].filter(Boolean).join('\n')

      setMsgs(prev => [...prev, { role: 'assistant', text: resposta }])
    } catch {
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
              {enviando && (
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
