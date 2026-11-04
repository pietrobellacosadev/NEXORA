import './Badge.css'

interface BadgeProps {
  children: string
  variant?: 'market' | 'social' | 'warn' | 'muted' | 'agent'
}

export default function Badge({ children, variant = 'muted' }: BadgeProps) {
  return (
    <span className={`badge badge--${variant}`}>
      {children}
    </span>
  )
}
