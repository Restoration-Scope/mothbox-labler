export type TaxonRank = 'order' | 'family' | 'genus' | 'species'

export function getTaxonomyPrefix(params: { rank: TaxonRank; isMorpho?: boolean }) {
  const { rank, isMorpho } = params

  if (rank === 'species' && isMorpho) {
    const prefix = 'M'
    return prefix
  }

  if (rank === 'order') {
    const prefix = 'O'
    return prefix
  }
  if (rank === 'family') {
    const prefix = 'F'
    return prefix
  }
  if (rank === 'genus') {
    const prefix = 'G'
    return prefix
  }
  const prefix = 'S'
  return prefix
}
