import EmptyState from '../components/ui/EmptyState'
import { Link } from 'react-router-dom'

export default function InvestigarPage() {
  return (
    <div style={{ paddingTop: '2rem' }}>
      <EmptyState
        title="Investigação por IA"
        description="A investigação conversacional com os três agentes será implementada na Etapa 8."
        action={<Link to="/" style={{ color: 'var(--color-market)', fontWeight: 700 }}>← Voltar ao início</Link>}
      />
    </div>
  )
}
