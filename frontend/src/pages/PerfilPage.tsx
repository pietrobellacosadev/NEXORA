import EmptyState from '../components/ui/EmptyState'
import { Link } from 'react-router-dom'

export default function PerfilPage() {
  return (
    <div style={{ paddingTop: '2rem' }}>
      <EmptyState
        title="Perfil municipal"
        description="O perfil detalhado por município será implementado na Etapa 6."
        action={<Link to="/" style={{ color: 'var(--color-market)', fontWeight: 700 }}>← Voltar ao início</Link>}
      />
    </div>
  )
}
