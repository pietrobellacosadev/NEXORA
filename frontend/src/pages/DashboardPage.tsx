import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import {
  Map, BarChart2, GitCompare, MessageSquare,
  TrendingUp, Users, Wifi, Brain, ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import './DashboardPage.css'

const STATS = [
  { label: 'Municípios analisados', value: '645', icon: Map,      color: 'market' },
  { label: 'Pilares de análise',    value: '2',   icon: BarChart2, color: 'social'  },
  { label: 'Agentes de IA',         value: '3',   icon: Brain,    color: 'ai'     },
  { label: 'Fontes oficiais',       value: '4+',  icon: ShieldCheck, color: 'market' },
]

const FEATURES = [
  {
    to: '/mapa',
    icon: Map,
    title: 'Mapa Territorial',
    desc: 'Explore todos os 645 municípios paulistas. Filtre por indicadores de mercado ou sociais e identifique regiões de oportunidade.',
    color: 'market',
    badge: 'Novo',
  },
  {
    to: '/perfil',
    icon: BarChart2,
    title: 'Perfil Municipal',
    desc: 'Indicadores detalhados de cada município, com fontes oficiais, períodos de referência e limitações metodológicas sempre visíveis.',
    color: 'social',
    badge: null,
  },
  {
    to: '/comparar',
    icon: GitCompare,
    title: 'Comparação',
    desc: 'Compare até 4 municípios lado a lado. Mercado e social analisados em paralelo para uma decisão mais fundamentada.',
    color: 'market',
    badge: null,
  },
  {
    to: '/investigar',
    icon: MessageSquare,
    title: 'Investigação por IA',
    desc: 'Três agentes especializados investigam em paralelo e o Consolidador sintetiza uma análise equilibrada e rastreável.',
    color: 'ai',
    badge: 'IA',
  },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
}

export default function DashboardPage() {
  return (
    <div className="dash">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.header
        className="dash__hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="dash__hero-body">
          <div className="dash__hero-label">
            <Wifi size={13} aria-hidden="true" />
            Plataforma de Inteligência Territorial — São Paulo
          </div>
          <h1 className="dash__hero-title">
            Conectividade orientada<br />
            por <span className="dash__hero-accent">dados reais</span>
          </h1>
          <p className="dash__hero-lead">
            Analise, com igual importância, o potencial de mercado e o potencial social
            de expansão da conectividade nos 645 municípios paulistas — com evidências,
            fontes e limitações sempre à vista.
          </p>
          <div className="dash__hero-pills">
            <span className="dash__pill dash__pill--market">
              <TrendingUp size={12} aria-hidden="true" />
              Potencial de Mercado
            </span>
            <span className="dash__pill dash__pill--social">
              <Users size={12} aria-hidden="true" />
              Potencial Social
            </span>
            <span className="dash__pill dash__pill--ai">
              <Brain size={12} aria-hidden="true" />
              3 Agentes IA
            </span>
          </div>
          <div className="dash__hero-actions">
            <Link to="/mapa" className="dash__btn dash__btn--primary">
              <Map size={15} aria-hidden="true" />
              Explorar mapa
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link to="/investigar" className="dash__btn dash__btn--ghost">
              <Brain size={15} aria-hidden="true" />
              Investigar município
            </Link>
          </div>
        </div>
        <div className="dash__hero-visual" aria-hidden="true">
          <div className="dash__orb dash__orb--a" />
          <div className="dash__orb dash__orb--b" />
          <div className="dash__orb dash__orb--c" />
          <div className="dash__hero-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="dash__hero-grid-cell" style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>
        </div>
      </motion.header>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <motion.div
        className="dash__stats"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {STATS.map(({ label, value, icon: Icon, color }) => (
          <motion.div key={label} className={`dash__stat dash__stat--${color}`} variants={item}>
            <div className="dash__stat-icon">
              <Icon size={18} aria-hidden="true" />
            </div>
            <div>
              <div className="dash__stat-value">{value}</div>
              <div className="dash__stat-label">{label}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Funcionalidades ──────────────────────────────────────────────── */}
      <section aria-labelledby="features-title">
        <motion.h2
          id="features-title"
          className="dash__section-title"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <span className="dash__section-title-bar" aria-hidden="true" />
          Funcionalidades
        </motion.h2>

        <motion.div
          className="dash__grid"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {FEATURES.map(({ to, icon: Icon, title, desc, color, badge }) => (
            <motion.div key={to} variants={item}>
              <Link to={to} className={`dash__card dash__card--${color}`}>
                <div className="dash__card-top">
                  <div className="dash__card-icon">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  {badge && <span className={`dash__badge dash__badge--${color}`}>{badge}</span>}
                </div>
                <h3 className="dash__card-title">{title}</h3>
                <p className="dash__card-desc">{desc}</p>
                <div className="dash__card-arrow">
                  <ArrowRight size={15} aria-hidden="true" />
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Integridade ──────────────────────────────────────────────────── */}
      <motion.div
        className="dash__integrity"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        role="note"
      >
        <ShieldCheck size={16} className="dash__integrity-icon" aria-hidden="true" />
        <p>
          <strong>Integridade dos dados:</strong> o NEXORA distingue dados oficiais coletados,
          indicadores calculados, estimativas metodológicas, interpretações da IA e dados
          indisponíveis. A decisão final permanece sempre com o analista.
        </p>
      </motion.div>

    </div>
  )
}
