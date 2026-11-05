import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import {
  Map, BarChart2, Brain, ArrowRight,
  TrendingUp, Users, ShieldCheck, Wifi, Activity,
} from 'lucide-react'
import './DashboardPage.css'

const STATS = [
  { label: 'Municípios',       value: '645', icon: Map,       color: 'market', sub: 'Estado de São Paulo' },
  { label: 'Pilares',          value: '2',   icon: Activity,  color: 'social',  sub: 'Mercado e Social' },
  { label: 'Agentes de IA',    value: '3',   icon: Brain,     color: 'ai',      sub: 'Especializados' },
  { label: 'Fontes oficiais',  value: '4+',  icon: ShieldCheck, color: 'market', sub: 'IBGE, ANATEL, INEP, DATASUS' },
]

const FEATURES = [
  {
    to: '/mapa',
    icon: Map,
    title: 'Mapa Territorial',
    desc: 'Explore os 645 municípios paulistas. Clique em qualquer município ou busque pelo nome para ver indicadores reais.',
    color: 'market',
    badge: 'Novo',
  },
  {
    to: '/perfil',
    icon: BarChart2,
    title: 'Perfil Municipal',
    desc: 'Indicadores detalhados com fontes oficiais, períodos e limitações metodológicas sempre visíveis.',
    color: 'social',
    badge: null,
  },
  {
    to: '/analises',
    icon: Brain,
    title: 'Análises Recentes',
    desc: 'Histórico das investigações por IA salvo localmente. Consulte sínteses, constatações e convergências.',
    color: 'ai',
    badge: null,
  },
  {
    to: '/investigar',
    icon: Brain,
    title: 'Investigação por IA',
    desc: 'Três agentes especializados investigam em paralelo e o Consolidador sintetiza análise equilibrada.',
    color: 'ai',
    badge: 'IA',
  },
]

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
const item = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
}

export default function DashboardPage() {
  return (
    <motion.div
      className="dash"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.header
        className="dash__hero"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
      >
        <div className="dash__hero-body">
          <div className="dash__hero-eyebrow">
            <Wifi size={12} aria-hidden="true" />
            <span>Plataforma de Inteligência Territorial — São Paulo</span>
          </div>
          <h1 className="dash__hero-title">
            Conectividade orientada<br />
            por <span className="dash__hero-accent">dados reais</span>
          </h1>
          <p className="dash__hero-lead">
            Analise o potencial de mercado e o potencial social de expansão da
            conectividade nos 645 municípios paulistas — com evidências, fontes
            e limitações sempre à vista.
          </p>
          <div className="dash__hero-pills">
            <span className="dash__pill dash__pill--market">
              <TrendingUp size={11} aria-hidden="true" />
              Potencial de Mercado
            </span>
            <span className="dash__pill dash__pill--social">
              <Users size={11} aria-hidden="true" />
              Potencial Social
            </span>
            <span className="dash__pill dash__pill--ai">
              <Brain size={11} aria-hidden="true" />
              3 Agentes de IA
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

        {/* Visual decorativo */}
        <div className="dash__hero-visual" aria-hidden="true">
          <img src="/nexora-icon.svg" alt="" className="dash__hero-icon" />
          <div className="dash__hero-glow dash__hero-glow--a" />
          <div className="dash__hero-glow dash__hero-glow--b" />
        </div>
      </motion.header>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <motion.div
        className="dash__stats"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {STATS.map(({ label, value, icon: Icon, color, sub }) => (
          <motion.div key={label} className={`dash__stat dash__stat--${color}`} variants={item}>
            <div className="dash__stat-icon-wrap">
              <Icon size={18} aria-hidden="true" />
            </div>
            <div className="dash__stat-body">
              <div className="dash__stat-value">{value}</div>
              <div className="dash__stat-label">{label}</div>
              <div className="dash__stat-sub">{sub}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Funcionalidades ──────────────────────────────────────────────── */}
      <section aria-labelledby="features-title">
        <div className="dash__section-header">
          <div className="dash__section-bar" aria-hidden="true" />
          <h2 id="features-title" className="dash__section-title">Funcionalidades</h2>
        </div>

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
                  <div className={`dash__card-icon dash__card-icon--${color}`}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  {badge && <span className={`dash__badge dash__badge--${color}`}>{badge}</span>}
                </div>
                <h3 className="dash__card-title">{title}</h3>
                <p className="dash__card-desc">{desc}</p>
                <div className="dash__card-footer">
                  <span className={`dash__card-cta dash__card-cta--${color}`}>
                    Acessar
                    <ArrowRight size={13} aria-hidden="true" />
                  </span>
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
        transition={{ delay: 0.4, duration: 0.5 }}
        role="note"
      >
        <ShieldCheck size={15} className="dash__integrity-icon" aria-hidden="true" />
        <p>
          <strong>Integridade dos dados:</strong> o NEXORA distingue dados oficiais,
          indicadores calculados, estimativas e interpretações da IA.
          A decisão final permanece sempre com o analista.
        </p>
      </motion.div>

    </motion.div>
  )
}
