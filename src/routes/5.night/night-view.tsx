import { useStore } from '@nanostores/react'
import { useMemo, useState } from 'react'
import { ensureSpeciesListSelection } from '~/features/species-picker/species-picker.state'
import { nightsStore } from '~/stores/entities/4.nights'
import type { PatchEntity } from '~/stores/entities/5.patches'
import { patchesStore } from '~/stores/entities/5.patches'
import type { DetectionEntity } from '~/stores/entities/detections'
import { acceptDetections, detectionsStore, labelDetections } from '~/stores/entities/detections'
import { photosStore } from '~/stores/entities/photos'
import { clearPatchSelection, selectedPatchIdsStore, setSelection } from '~/stores/ui'
import { Row } from '~/styles'
import { IdentifyDialog } from '~/features/species-identification/identify-dialog'
import { NightLeftPanel } from '@/features/left-panel/night-left-panel'
import { PatchDetailDialog } from './patch-detail-dialog'
import { PatchGrid } from './patch-grid'
import { SelectionBar } from './selection-bar'

type TaxonSelection = { rank: 'order' | 'family' | 'genus' | 'species'; name: string } | undefined

export function NightView(props: { nightId: string }) {
  const { nightId } = props

  const nights = useStore(nightsStore)
  const patches = useStore(patchesStore)
  const detections = useStore(detectionsStore)
  const photos = useStore(photosStore)
  const [selectedTaxon, setSelectedTaxon] = useState<TaxonSelection>(undefined)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<'auto' | 'user' | undefined>('auto')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailPatchId, setDetailPatchId] = useState<string | null>(null)
  const selected = useStore(selectedPatchIdsStore)

  const night = nights[nightId]

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
  const sorted = useMemo(() => sortPatchesByClusterThenArea({ patches: filtered, detections }), [filtered, detections])
  const totalPatches = list.length
  const selectedCount = useMemo(() => Array.from(selected ?? []).filter((id) => !!id).length, [selected])
  const selectedDetectionIds = useMemo(() => Array.from(selected ?? []), [selected])

  const nightWarnings = useMemo(() => {
    let jsonWithoutPhotoCount = 0
    let missingPatchImageCount = 0
    for (const p of Object.values(photos ?? {})) {
      if ((p as any)?.nightId !== nightId) continue
      const hasJson = !!(p as any)?.botDetectionFile
      const hasImage = !!(p as any)?.imageFile
      if (hasJson && !hasImage) jsonWithoutPhotoCount++
    }
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
    ensureSpeciesListSelection({ projectId: (night as any)?.projectId, onReady: () => setIdentifyOpen(true) })
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

  if (!night) return <p className='text-sm text-neutral-500'>Night not found</p>

  return (
    <Row className='w-full h-full overflow-hidden gap-x-4'>
      <NightLeftPanel
        taxonomyAuto={taxonomyAuto}
        taxonomyUser={taxonomyUser}
        totalPatches={totalPatches}
        totalDetections={totalDetections}
        totalIdentified={totalIdentified}
        warnings={nightWarnings}
        selectedTaxon={selectedTaxon as any}
        selectedBucket={selectedBucket}
        onSelectTaxon={({ taxon, bucket }) => {
          setSelectedTaxon(taxon as any)
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
      <IdentifyDialog open={identifyOpen} onOpenChange={setIdentifyOpen} onSubmit={onSubmitLabel} projectId={(night as any)?.projectId} />
      <PatchDetailDialog open={detailOpen} onOpenChange={setDetailOpen} patchId={detailPatchId} />
    </Row>
  )
}

type TaxonomyNode = {
  rank: 'order' | 'family' | 'genus' | 'species'
  name: string
  count: number
  children?: TaxonomyNode[]
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

function filterPatchesByTaxon(params: {
  patches: PatchEntity[]
  detections: Record<string, DetectionEntity>
  selectedTaxon: TaxonSelection
  selectedBucket?: 'auto' | 'user'
}) {
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

function sortPatchesByClusterThenArea(params: { patches: PatchEntity[]; detections: Record<string, DetectionEntity> }) {
  const { patches, detections } = params
  if (!Array.isArray(patches) || patches.length === 0) return patches
  const withKeys = patches.map((p) => {
    const det = detections?.[p.id]
    const clusterId = typeof (det as any)?.clusterId === 'number' ? (det as any)?.clusterId : undefined
    const area = computeDetectionArea({ detection: det })
    return { patch: p, clusterId, area }
  })
  withKeys.sort((a, b) => {
    const aHas = typeof a.clusterId === 'number'
    const bHas = typeof b.clusterId === 'number'
    if (aHas && bHas && (a.clusterId as any) !== (b.clusterId as any)) return (a.clusterId as any) - (b.clusterId as any)
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    if (b.area !== a.area) return b.area - a.area
    const byName = (a.patch?.name || '').localeCompare(b.patch?.name || '')
    return byName
  })
  const result = withKeys.map((x) => x.patch)
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
