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

/** Abre o chat da IA pré-carregado com um ou mais municípios */
export function openAIChat(
  municipio: { codigo: string; nome: string } | Array<{ codigo: string; nome: string }>,
  pergunta?: string,
) {
  const municipios = Array.isArray(municipio) ? municipio : [municipio]
  window.dispatchEvent(
    new CustomEvent('nexora:open-ai-chat', { detail: { municipios, pergunta } })
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

// ── Tradutor de erros — nunca expõe caminhos de API nem stack traces ─────────
function _mensagemErro(err: unknown, municipio?: string): string {
  const ctx = municipio ? ` para **${municipio}**` : ''

  // Erro de rede / servidor indisponível
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnrefused') || msg.includes('failed to fetch')) {
      return `⚠️ Não foi possível conectar ao servidor de análise${ctx}. Verifique sua conexão e tente novamente em instantes.`
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return `⏱️ A análise${ctx} demorou mais do que o esperado e foi interrompida. Os modelos de IA podem estar sob alta demanda — aguarde alguns segundos e tente de novo.`
    }
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many')) {
      return `🚦 Limite de requisições atingido${ctx}. Aguarde alguns segundos antes de enviar uma nova análise.`
    }
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('403')) {
      return `🔒 Falha de autenticação no serviço de IA${ctx}. Verifique a configuração da chave de API no servidor.`
    }
    if (msg.includes('500') || msg.includes('internal server')) {
      return `🛠️ O servidor encontrou um problema interno ao processar a análise${ctx}. Tente novamente ou contate o suporte.`
    }
  }

  // Resposta HTTP com status de erro (axios)
  const axiosErr = err as { response?: { status?: number } }
  if (axiosErr?.response?.status) {
    const status = axiosErr.response.status
    if (status === 404) return `🔍 Município não encontrado${ctx}. Verifique o nome ou código IBGE e tente novamente.`
    if (status === 422) return `⚠️ A pergunta enviada não pôde ser processada${ctx}. Reformule e tente novamente.`
    if (status >= 500) return `🛠️ O servidor encontrou um problema interno${ctx}. Tente novamente em instantes.`
    if (status >= 400) return `⚠️ Não foi possível completar a análise${ctx} (código ${status}). Tente novamente.`
  }

  // Fallback genérico — sem expor mensagem técnica
  return `⚠️ Não foi possível completar a análise${ctx}. Tente novamente em alguns segundos. Se o problema persistir, recarregue a página.`
}

// ── Renderizador de markdown mínimo para o bubble do chat ────────────────────
function renderInline(text: string): React.ReactNode[] {
  // Suporta **bold** e _italic_
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('_') && p.endsWith('_'))   return <em key={i}>{p.slice(1, -1)}</em>
    return p
  })
}

function BubbleContent({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) {
    // Mensagem do utilizador: texto simples sem formatação especial
    return <>{text.split('\n').map((l, i) => l ? <span key={i} style={{ display: 'block' }}>{l}</span> : <br key={i} />)}</>
  }

  // Divide em blocos por linha dupla (parágrafos) ou linha simples
  const linhas = text.split('\n')
  const elementos: React.ReactNode[] = []
  let i = 0

  while (i < linhas.length) {
    const linha = linhas[i]

    // Linha vazia — espaço entre blocos
    if (!linha.trim()) { i++; continue }

    // Separador horizontal
    if (/^---+$/.test(linha.trim())) {
      elementos.push(<hr key={i} className="ai-fab__hr" />)
      i++
      continue
    }

    // Item de lista: começa com -, •, *, ou número seguido de . ou )
    if (/^[\-•*]\s/.test(linha) || /^\d+[.)]\s/.test(linha)) {
      const itens: React.ReactNode[] = []
      while (i < linhas.length && (/^[\-•*]\s/.test(linhas[i]) || /^\d+[.)]\s/.test(linhas[i]))) {
        const conteudo = linhas[i].replace(/^[\-•*\d.)\s]+/, '').trim()
        itens.push(<li key={i}>{renderInline(conteudo)}</li>)
        i++
      }
      elementos.push(<ul key={`ul-${i}`} className="ai-fab__list">{itens}</ul>)
      continue
    }

    // Linha com apenas emoji no início (ícone de seção) — título de seção
    if (/^[🔍👥🧠📍⏳✅❌⚠️💡]\s/.test(linha)) {
      elementos.push(
        <p key={i} className="ai-fab__section-title">{renderInline(linha)}</p>
      )
      i++
      continue
    }

    // Parágrafo normal — agrupa linhas consecutivas não vazias sem formatação especial
    const paraLinhas: string[] = []
    while (
      i < linhas.length &&
      linhas[i].trim() &&
      !/^---+$/.test(linhas[i].trim()) &&
      !/^[\-•*]\s/.test(linhas[i]) &&
      !/^\d+[.)]\s/.test(linhas[i])
    ) {
      paraLinhas.push(linhas[i])
      i++
    }
    if (paraLinhas.length) {
      elementos.push(
        <p key={i} className="ai-fab__para">{renderInline(paraLinhas.join(' '))}</p>
      )
    }
  }

  return <>{elementos}</>
}

