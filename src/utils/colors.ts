export const colorVariantsMap = {
  red: 'bg-red-100 ring-red-200',
  orange: 'bg-orange-100 ring-orange-200',
  amber: 'bg-amber-100 ring-amber-200',
  yellow: 'bg-yellow-100 ring-yellow-200',
  lime: 'bg-lime-100 ring-lime-200',
  green: 'bg-green-100 ring-green-200',
  brand: 'bg-brand/20 text-brand ring-brand/20',
  emerald: 'bg-emerald-100 ring-emerald-200',
  teal: 'bg-teal-100 ring-teal-200',
  cyan: 'bg-cyan-100 ring-cyan-200',
  sky: 'bg-sky-100 ring-sky-200',
  blue: 'bg-blue-100 ring-blue-200',
  indigo: 'bg-indigo-100 ring-indigo-200',
  violet: 'bg-violet-100 ring-violet-200',
  purple: 'bg-purple-100 ring-purple-200',
  fuchsia: 'bg-fuchsia-100 ring-fuchsia-200',
  gray: 'bg-gray-100 ring-gray-200',
  darkgray: 'bg-gray-900 ring-gray-200',
}

import type { BadgeVariants } from '~/components/ui/badge'

export function getClusterVariant(cid: number): BadgeVariants['variant'] {
  if (typeof cid !== 'number' || !isFinite(cid)) return 'gray'
  const pool = getDispersedVariantPool()
  const h = hashNumber(cid)
  const idx = h % pool.length
  const variant = pool[idx]
  return variant
}

function getDispersedVariantPool(): Array<BadgeVariants['variant']> {
  // Avoid non-color/system variants; use solid hues only
  const base: Array<BadgeVariants['variant']> = [
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'emerald',
    'teal',
    'cyan',
    'sky',
    'blue',
    'indigo',
    'violet',
    'purple',
    'fuchsia',
    'pink',
    'rose',
  ] as any

  // Spread hues to avoid similar consecutive colors
  const step = 5
  const out: Array<BadgeVariants['variant']> = []
  let i = 0
  const n = base.length
  const used = new Set<number>()
  for (let k = 0; k < n; k++) {
    while (used.has(i)) i = (i + 1) % n
    out.push(base[i])
    used.add(i)
    i = (i + step) % n
  }
  return out
}

function hashNumber(n: number): number {
  let x = n | 0
  x = ((x >>> 16) ^ x) * 0x45d9f3b
  x = ((x >>> 16) ^ x) * 0x45d9f3b
  x = (x >>> 16) ^ x
  if (x < 0) x = ~x
  return x >>> 0
}
