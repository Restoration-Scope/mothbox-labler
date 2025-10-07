import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog'
import { nightSummariesStore } from '~/stores/entities/night-summaries'
import { nightsStore } from '~/stores/entities/4.nights'
import { patchesStore } from '~/stores/entities/5.patches'
import { detectionsStore } from '~/stores/entities/detections'
import { useObjectUrl } from '~/utils/use-object-url'
import { patchFileMapByNightStore, type IndexedFile } from '~/features/folder-processing/files.state'
import { MorphoSpeciesDetailsDialog } from './morpho-details-dialog'
import { TaxonRankBadge, TaxonRankLetterBadge } from '~/components/taxon-rank-badge'
import { mapRankToVariant } from '~/utils/ranks'
import { colorVariantsMap } from '~/utils/colors'
import { cn } from '~/utils/cn'
import { useRouterState } from '@tanstack/react-router'
import { morphoCoversStore, normalizeMorphoKey } from '~/stores/morphospecies/covers'

export type MorphoCatalogDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MorphoCatalogDialog(props: MorphoCatalogDialogProps) {
  const { open, onOpenChange } = props

  const route = useRouterState({ select: (s) => s.location })
  const { projectId, siteId, deploymentId, nightId } = useMemo(() => extractRouteIds(route?.pathname || ''), [route?.pathname])
  const [usageScope, setUsageScope] = useState<'all' | 'project' | 'site' | 'deployment' | 'night'>('all')

  const summaries = useStore(nightSummariesStore)

  const scopeCounts = useMemo(() => {
    const counts: Record<'all' | 'project' | 'site' | 'deployment' | 'night', number> = {
      all: 0,
      project: 0,
      site: 0,
      deployment: 0,
      night: 0,
    }
    counts.all = countMorphoKeysForNightIds({ summaries })
    if (projectId) counts.project = countMorphoKeysForNightIds({ summaries, startsWith: `${projectId}/` })
    if (projectId && siteId) counts.site = countMorphoKeysForNightIds({ summaries, startsWith: `${projectId}/${siteId}/` })
    if (projectId && siteId && deploymentId)
      counts.deployment = countMorphoKeysForNightIds({ summaries, startsWith: `${projectId}/${siteId}/${deploymentId}/` })
    if (projectId && siteId && deploymentId && nightId)
      counts.night = countMorphoKeysForNightIds({ summaries, equals: `${projectId}/${siteId}/${deploymentId}/${nightId}` })
    return counts
  }, [summaries, projectId, siteId, deploymentId, nightId])

  const allowedNightIds = useMemo(() => {
    if (usageScope === 'all') return undefined
    const ids = new Set<string>()
    for (const nid of Object.keys(summaries || {})) {
      if (usageScope === 'project') {
        if (projectId && nid.startsWith(projectId + '/')) ids.add(nid)
        continue
      }
      if (usageScope === 'site') {
        if (projectId && siteId && nid.startsWith(`${projectId}/${siteId}/`)) ids.add(nid)
        continue
      }
      if (usageScope === 'deployment') {
        if (projectId && siteId && deploymentId && nid.startsWith(`${projectId}/${siteId}/${deploymentId}/`)) ids.add(nid)
        continue
      }
      if (usageScope === 'night') {
        if (projectId && siteId && deploymentId && nightId) {
          const exact = `${projectId}/${siteId}/${deploymentId}/${nightId}`
          if (nid === exact) ids.add(nid)
        }
        continue
      }
    }
    return ids
  }, [usageScope, summaries, projectId, siteId, deploymentId, nightId])

  const list = useMorphoIndexWithContext({ allowedNightIds })

  const [rankFilter, setRankFilter] = useState<'all' | 'order' | 'family' | 'genus' | 'species'>('all')

  const filterCounts = useMemo(() => {
    const all = list.length
    let order = 0
    let family = 0
    let genus = 0
    const species = list.length
    for (const it of list) {
      if (it.hasOrder) order++
      if (it.hasFamily) family++
      if (it.hasGenus) genus++
    }
    return { all, order, family, genus, species }
  }, [list])

  const filtered = useMemo(() => {
    if (rankFilter === 'all' || rankFilter === 'species') return list
    const res = list.filter((it) => {
      if (rankFilter === 'genus') return it.hasGenus
      if (rankFilter === 'family') return it.hasFamily
      if (rankFilter === 'order') return it.hasOrder
      return true
    })
    return res
  }, [list, rankFilter])

  const filters = useMemo(
    () => [
      { key: 'all' as const, label: 'All', count: filterCounts.all },
      { key: 'order' as const, label: 'Order', count: filterCounts.order, rank: 'order' as const },
      { key: 'family' as const, label: 'Family', count: filterCounts.family, rank: 'family' as const },
      { key: 'genus' as const, label: 'Genus', count: filterCounts.genus, rank: 'genus' as const },
      { key: 'species' as const, label: 'Species', count: filterCounts.species, rank: 'species' as const },
    ],
    [filterCounts],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent align='vhSide' className='max-w-[900px] col justify-start '>
        <div>
          <div className='flex items-center gap-20'>
            <h3 className='!text-16 font-medium'>Morphospecies</h3>
            <ScopeFilters
              scope={usageScope}
              onScopeChange={setUsageScope}
              hasProject={!!projectId}
              hasSite={!!(projectId && siteId)}
              hasDeployment={!!(projectId && siteId && deploymentId)}
              hasNight={!!(projectId && siteId && deploymentId && nightId)}
              counts={scopeCounts}
            />
          </div>
        </div>

        <div className='mt-12 flex items-center gap-8'>
          {filters.map((f) => (
            <RankFilterButton
              key={f.key}
              rank={f.rank}
              label={f.label}
              count={f.count}
              active={rankFilter === f.key}
              onClick={() => setRankFilter(f.key)}
            />
          ))}
        </div>

        {!filtered.length ? (
          <p className='mt-12 text-sm text-neutral-500'>No morphospecies found.</p>
        ) : (
          <ul className='mt-12 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-12 max-h-[60vh] overflow-y-auto pr-8'>
            {filtered.map((it) => (
              <MorphoCard key={it.key} morphoKey={it.key} count={it.count} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
function ScopeFilters(props: {
  scope: 'all' | 'project' | 'site' | 'deployment' | 'night'
  onScopeChange: (s: 'all' | 'project' | 'site' | 'deployment' | 'night') => void
  hasProject: boolean
  hasSite: boolean
  hasDeployment: boolean
  hasNight: boolean
  counts?: Record<'all' | 'project' | 'site' | 'deployment' | 'night', number>
}) {
  const { scope, onScopeChange, hasProject, hasSite, hasDeployment, hasNight, counts } = props
  const items: Array<{ key: 'all' | 'project' | 'site' | 'deployment' | 'night'; label: string; disabled?: boolean; count?: number }> = [
    { key: 'all', label: 'All Datasets', count: counts?.all },
    { key: 'project', label: 'This Dataset', disabled: !hasProject, count: counts?.project },
    { key: 'site', label: 'This Site', disabled: !hasSite, count: counts?.site },
    { key: 'deployment', label: 'This Deployment', disabled: !hasDeployment, count: counts?.deployment },
    { key: 'night', label: 'This Night', disabled: !hasNight, count: counts?.night },
  ]
  return (
    <div className='flex items-center gap-6'>
      {items.map((it) => (
        <button
          key={it.key}
          className={cn(
            '!text-14 text-ink-primary/80 font-normal px-8 py-4 rounded ring-1 ring-inset ring-black/10 inline-flex items-center gap-6',
            scope === it.key && 'ring-black/50 text-ink-primary',

            it.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-neutral-50',
          )}
          disabled={it.disabled}
          onClick={() => {
            if (it.disabled) return
            onScopeChange(it.key)
          }}
        >
          {it.label}
          {typeof it.count === 'number' ? <CountPill value={it.count} /> : null}
        </button>
      ))}
    </div>
  )
}

function RankFilterButton(props: {
  label: string
  count?: number
  rank?: 'order' | 'family' | 'genus' | 'species'
  active?: boolean
  onClick: () => void
}) {
  const { label, count, rank, active, onClick } = props

  const variant = rank ? mapRankToVariant({ rank }) : undefined
  const colorClass = rank && variant ? colorVariantsMap[variant as keyof typeof colorVariantsMap] : undefined

  return (
    <button
      className={cn(
        'text-12 pl-6 pr-8 py-4 rounded ring-1 ring-inset ring-black/10 inline-flex items-center gap-6  text-opacity-20 !text-ink-primary/80',
        // colorClass,
        active && 'ring-black/50 !text-ink-primary',
        ' text-ink-primary',
      )}
      onClick={onClick}
    >
      {rank ? <TaxonRankLetterBadge rank={rank} /> : null}
      <span>{label}</span>
      {typeof count === 'number' ? <CountPill value={count} /> : null}
    </button>
  )
}

function CountPill(props: { value: number }) {
  const { value } = props
  return (
    <span
      className={cn(
        '!text-11 rounded-[2px] !min-w-16 bg-neutral-50 px-2 !py-1 text-neutral-700 ring-1 ring-inset ring-neutral-100',
        value > 0 && 'bg-neutral-100 ring-neutral-200',
      )}
    >
      {value}
    </span>
  )
}

type MorphoCardProps = { morphoKey: string; count: number }

function MorphoCard(props: MorphoCardProps) {
  const { morphoKey, count } = props
  const previewUrl = useMorphoPreviewUrl({ morphoKey })

  return (
    <li className='rounded-md border bg-white p-12'>
      {previewUrl ? (
        <div className='-mt-4 -mx-4 mb-8'>
          <img src={previewUrl} alt={morphoKey} className='w-full h-[200px] object-contain rounded border' />
        </div>
      ) : null}
      <div className='flex items-center gap-8'>
        <span className='font-medium text-ink-primary truncate'>{displayFromKey(morphoKey)}</span>
        <span className='ml-auto text-12 text-neutral-600'>{count}</span>
      </div>
      <div className='mt-8'>
        <MorphoSpeciesDetailsDialog morphoKey={morphoKey}>
          <Button size='xsm'>View usage</Button>
        </MorphoSpeciesDetailsDialog>
      </div>
    </li>
  )
}

function displayFromKey(key: string) {
  const res = key
  return res
}

// Data hooks and helpers

function useMorphoIndexWithContext(params?: { allowedNightIds?: Set<string> | undefined }) {
  const { allowedNightIds } = params || {}
  const summaries = useStore(nightSummariesStore)
  const detections = useStore(detectionsStore)

  const contextByKey = useMemo(() => buildContextByMorphoKey({ detections, allowedNightIds }), [detections, allowedNightIds])

  const list = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [nid, s] of Object.entries(summaries ?? {})) {
      if (allowedNightIds && !allowedNightIds.has(nid)) continue
      const m = (s as any)?.morphoCounts as Record<string, number> | undefined
      if (!m) continue
      for (const [k, v] of Object.entries(m)) counts[k] = (counts[k] || 0) + (typeof v === 'number' ? v : 0)
    }
    const arr = Object.entries(counts)
      .map(([key, count]) => {
        const ctx = contextByKey.get(key) || { hasOrder: false, hasFamily: false, hasGenus: false }
        return { key, count, ...ctx }
      })
      .sort((a, b) => b.count - a.count)
    return arr
  }, [summaries, contextByKey, allowedNightIds])

  return list as Array<{ key: string; count: number; hasOrder: boolean; hasFamily: boolean; hasGenus: boolean }>
}

function buildContextByMorphoKey(params: { detections?: Record<string, any>; allowedNightIds?: Set<string> | undefined }) {
  const { detections, allowedNightIds } = params
  const map = new Map<string, { hasOrder: boolean; hasFamily: boolean; hasGenus: boolean }>()
  for (const d of Object.values(detections ?? {})) {
    const det = d as any
    if (det?.detectedBy !== 'user') continue
    if (det?.isMorpho !== true) continue
    if (allowedNightIds && det?.nightId && !allowedNightIds.has(det.nightId)) continue
    const label = (det?.label ?? '').trim()
    if (!label) continue
    const key = normalizeMorphoKey(label)
    const prev = map.get(key) || { hasOrder: false, hasFamily: false, hasGenus: false }
    const next = {
      hasOrder: prev.hasOrder || !!det?.taxon?.order,
      hasFamily: prev.hasFamily || !!det?.taxon?.family,
      hasGenus: prev.hasGenus || !!det?.taxon?.genus,
    }
    map.set(key, next)
  }
  return map
}

function extractRouteIds(pathname: string) {
  const parts = (pathname || '').replace(/^\/+/, '').split('/').filter(Boolean)
  // Expect routes like /projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId
  const isProjects = parts[0] === 'projects'
  const projectId = isProjects ? parts[1] : undefined
  const siteId = isProjects && parts[2] === 'sites' ? parts[3] : undefined
  const deploymentId = isProjects && parts[4] === 'deployments' ? parts[5] : undefined
  const nightId = isProjects && parts[6] === 'nights' ? parts[7] : undefined
  return { projectId, siteId, deploymentId, nightId }
}

function countMorphoKeysForNightIds(params: { summaries?: Record<string, any>; startsWith?: string; equals?: string }) {
  const { summaries, startsWith, equals } = params
  const keys = new Set<string>()
  for (const [nid, s] of Object.entries(summaries || {})) {
    if (equals && nid !== equals) continue
    if (startsWith && !nid.startsWith(startsWith)) continue
    const m = (s as any)?.morphoCounts as Record<string, number> | undefined
    if (!m) continue
    for (const k of Object.keys(m)) keys.add(k)
  }
  return keys.size
}

function useMorphoPreviewUrl(params: { morphoKey: string }) {
  const { morphoKey } = params
  const summaries = useStore(nightSummariesStore)
  const nights = useStore(nightsStore)
  const patches = useStore(patchesStore)
  const patchMapByNight = useStore(patchFileMapByNightStore)
  const covers = useStore(morphoCoversStore)

  const previewPairs = useMemo(() => {
    const pairs: Array<{ nightId: string; patchId: string }> = []

    const override = covers?.[normalizeMorphoKey(morphoKey)]
    if (override?.nightId && override?.patchId) pairs.push({ nightId: override.nightId, patchId: override.patchId })

    for (const [nightId, s] of Object.entries(summaries ?? {})) {
      const countForKey = (s as any)?.morphoCounts?.[morphoKey]
      if (!countForKey) continue
      if (!nights?.[nightId]) continue
      const pid = (s as any)?.morphoPreviewPatchIds?.[morphoKey]
      if (pid) pairs.push({ nightId, patchId: String(pid) })
    }
    return pairs
  }, [summaries, nights, morphoKey, covers])

  const [previewFile, setPreviewFile] = useState<File | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function pickPreviewFile() {
      for (const pair of previewPairs) {
        const f = (patches?.[pair.patchId] as any)?.imageFile?.file as File | undefined
        if (f) {
          if (!cancelled) setPreviewFile(f)
          return
        }
      }
      for (const pair of previewPairs) {
        const mapForNight = patchMapByNight?.[pair.nightId]
        const indexed: IndexedFile | undefined = mapForNight?.[pair.patchId.toLowerCase()]
        if (!indexed) continue
        const file = await ensureFileFromIndexed(indexed)
        if (file) {
          if (!cancelled) setPreviewFile(file)
          return
        }
      }
      if (!cancelled) setPreviewFile(undefined)
    }
    void pickPreviewFile()
    return () => {
      cancelled = true
    }
  }, [previewPairs, patches, patchMapByNight])

  const previewUrl = useObjectUrl(previewFile)
  return previewUrl
}

async function ensureFileFromIndexed(indexed: IndexedFile): Promise<File | undefined> {
  const existing = (indexed as any)?.file as File | undefined
  if (existing) return existing
  const handle = (indexed as any)?.handle as { getFile?: () => Promise<File> } | undefined
  if (handle && typeof handle.getFile === 'function') {
    try {
      const file = await handle.getFile()
      return file
    } catch {
      return undefined
    }
  }
  return undefined
}

export {}