export default function AIFab() {
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([BOAS_VINDAS])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [passoAtual, setPassoAtual] = useState(-1) // índice do passo de progresso ativo
  const [municipioAtual, setMunicipioAtual] = useState<{ codigo: string; nome: string } | null>(null)
  // Fila para análise multi-município: municípios pendentes de análise
  const [filaMunicipios, setFilaMunicipios] = useState<Array<{ codigo: string; nome: string }>>([])
  const [ultimaAnalise, setUltimaAnalise] = useState<ResultadoConsolidado | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Abre o chat quando disparado por outras páginas
  useEffect(() => {
    const handler = (e: Event) => {
      const { municipios, pergunta } = (e as CustomEvent<{
        municipios: Array<{ codigo: string; nome: string }>
        pergunta?: string
      }>).detail

      const validos = municipios.filter(m => m.codigo.trim().length >= 7)
      const primeiro = validos[0] ?? null

      if (primeiro) setMunicipioAtual(primeiro)

      // Se há mais de um, guarda o restante na fila para análise sequencial
      if (validos.length > 1) {
        setFilaMunicipios(validos.slice(1))
      }

      setAberto(true)

      if (pergunta) {
        setInput(pergunta)
      } else {
        setMsgs(prev => {
          const jaTemBoasVindas = prev.length === 1 && prev[0].role === 'assistant'
          if (!jaTemBoasVindas) return prev

          if (validos.length === 0) return [{ role: 'assistant', text: BOAS_VINDAS.text }]

          if (validos.length === 1) {
            return [{
              role: 'assistant',
              text: `Olá! Vou analisar **${validos[0].nome}**. O que você gostaria de saber? (viabilidade de internet, custos, programas públicos…)`,
            }]
          }

          // Múltiplos municípios
          const nomes = validos.map(m => `**${m.nome}**`).join(', ')
          return [{
            role: 'assistant',
            text: `Olá! Tenho ${validos.length} municípios prontos para análise: ${nomes}.\n\nVou analisar cada um sequencialmente. Digite sua pergunta e enviarei relatórios individuais para cada município.`,
          }]
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

  /** Executa análise de um único município e retorna mensagem de resposta formatada */
  const analisarMunicipio = async (muni: { codigo: string; nome: string }, pergunta: string): Promise<string> => {
    const { data } = await api.post<ResultadoConsolidado>('/investigar', {
      codigo_ibge: muni.codigo,
      pergunta,
    })

    localStorage.setItem(AI_ANALYSIS_KEY, JSON.stringify(data))
    salvarAnalise(data)
    setUltimaAnalise(data)

    const vf = data.viabilidade_financeira
    const blocos: string[] = []

    // Título
    blocos.push(`📍 **${muni.nome}** — Análise concluída ✅`)

    // Síntese (pode ter múltiplos parágrafos — preserva)
    if (data.sintese) {
      blocos.push(data.sintese.trim())
    }

    // Separador + dados financeiros como lista compacta
    if (vf) {
      const itens: string[] = []
      if (vf.tecnologia_recomendada || vf.tipo_rede_recomendado) {
        itens.push(`- **Tecnologia:** ${vf.tecnologia_recomendada ?? vf.tipo_rede_recomendado}`)
      }
      if (vf.investimento_estimado_range) {
        itens.push(`- **Investimento:** ${vf.investimento_estimado_range}${vf.payback_anos ? ` · Payback: ${vf.payback_anos}` : ''}`)
      }
      if (vf.classificacao) {
        itens.push(`- **Viabilidade:** ${vf.classificacao}`)
      }
      if (vf.recomendacao_analista) {
        itens.push(`- **Recomendação:** ${vf.recomendacao_analista}`)
      }
      if (vf.financiamentos_disponiveis && vf.financiamentos_disponiveis.length > 0) {
        itens.push(`- **Financiamentos:** ${vf.financiamentos_disponiveis.join(' · ')}`)
      }
      if (itens.length) {
        blocos.push('---')
        blocos.push(itens.join('\n'))
      }
    }

    // Conclusão
    if (data.conclusao) {
      blocos.push('---')
      blocos.push(`💡 **Conclusão:** ${data.conclusao}`)
    }

    return blocos.join('\n\n')
  }

  const enviar = async () => {
    const txt = input.trim()
    if (!txt || enviando) return
    setInput('')
    setMsgs(prev => [...prev, { role: 'user', text: txt }])
    setEnviando(true)
    iniciarProgresso()

    try {
      // Resolve município: prioriza o já definido no contexto; só busca na mensagem se não houver nenhum
      let muni = municipioAtual
      if (!muni) {
        const resolvidoNaMensagem = await resolverMunicipio(txt)
        if (resolvidoNaMensagem) {
          muni = resolvidoNaMensagem
          setMunicipioAtual(resolvidoNaMensagem)
        }
      }

      if (!muni) {
        pararProgresso()
        setMsgs(prev => [...prev, {
          role: 'assistant',
          text: 'Não encontrei um município na sua mensagem. Tente algo como:\n"Analise Campinas — viabilidade de fibra óptica"\n\nOu mencione o código IBGE do município.',
        }])
        return
      }

      // Captura a fila atual ANTES de analisar (para análise multi-município)
      const fila = filaMunicipios.slice()

      // Analisa o município atual
      const resposta = await analisarMunicipio(muni, txt)
      pararProgresso()

      setMsgs(prev => [...prev, { role: 'assistant', text: resposta }])

      // Se há municípios na fila, analisa cada um sequencialmente
      if (fila.length > 0) {
        setFilaMunicipios([])
        for (const proximo of fila) {
          setMunicipioAtual(proximo)
          setMsgs(prev => [...prev, {
            role: 'assistant',
            text: `⏳ Analisando **${proximo.nome}**…`,
          }])
          iniciarProgresso()
          try {
            const respostaProximo = await analisarMunicipio(proximo, txt)
            pararProgresso()
            setMsgs(prev => {
              // Remove a mensagem "Analisando…"
              const sem = prev.filter(m => !m.text.includes(`Analisando **${proximo.nome}**`))
              return [...sem, { role: 'assistant', text: respostaProximo }]
            })
          } catch (err) {
            pararProgresso()
            setMsgs(prev => [...prev, {
              role: 'assistant',
              text: _mensagemErro(err, proximo.nome),
            }])
          }
        }
        setMsgs(prev => [...prev, {
          role: 'assistant',
          text: `✅ Análise concluída para todos os municípios. Os relatórios foram salvos em **Análises**.`,
        }])
      } else {
        setMsgs(prev => [...prev, {
          role: 'assistant',
          text: 'Dados completos salvos em **Análises** e enviados ao **Dashboard**.',
        }])
      }
    } catch (err) {
      pararProgresso()
      setMsgs(prev => [...prev, {
        role: 'assistant',
        text: _mensagemErro(err, municipioAtual?.nome),
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
    setFilaMunicipios([])
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
                    {municipioAtual
                      ? `📍 ${municipioAtual.nome}${filaMunicipios.length > 0 ? ` +${filaMunicipios.length} na fila` : ''}`
                      : 'Assistente de conectividade'}
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
                    <BubbleContent text={m.text} isUser={m.role === 'user'} />
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
