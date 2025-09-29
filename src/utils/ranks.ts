import { BadgeVariants } from '~/components/ui/badge'

export function mapRankToVariant(params: { rank?: string | null }): NonNullable<BadgeVariants['variant']> {
  const { rank } = params

  const value = (rank ?? '').toString().trim().toLowerCase()

  if (value === 'kingdom') return 'gray'
  if (value === 'phylum') return 'darkgray'
  if (value === 'class') return 'orange'
  if (value === 'order') return 'yellow'
  if (value === 'family') return 'green'
  if (value === 'genus') return 'teal'
  if (value === 'species') return 'blue'
  if (value === 'morphospecies') return 'indigo'

  const res = 'gray' as NonNullable<BadgeVariants['variant']>
  return res
}

export function mapRankToLetter(params: { rank?: string | null }): string {
  const { rank } = params

  const value = (rank ?? '').toString().trim().toLowerCase()

  if (value === 'morphospecies') return 'M'
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
