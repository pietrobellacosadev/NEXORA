import { type ReactNode } from 'react'
import { Search } from 'lucide-react'
import './EmptyState.css'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({
  title = 'Nenhum dado encontrado',
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Search size={32} className="empty-state__icon" aria-hidden="true" />
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}
