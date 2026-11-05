import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Home, Map, BarChart2, GitCompare, MessageSquare } from 'lucide-react'
import './NotFoundPage.css'

const ATALHOS = [
  { to: '/',           label: 'Dashboard',  icon: Home          },
  { to: '/mapa',       label: 'Mapa',       icon: Map           },
  { to: '/perfil',     label: 'Perfil',     icon: BarChart2     },
  { to: '/comparar',   label: 'Comparar',   icon: GitCompare    },
  { to: '/investigar', label: 'Investigar', icon: MessageSquare },
]

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <motion.div
      className="nf"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="nf__glyph" aria-hidden="true">
        <img src="/nexora-icon.svg" alt="" className="nf__logo" />
        <span className="nf__code">404</span>
      </div>

      <h1 className="nf__title">Página não encontrada</h1>
      <p className="nf__desc">
        O endereço que você acessou não existe nesta plataforma.
        <br />
        Use um dos atalhos abaixo para continuar navegando.
      </p>

      <nav className="nf__atalhos" aria-label="Atalhos de navegação">
        {ATALHOS.map(({ to, label, icon: Icon }) => (
          <motion.button
            key={to}
            className="nf__atalho"
            onClick={() => navigate(to)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </motion.button>
        ))}
      </nav>
    </motion.div>
  )
}
