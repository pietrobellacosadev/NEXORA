import EmptyState from '../components/ui/EmptyState'
import { Link } from 'react-router-dom'

export default function MapaPage() {
  return (
    <div style={{ paddingTop: '2rem' }}>
      <EmptyState
        title="Mapa territorial"
        description="O mapa interativo dos 645 municípios paulistas será implementado na Etapa 3 (dados) e Etapa 6 (dashboard)."
        action={<Link to="/" style={{ color: 'var(--color-market)', fontWeight: 700 }}>← Voltar ao início</Link>}
      />
    </div>
  )
}
