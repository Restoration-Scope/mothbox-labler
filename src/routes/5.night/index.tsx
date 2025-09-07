import { useStore } from '@nanostores/react'
import { useParams } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { indexedFilesStore } from '~/features/folder-processing/files.state'
import { nightsStore } from '~/stores/entities/4.nights'
import type { PatchEntity } from '~/stores/entities/5.patches'
import { patchesStore } from '~/stores/entities/5.patches'
import type { DetectionEntity } from '~/stores/entities/detections'
import { acceptDetections, detectionsStore, labelDetections } from '~/stores/entities/detections'
import { ingestDetectionsForNight } from '~/stores/entities/ingest'
import { clearPatchSelection, selectedPatchIdsStore, setSelection } from '~/stores/ui'
import { Row } from '~/styles'
import { IdentifyDialog } from './identify-dialog'
import { PatchDetailDialog } from './patch-detail-dialog'
import { NightLeftPanel } from './night-left-panel'
import { PatchGrid } from './patch-grid'
import { SelectionBar } from './selection-bar'
import { photosStore } from '~/stores/entities/photos'
import { useIsLoadingFolders } from '~/features/folder-processing/files-queries'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'

export function Night() {
  const params = useParams({ from: '/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId' })
  const nights = useStore(nightsStore)
  const patches = useStore(patchesStore)
  const detections = useStore(detectionsStore)
  const photos = useStore(photosStore)
  const isLoadingFolders = useIsLoadingFolders()
  const indexedFiles = useStore(indexedFilesStore)
  const selected = useStore(selectedPatchIdsStore)
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(undefined)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<'auto' | 'user' | undefined>('auto')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailPatchId, setDetailPatchId] = useState<string | null>(null)
  const [isNightIngesting, setIsNightIngesting] = useState(false)
  const ingestRunRef = useRef(0)

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
  const labelCounts = useMemo(() => getLabelCountsForNight({ detections, nightId }), [detections, nightId])
  const identifiedLabelCounts = useMemo(() => getIdentifiedLabelCountsForNight({ detections, nightId }), [detections, nightId])
  const totalDetections = useMemo(() => Object.values(detections ?? {}).filter((d) => d.nightId === nightId).length, [detections, nightId])
  const totalIdentified = useMemo(
    () => Object.values(detections ?? {}).filter((d) => d.nightId === nightId && (d as any)?.detectedBy === 'user').length,
    [detections, nightId],
  )
  const filtered = useMemo(
    () => filterPatchesByLabel({ patches: list, detections, selectedLabel, selectedBucket }),
    [list, detections, selectedLabel, selectedBucket],
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
    setIdentifyOpen(true)
  }

  function onAccept() {
    if (selectedDetectionIds.length === 0) return
    acceptDetections({ detectionIds: selectedDetectionIds })
    clearPatchSelection()
  }

  function onSubmitLabel(label: string) {
    if (!label) return
    if (selectedDetectionIds.length === 0) return
    labelDetections({ detectionIds: selectedDetectionIds, label })
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
    return <CenteredLoader>🌀 Loading night patches…</CenteredLoader>
  }

  if (!night) return <p className='text-sm text-neutral-500'>Night not found</p>

  return (
    <Row className='w-full h-full overflow-hidden gap-x-4'>
      <NightLeftPanel
        labelCounts={labelCounts}
        identifiedLabelCounts={identifiedLabelCounts}
        totalPatches={list.length}
        totalDetections={totalDetections}
        totalIdentified={totalIdentified}
        warnings={nightWarnings}
        selectedLabel={selectedLabel}
        selectedBucket={selectedBucket}
        onSelectLabel={({ label, bucket }) => {
          setSelectedLabel(label)
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
      <IdentifyDialog open={identifyOpen} onOpenChange={setIdentifyOpen} onSubmit={onSubmitLabel} />
      <PatchDetailDialog open={detailOpen} onOpenChange={setDetailOpen} patchId={detailPatchId} />
    </Row>
  )
}

function getLabelCountsForNight(params: { detections: Record<string, any>; nightId: string }) {
  const { detections, nightId } = params
  const counts: Record<string, number> = {}

  for (const d of Object.values(detections ?? {})) {
    if ((d as any)?.nightId !== nightId) continue
    if ((d as any)?.detectedBy === 'user') continue
    const label = (d as any)?.label || 'Unlabeled'
    counts[label] = (counts[label] ?? 0) + 1
  }

  return counts
}

type FilterPatchesByLabelParams = {
  patches: PatchEntity[]
  detections: Record<string, DetectionEntity>
  selectedLabel?: string
  selectedBucket?: 'auto' | 'user'
}

function filterPatchesByLabel(params: FilterPatchesByLabelParams) {
  const { patches, detections, selectedLabel, selectedBucket } = params

  // If a bucket is selected but no specific label, filter by bucket only
  if (!selectedLabel && selectedBucket) {
    const result = patches.filter((p) => {
      const det = detections?.[p.id]
      const detectedBy = det?.detectedBy === 'user' ? 'user' : 'auto'
      return detectedBy === selectedBucket
    })
    return result
  }

  if (!selectedLabel) return patches

  const result = patches.filter((p) => {
    const det = detections?.[p.id]
    const label = det?.label || 'Unlabeled'
    const inLabel = label === selectedLabel

    if (!inLabel) return false
    if (!selectedBucket) return true

    const detectedBy = det?.detectedBy === 'user' ? 'user' : 'auto'
    const matches = detectedBy === selectedBucket
    return matches
  })
  return result
}

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
