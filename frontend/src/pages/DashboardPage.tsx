import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import {
  Map, BarChart2, GitCompare, MessageSquare,
  TrendingUp, Users, Brain, ArrowRight,
  ShieldCheck, Wifi, Activity,
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
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
    desc: 'Explore os 645 municípios paulistas. Filtre por indicadores e identifique regiões de oportunidade.',
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
    to: '/comparar',
    icon: GitCompare,
    title: 'Comparação',
    desc: 'Compare até 4 municípios lado a lado. Mercado e Social em paralelo para decisões fundamentadas.',
    color: 'market',
    badge: null,
  },
  {
    to: '/investigar',
    icon: MessageSquare,
    title: 'Investigação por IA',
    desc: 'Três agentes especializados investigam em paralelo e o Consolidador sintetiza análise equilibrada.',
    color: 'ai',
    badge: 'IA',
  },
]

/* ── Dados ilustrativos para os gráficos ─────────────────────────────────── */
const RADAR_DATA = [
  { indicador: 'Conectividade', mercado: 72, social: 58 },
  { indicador: 'Demanda',       mercado: 85, social: 74 },
  { indicador: 'Infraestrutura',mercado: 61, social: 52 },
  { indicador: 'Acesso Digital',mercado: 55, social: 80 },
  { indicador: 'Cobertura 4G',  mercado: 78, social: 65 },
  { indicador: 'IDEB',          mercado: 48, social: 83 },
]

const BAR_DATA = [
  { regiao: 'Grande SP',    mercado: 88, social: 71 },
  { regiao: 'Campinas',     mercado: 79, social: 68 },
  { regiao: 'Vale do Paraíba', mercado: 65, social: 62 },
  { regiao: 'Sorocaba',     mercado: 61, social: 58 },
  { regiao: 'Bauru',        mercado: 54, social: 55 },
  { regiao: 'Ribeirão Preto', mercado: 71, social: 64 },
  { regiao: 'São José',     mercado: 58, social: 60 },
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

      {/* ── Visão geral dos pilares — gráficos ───────────────────────────── */}
      <motion.section
        className="dash__charts-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
        aria-labelledby="charts-title"
      >
        <div className="dash__section-header">
          <div className="dash__section-bar" aria-hidden="true" />
          <h2 id="charts-title" className="dash__section-title">Visão geral dos potenciais</h2>
          <span className="dash__section-note">Dados ilustrativos — amostra das regiões</span>
        </div>

        <div className="dash__charts-grid">
          {/* Radar chart */}
          <div className="dash__chart-card">
            <div className="dash__chart-header">
              <div className="dash__chart-title">Perfil comparativo dos pilares</div>
              <div className="dash__chart-legend">
                <span className="dash__chart-dot dash__chart-dot--market" />Mercado
                <span className="dash__chart-dot dash__chart-dot--social" />Social
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={RADAR_DATA} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <PolarGrid stroke="var(--color-line)" />
                <PolarAngleAxis
                  dataKey="indicador"
                  tick={{ fontSize: 11, fill: 'var(--color-muted)', fontFamily: 'Inter' }}
                />
                <Radar
                  name="Mercado"
                  dataKey="mercado"
                  stroke="#2d7dd2"
                  fill="#2d7dd2"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Radar
                  name="Social"
                  dataKey="social"
                  stroke="#20B8A5"
                  fill="#20B8A5"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-line)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart por região */}
          <div className="dash__chart-card">
            <div className="dash__chart-header">
              <div className="dash__chart-title">Potencial por região administrativa</div>
              <div className="dash__chart-legend">
                <span className="dash__chart-dot dash__chart-dot--market" />Mercado
                <span className="dash__chart-dot dash__chart-dot--social" />Social
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={BAR_DATA}
                margin={{ top: 8, right: 8, bottom: 24, left: -8 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="regiao"
                  tick={{ fontSize: 10, fill: 'var(--color-muted)', fontFamily: 'Inter' }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-muted)', fontFamily: 'Inter' }}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-line)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                />
                <Bar dataKey="mercado" name="Mercado" fill="#2d7dd2" radius={[4, 4, 0, 0]} />
                <Bar dataKey="social"  name="Social"  fill="#20B8A5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.section>

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
          Os dados dos gráficos acima são ilustrativos. A decisão final permanece sempre com o analista.
        </p>
      </motion.div>

    </motion.div>
  )
}
