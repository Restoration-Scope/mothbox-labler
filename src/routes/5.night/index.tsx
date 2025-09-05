import { useStore } from '@nanostores/react'
import { useParams } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { indexedFilesStore } from '~/features/folder-processing/files'
import { nightsStore } from '~/stores/entities/4.nights'
import type { PatchEntity } from '~/stores/entities/5.patches'
import { patchesStore } from '~/stores/entities/5.patches'
import type { DetectionEntity } from '~/stores/entities/detections'
import { acceptDetections, detectionsStore, labelDetections } from '~/stores/entities/detections'
import { ingestDetectionsForNight } from '~/stores/entities/ingest'
import { clearPatchSelection, selectedPatchIdsStore, setSelection } from '~/stores/ui'
import { Row } from '~/styles'
import { IdentifyDialog } from './identify-dialog'
import { NightLeftPanel } from './night-left-panel'
import { PatchGrid } from './patch-grid'
import { SelectionBar } from './selection-bar'

export function Night() {
  const params = useParams({ from: '/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId' })
  const nights = useStore(nightsStore)
  const patches = useStore(patchesStore)
  const detections = useStore(detectionsStore)
  const indexedFiles = useStore(indexedFilesStore)
  const selected = useStore(selectedPatchIdsStore)
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(undefined)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<'auto' | 'user' | undefined>(undefined)

  const nightId = `${params.projectId}/${params.siteId}/${params.deploymentId}/${params.nightId}`
  const night = nights[nightId]

  useEffect(() => {
    // Lazy-ingest detections for this night if we don't have any yet
    const hasAnyForNight = Object.values(detections ?? {}).some((d) => (d as any)?.nightId === nightId)
    if (!hasAnyForNight && indexedFiles?.length) {
      console.log('🌀 night: ingesting detections for night', { nightId })
      void ingestDetectionsForNight({ files: indexedFiles, nightId })
    }
  }, [nightId, indexedFiles, detections])

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

  if (!night) return <p className='text-sm text-neutral-500'>Night not found</p>

  return (
    <Row className='w-full h-full overflow-hidden gap-x-4'>
      <NightLeftPanel
        labelCounts={labelCounts}
        identifiedLabelCounts={identifiedLabelCounts}
        totalPatches={list.length}
        totalDetections={totalDetections}
        totalIdentified={totalIdentified}
        selectedLabel={selectedLabel}
        selectedBucket={selectedBucket}
        onSelectLabel={({ label, bucket }) => {
          setSelectedLabel(label)
          setSelectedBucket(label ? bucket : undefined)
        }}
        className='w-[300px] overflow-y-auto'
      />
      <div className='relative flex-1 min-h-0 overflow-hidden'>
        <PatchGrid patches={sorted} nightId={nightId} className='h-full' />
        <SelectionBar
          selectedCount={selectedCount}
          onIdentify={onIdentify}
          onAccept={onAccept}
          onUnselect={onUnselect}
          onSelectAll={onSelectAll}
        />
      </div>
      <IdentifyDialog open={identifyOpen} onOpenChange={setIdentifyOpen} onSubmit={onSubmitLabel} />
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

  if (!selectedLabel) return patches

  const result = patches.filter((p) => {
    const det = detections?.[p.id]
    const label = det?.label || 'Unlabeled'
    const inLabel = label === selectedLabel

    if (!inLabel) return false
    if (!selectedBucket) return true

    const detectedBy = det?.detectedBy === 'user' ? 'user' : 'auto'
    return detectedBy === selectedBucket
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
