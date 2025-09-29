import React from 'react'
import { Badge, type BadgeVariants } from '~/components/ui/badge'
import { cn } from '~/utils/cn'
import { mapRankToVariant, mapRankToLetter } from '~/utils/ranks'

export type TaxonRankBadgeProps = {
  rank?: string | null
  className?: string
  size?: BadgeVariants['size']
}

export function TaxonRankBadge(props: TaxonRankBadgeProps) {
  const { rank, className, size = 'sm' } = props

  if (!rank) return null

  const variant = mapRankToVariant({ rank })

  return (
    <Badge variant={variant} size={size} className={cn('shrink-0 font-normal', className)}>
      {rank}
    </Badge>
  )
}

export type TaxonRankLetterBadgeProps = {
  rank?: string | null
  className?: string
  size?: BadgeVariants['size']
}

export function TaxonRankLetterBadge(props: TaxonRankLetterBadgeProps) {
  const { rank, className, size = 'sm' } = props

  if (!rank) return null

  const variant = mapRankToVariant({ rank })
  const letter = mapRankToLetter({ rank })

  return (
    <Badge variant={variant} size={size} className={cn('shrink-0', className)}>
      {letter}
    </Badge>
  )
}
