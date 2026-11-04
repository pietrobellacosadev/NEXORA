import './Spinner.css'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export default function Spinner({ size = 'md', label = 'Carregando…' }: SpinnerProps) {
  return (
    <span className={`spinner spinner--${size}`} role="status" aria-label={label}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="32" strokeDashoffset="12" />
      </svg>
    </span>
  )
}
