import type { DetectionEntity } from '~/stores/entities/detections'

export function chunkIds(ids: string[], size: number) {
  const res: string[][] = []
  if (!Array.isArray(ids) || ids.length === 0 || size <= 0) return res
  for (let i = 0; i < ids.length; i += size) res.push(ids.slice(i, i + size))
  return res
}

export function computeDetectionArea(params: { detection?: DetectionEntity }) {
  const { detection } = params
  const points = detection?.points
  if (!Array.isArray(points) || points.length === 0) return 0
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const pt of points) {
    const x = typeof pt?.[0] === 'number' ? pt[0] : null
    const y = typeof pt?.[1] === 'number' ? pt[1] : null
    if (x == null || y == null) continue
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  const width = Math.max(0, maxX - minX)
  const height = Math.max(0, maxY - minY)
  const area = width * height
  return area
}

export function getRankValue(params: { det?: DetectionEntity; rank: 'order' | 'family' | 'genus' | 'species' }) {
  const { det, rank } = params
  if (!det) {
    console.log('🔍 getRankValue - no det, rank:', rank)
    return undefined
  }
  const tax = det?.taxon
  if (rank === 'order') {
    const result = tax?.order || undefined
    console.log('🔍 getRankValue - order:', result, 'tax:', tax)
    return result
  }
  if (rank === 'family') {
    const result = tax?.family || undefined
    console.log('🔍 getRankValue - family:', result, 'tax:', tax)
    return result
  }
  if (rank === 'genus') {
    const result = tax?.genus || undefined
    console.log('🔍 getRankValue - genus:', result, 'tax:', tax)
    return result
  }
  if (rank === 'species') {
    const morphospecies = typeof det?.morphospecies === 'string' ? det.morphospecies : undefined
    const species = tax?.species || undefined
    console.log('🔍 getRankValue - species:', {
      morphospecies,
      taxonSpecies: species,
      hasMorphospecies: !!morphospecies,
      hasTaxonSpecies: !!species,
      returning: morphospecies || species,
    })
    if (morphospecies) return morphospecies
    return species
  }
  console.log('🔍 getRankValue - no match, rank:', rank)
  return undefined
}

export function getHorizontalPadding(el: HTMLElement) {
  if (!el) return 0
  const styles = getComputedStyle(el)
  const left = parseFloat(styles?.paddingLeft || '0')
  const right = parseFloat(styles?.paddingRight || '0')
  const total = (isFinite(left) ? left : 0) + (isFinite(right) ? right : 0)
  return total
}
