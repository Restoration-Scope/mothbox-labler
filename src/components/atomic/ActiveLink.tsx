import { Link } from '@tanstack/react-router'
import * as React from 'react'

export type ActiveMatchTypes = 'exact' | 'partial'

type Props = {
  href: string
  className?: string
  target?: React.HTMLAttributeAnchorTarget
  activeMatch?: ActiveMatchTypes
  children: React.ReactNode
}

export function ActiveLink(props: Props) {
  const { href, className, target, activeMatch, children } = props
  const exact = activeMatch === 'exact'
  return (
    <Link to={href} className={className} target={target} activeOptions={{ exact }}>
      {children}
    </Link>
  )
}
