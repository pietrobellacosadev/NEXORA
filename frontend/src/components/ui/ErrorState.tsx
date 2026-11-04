import { AlertTriangle, RefreshCw } from 'lucide-react'
import './ErrorState.css'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export default function ErrorState({
  message = 'Ocorreu um erro ao carregar os dados.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle size={32} className="error-state__icon" aria-hidden="true" />
      <p className="error-state__message">{message}</p>
      {onRetry && (
        <button className="error-state__retry" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          Tentar novamente
        </button>
      )}
    </div>
  )
}
