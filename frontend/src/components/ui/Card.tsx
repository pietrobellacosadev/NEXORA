import { type ReactNode } from 'react'
import './Card.css'

interface CardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'market' | 'social' | 'warn'
  hoverable?: boolean
  onClick?: () => void
}

export default function Card({
  children,
  className = '',
  variant = 'default',
  hoverable = false,
  onClick,
}: CardProps) {
  const cls = [
    'card',
    `card--${variant}`,
    hoverable ? 'card--hoverable' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined}>
      {children}
    </div>
  )
}
