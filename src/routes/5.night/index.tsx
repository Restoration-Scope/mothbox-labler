import { useStore } from '@nanostores/react'
import { useParams } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { indexedFilesStore } from '~/features/folder-processing/files.state'
import { nightsStore } from '~/stores/entities/4.nights'
import type { PatchEntity } from '~/stores/entities/5.patches'
import { patchesStore } from '~/stores/entities/5.patches'
import type { DetectionEntity } from '~/stores/entities/detections'
import { acceptDetections, detectionsStore, labelDetections } from '~/stores/entities/detections'
import { projectSpeciesSelectionStore, speciesListsStore } from '~/stores/species-lists'
import { ingestDetectionsForNight } from '~/stores/entities/ingest'
import { clearPatchSelection, selectedPatchIdsStore, setSelection } from '~/stores/ui'
import { Row } from '~/styles'
import { IdentifyDialog } from './identify-dialog'
import { PatchDetailDialog } from './patch-detail-dialog'
import { NightLeftPanel } from './night-left-panel'
import { PatchGrid } from './patch-grid'
import { SelectionBar } from './selection-bar'
import { photosStore } from '~/stores/entities/photos'
import { useAppLoading } from '~/features/folder-processing/files-queries'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { SpeciesPicker } from '~/components/species-picker'

type TaxonSelection = { rank: 'order' | 'family' | 'genus' | 'species'; name: string } | undefined

type TaxonomyNode = {
  rank: 'order' | 'family' | 'genus' | 'species'
  name: string
  count: number
  children?: TaxonomyNode[]
}

