import React from 'react'
import { Badge, type BadgeVariants } from '~/components/ui/badge'
import { cn } from '~/utils/cn'

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

function mapRankToVariant(params: { rank?: string | null }): NonNullable<BadgeVariants['variant']> {
  const { rank } = params

  const value = (rank ?? '').toString().trim().toLowerCase()

  if (value === 'species') return 'blue'
  if (value === 'family') return 'orange'
  if (value === 'order') return 'yellow'

  const res = 'gray' as NonNullable<BadgeVariants['variant']>
  return res
}

function mapRankToLetter(params: { rank?: string | null }): string {
  const { rank } = params

  const value = (rank ?? '').toString().trim().toLowerCase()

  if (value === 'species') return 'S'
  if (value === 'genus') return 'G'
  if (value === 'family') return 'F'
  if (value === 'order') return 'O'
  if (value === 'class') return 'C'
  if (value === 'phylum') return 'P'
  if (value === 'kingdom') return 'K'

  const res = value ? value[0]?.toUpperCase() : '?'
  return res
}
