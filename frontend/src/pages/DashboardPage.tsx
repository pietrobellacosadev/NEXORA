import { Map, BarChart2, GitCompare, MessageSquare, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import './DashboardPage.css'

const FEATURES = [
  {
    to: '/',
    icon: Map,
    title: 'Mapa Territorial',
    desc: 'Explore os 645 municípios paulistas em um mapa interativo. Filtre por indicadores de mercado ou sociais.',
    color: 'market',
  },
  {
    to: '/perfil',
    icon: BarChart2,
    title: 'Perfil Municipal',
    desc: 'Acesse o perfil detalhado de cada município com indicadores dos dois pilares, fontes e limitações.',
    color: 'social',
  },
  {
    to: '/comparar',
    icon: GitCompare,
    title: 'Comparação',
    desc: 'Compare até 4 municípios lado a lado, analisando potencial de mercado e social simultaneamente.',
    color: 'market',
  },
  {
    to: '/investigar',
    icon: MessageSquare,
    title: 'Investigação por IA',
    desc: 'Faça perguntas e receba análises fundamentadas dos três agentes especializados.',
    color: 'social',
  },
]

export default function DashboardPage() {
  return (
    <div className="dashboard">
      {/* Hero */}
      <header className="dashboard__hero">
        <div className="dashboard__hero-content">
          <div className="dashboard__hero-brand">
            <div className="dashboard__logo" aria-hidden="true">
              <i /><i />
            </div>
            <div>
              <h1 className="dashboard__hero-title">NEXORA</h1>
              <p className="dashboard__hero-tag">Inteligência territorial · Estado de São Paulo</p>
            </div>
          </div>
          <p className="dashboard__hero-lead">
            Analise, com igual importância, o potencial de mercado e o potencial social de
            conectividade dos municípios paulistas — com evidências, fontes e limitações à vista.
          </p>
          <div className="dashboard__hero-pills">
            <span className="dashboard__pill dashboard__pill--market">
              <TrendingUp size={12} aria-hidden="true" />
              Mercado
            </span>
            <span className="dashboard__pill dashboard__pill--social">
              <span className="dashboard__pill-dot" aria-hidden="true" />
              Social
            </span>
            <span className="dashboard__pill">
              <span className="dashboard__pill-dot" aria-hidden="true" />
              645 municípios
            </span>
            <span className="dashboard__pill">
              <span className="dashboard__pill-dot" aria-hidden="true" />
              3 agentes de IA
            </span>
          </div>
        </div>
        <div className="dashboard__hero-actions">
          <Link to="/" className="dashboard__btn dashboard__btn--primary">
            <Map size={16} aria-hidden="true" />
            Explorar mapa
          </Link>
          <Link to="/investigar" className="dashboard__btn dashboard__btn--ghost">
            <MessageSquare size={16} aria-hidden="true" />
            Investigar município
          </Link>
        </div>
      </header>

      {/* Cards de funcionalidades */}
      <section className="dashboard__features" aria-labelledby="dashboard-features-title">
        <h2 id="dashboard-features-title" className="dashboard__section-title">
          Funcionalidades
        </h2>
        <div className="dashboard__grid">
          {FEATURES.map(({ to, icon: Icon, title, desc, color }) => (
            <Link key={to} to={to} className={`dashboard__feature-card dashboard__feature-card--${color}`}>
              <div className="dashboard__feature-icon">
                <Icon size={22} aria-hidden="true" />
              </div>
              <h3 className="dashboard__feature-title">{title}</h3>
              <p className="dashboard__feature-desc">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Nota de integridade */}
      <div className="dashboard__integrity-note" role="note">
        <strong>Integridade dos dados:</strong> o NEXORA distingue claramente dados oficiais coletados,
        indicadores calculados, estimativas metodológicas, interpretações da IA e dados indisponíveis.
        A decisão final permanece sempre com o analista.
      </div>
    </div>
  )
}
