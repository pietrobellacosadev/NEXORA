import EmptyState from '../components/ui/EmptyState'
import { Link } from 'react-router-dom'

export default function CompararPage() {
  return (
    <div style={{ paddingTop: '2rem' }}>
      <EmptyState
        title="Comparação municipal"
        description="A comparação entre municípios será implementada na Etapa 7."
        action={<Link to="/" style={{ color: 'var(--color-market)', fontWeight: 700 }}>← Voltar ao início</Link>}
      />
    </div>
  )
}