export function Night() {
  const params = useParams({ from: '/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId' })
  const nights = useStore(nightsStore)
  const patches = useStore(patchesStore)
  const detections = useStore(detectionsStore)
  const photos = useStore(photosStore)
  const { isLoading: isLoadingFolders } = useAppLoading()
  const indexedFiles = useStore(indexedFilesStore)
  const selected = useStore(selectedPatchIdsStore)
  useStore(projectSpeciesSelectionStore)
  const [selectedTaxon, setSelectedTaxon] = useState<TaxonSelection>(undefined)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<'auto' | 'user' | undefined>('auto')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailPatchId, setDetailPatchId] = useState<string | null>(null)
  const [isNightIngesting, setIsNightIngesting] = useState(false)
  const ingestRunRef = useRef(0)
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false)
  const [identifyPending, setIdentifyPending] = useState(false)

  const nightId = `${params.projectId}/${params.siteId}/${params.deploymentId}/${params.nightId}`
  const night = nights[nightId]

  useEffect(() => {
    // Only run ingestion once per night route activation until indexed files change.
    const hasAnyForNight = Object.values(detections ?? {}).some((d) => (d as any)?.nightId === nightId)
    if (hasAnyForNight) return
    if (!indexedFiles?.length) return
    console.log('🌀 night: ingesting detections for night', { nightId })
    const runId = ++ingestRunRef.current
    setIsNightIngesting(true)
    void ingestDetectionsForNight({ files: indexedFiles, nightId }).finally(() => {
      if (ingestRunRef.current === runId) setIsNightIngesting(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nightId, indexedFiles])

  useEffect(() => {
    if (!nightId) return
    const nightPatches = Object.values(patches ?? {}).filter((p) => (p as any)?.nightId === nightId)
    const nightDetections = Object.values(detections ?? {}).filter((d) => (d as any)?.nightId === nightId)
    const detectedByUserCount = nightDetections.filter((d) => (d as any)?.detectedBy === 'user').length
    const withImages = nightPatches.filter((p: any) => !!p?.imageFile).length
    console.log('✅ night: state snapshot', {
      nightId,
      counts: {
        patches: nightPatches.length,
        patchesWithImages: withImages,
        detections: nightDetections.length,
        detectedByUser: detectedByUserCount,
      },
      patches: nightPatches.map((p) => ({ id: (p as any)?.id, name: (p as any)?.name, photoId: (p as any)?.photoId })),
      detections: nightDetections.map((d) => ({
        id: (d as any)?.id,
        label: (d as any)?.label,
        detectedBy: (d as any)?.detectedBy,
        score: (d as any)?.score,
        shapeType: (d as any)?.shapeType,
        patchId: (d as any)?.patchId,
        photoId: (d as any)?.photoId,
        pointsCount: Array.isArray((d as any)?.points) ? (d as any)?.points.length : 0,
      })),
    })
  }, [nightId, patches, detections])

  // Names rendered by RootLayout breadcrumbs
  // Breadcrumbs now rendered by RootLayout

  const list = useMemo(() => Object.values(patches).filter((patch) => patch.nightId === nightId), [patches, nightId])
  const taxonomyAuto = useMemo(() => buildTaxonomyTreeForNight({ detections, nightId, bucket: 'auto' }), [detections, nightId])
  const taxonomyUser = useMemo(() => buildTaxonomyTreeForNight({ detections, nightId, bucket: 'user' }), [detections, nightId])
  const totalDetections = useMemo(() => Object.values(detections ?? {}).filter((d) => d.nightId === nightId).length, [detections, nightId])
  const totalIdentified = useMemo(
    () => Object.values(detections ?? {}).filter((d) => d.nightId === nightId && (d as any)?.detectedBy === 'user').length,
    [detections, nightId],
  )
  const filtered = useMemo(
    () => filterPatchesByTaxon({ patches: list, detections, selectedTaxon, selectedBucket }),
    [list, detections, selectedTaxon, selectedBucket],
  )
  const sorted = useMemo(() => sortPatchesByDimensions({ patches: filtered, detections }), [filtered, detections])
  const selectedCount = useMemo(() => Array.from(selected ?? []).filter((id) => !!id).length, [selected])
  const selectedDetectionIds = useMemo(() => Array.from(selected ?? []), [selected])

  const nightWarnings = useMemo(() => {
    let jsonWithoutPhotoCount = 0
    let missingPatchImageCount = 0

    // JSON exists but photo image missing
    for (const p of Object.values(photos ?? {})) {
      if ((p as any)?.nightId !== nightId) continue
      const hasJson = !!(p as any)?.botDetectionFile
      const hasImage = !!(p as any)?.imageFile
      if (hasJson && !hasImage) jsonWithoutPhotoCount++
    }

    // Detections referencing missing patch images
    for (const d of Object.values(detections ?? {})) {
      if ((d as any)?.nightId !== nightId) continue
      const patchId = (d as any)?.patchId
      const patch = (patches as any)?.[patchId]
      const hasPatchImage = !!patch?.imageFile
      if (!hasPatchImage) missingPatchImageCount++
    }

    return { jsonWithoutPhotoCount, missingPatchImageCount }
  }, [photos, detections, patches, nightId])

  function onIdentify() {
    if (selectedCount === 0) return

    setIdentifyPending(true)

    const selectionByProject = projectSpeciesSelectionStore.get() || {}
    const hasSelection = !!selectionByProject?.[params.projectId]
    const anySpeciesLists = Object.keys(speciesListsStore.get() || {}).length > 0

    if (!hasSelection && anySpeciesLists) {
      setSpeciesPickerOpen(true)
      return
    }

    setIdentifyOpen(true)
    setIdentifyPending(false)
  }

  function onAccept() {
    if (selectedDetectionIds.length === 0) return
    acceptDetections({ detectionIds: selectedDetectionIds })
    clearPatchSelection()
  }

  function onSubmitLabel(label: string, taxon?: any) {
    if (!label) return
    if (selectedDetectionIds.length === 0) return
    labelDetections({ detectionIds: selectedDetectionIds, label, taxon })
    clearPatchSelection()
  }

  function onUnselect() {
    if (selectedCount === 0) return
    clearPatchSelection()
  }

  function onSelectAll() {
    const allPatchIds = filtered.map((p) => p.id)
    setSelection({ nightId, patchIds: allPatchIds })
  }

  function onOpenPatchDetail(id: string) {
    if (!id) return
    setDetailPatchId(id)
    setDetailOpen(true)
  }

  const isNightLoading = isLoadingFolders || isNightIngesting

  if (isNightLoading) {
    return <CenteredLoader>🌀 Loading night patche</CenteredLoader>
  }

  if (!night) return <p className='text-sm text-neutral-500'>Night not found</p>

  return (
    <Row className='w-full h-full overflow-hidden gap-x-4'>
      <NightLeftPanel
        taxonomyAuto={taxonomyAuto}
        taxonomyUser={taxonomyUser}
        totalPatches={list.length}
        totalDetections={totalDetections}
        totalIdentified={totalIdentified}
        warnings={nightWarnings}
        selectedTaxon={selectedTaxon}
        selectedBucket={selectedBucket}
        onSelectTaxon={({ taxon, bucket }) => {
          setSelectedTaxon(taxon)
          setSelectedBucket(bucket)
        }}
        className='w-[300px] overflow-y-auto'
      />
      <div className='relative flex-1 min-h-0 overflow-hidden'>
        <PatchGrid patches={sorted} nightId={nightId} className='h-full' onOpenPatchDetail={onOpenPatchDetail} />
        <SelectionBar
          selectedCount={selectedCount}
          onIdentify={onIdentify}
          onAccept={onAccept}
          onUnselect={onUnselect}
          onSelectAll={onSelectAll}
        />
      </div>
      <SpeciesPicker
        open={speciesPickerOpen}
        onOpenChange={(open) => {
          setSpeciesPickerOpen(open)
          if (!open && identifyPending) {
            const selectionByProject = projectSpeciesSelectionStore.get() || {}
            const hasSelection = !!selectionByProject?.[params.projectId]
            if (hasSelection) setIdentifyOpen(true)
            setIdentifyPending(false)
          }
        }}
        projectId={params.projectId}
      />
      <IdentifyDialog open={identifyOpen} onOpenChange={setIdentifyOpen} onSubmit={onSubmitLabel} projectId={params.projectId} />
      <PatchDetailDialog open={detailOpen} onOpenChange={setDetailOpen} patchId={detailPatchId} />
    </Row>
  )
}

function buildTaxonomyTreeForNight(params: { detections: Record<string, any>; nightId: string; bucket: 'auto' | 'user' }) {
  const { detections, nightId, bucket } = params
  const onlyUser = bucket === 'user'

  const roots: TaxonomyNode[] = []

  function ensureChild(nodes: TaxonomyNode[], rank: TaxonomyNode['rank'], name: string): TaxonomyNode {
    let node = nodes.find((n) => n.rank === rank && n.name === name)
    if (!node) {
      node = { rank, name, count: 0, children: [] }
      nodes.push(node)
    }
    node.count++
    return node
  }

  for (const d of Object.values(detections ?? {})) {
    if ((d as any)?.nightId !== nightId) continue
    const detectedBy = (d as any)?.detectedBy === 'user' ? 'user' : 'auto'
    if ((onlyUser && detectedBy !== 'user') || (!onlyUser && detectedBy !== 'auto')) continue

    const order = (d as any)?.taxon?.order
    const family = (d as any)?.taxon?.family
    const genus = (d as any)?.taxon?.genus
    const species = (d as any)?.taxon?.species

    const path: Array<{ rank: TaxonomyNode['rank']; name: string }> = []
    if (order) path.push({ rank: 'order', name: order })
    if (family) path.push({ rank: 'family', name: family })
    if (genus) path.push({ rank: 'genus', name: genus })
    if (species) path.push({ rank: 'species', name: species })

    if (path.length === 0) continue

    let currentLevel = roots
    for (const seg of path) {
      const node = ensureChild(currentLevel, seg.rank, seg.name)
      if (!node.children) node.children = []
      currentLevel = node.children
    }
  }

  function sortTree(nodes: TaxonomyNode[]) {
    nodes.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    for (const n of nodes) sortTree(n.children || [])
  }
  sortTree(roots)

  return roots
}

type FilterPatchesByTaxonParams = {
  patches: PatchEntity[]
  detections: Record<string, DetectionEntity>
  selectedTaxon: TaxonSelection
  selectedBucket?: 'auto' | 'user'
}

function filterPatchesByTaxon(params: FilterPatchesByTaxonParams) {
  const { patches, detections, selectedTaxon, selectedBucket } = params

  if (!selectedTaxon && selectedBucket) {
    const result = patches.filter((p) => {
      const det = detections?.[p.id]
      const detectedBy = det?.detectedBy === 'user' ? 'user' : 'auto'
      return detectedBy === selectedBucket
    })
    return result
  }

  if (!selectedTaxon) return patches

  const result = patches.filter((p) => {
    const det = detections?.[p.id]
    const tax = det?.taxon
    let matches = false
    if (selectedTaxon?.rank === 'order') matches = tax?.order === selectedTaxon?.name
    else if (selectedTaxon?.rank === 'family') matches = tax?.family === selectedTaxon?.name
    else if (selectedTaxon?.rank === 'genus') matches = tax?.genus === selectedTaxon?.name
    else if (selectedTaxon?.rank === 'species') matches = tax?.species === selectedTaxon?.name

    if (!matches) return false
    if (!selectedBucket) return true

    const detectedBy = det?.detectedBy === 'user' ? 'user' : 'auto'
    return detectedBy === selectedBucket
  })
  return result
}

// legacy label counters retained for reference; no longer used
function getIdentifiedLabelCountsForNight(params: { detections: Record<string, any>; nightId: string }) {
  const { detections, nightId } = params
  const counts: Record<string, number> = {}
  for (const d of Object.values(detections ?? {})) {
    if ((d as any)?.nightId !== nightId) continue
    if ((d as any)?.detectedBy !== 'user') continue
    const label = (d as any)?.label || 'Unlabeled'
    counts[label] = (counts[label] ?? 0) + 1
  }
  return counts
}

function sortPatchesByDimensions(params: { patches: PatchEntity[]; detections: Record<string, DetectionEntity> }) {
  const { patches, detections } = params

  if (!Array.isArray(patches) || patches.length === 0) return patches

  const withArea = patches.map((p) => ({ patch: p, area: computeDetectionArea({ detection: detections?.[p.id] }) }))
  withArea.sort((a, b) => {
    if (b.area !== a.area) return b.area - a.area
    const byName = (a.patch?.name || '').localeCompare(b.patch?.name || '')
    return byName
  })

  const result = withArea.map((x) => x.patch)
  return result
}

function computeDetectionArea(params: { detection?: DetectionEntity }) {
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
