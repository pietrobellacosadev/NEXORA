import { type ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import './EmptyState.css'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}

export default function EmptyState({
  title = 'Nenhum dado encontrado',
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon-wrap" aria-hidden="true">
        {icon ?? <MapPin size={28} />}
        <img src="/nexora-icon.svg" alt="" className="empty-state__logo" />
      </div>
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}
