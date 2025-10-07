import { useStore } from '@nanostores/react'
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '~/utils/cn'
import type { PatchEntity } from '~/stores/entities/5.patches'
import type { DetectionEntity } from '~/stores/entities/detections'
import { detectionsStore } from '~/stores/entities/detections'
import { patchColumnsStore } from '~/components/atomic/patch-size-control'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { TaxonRankLetterBadge } from '~/components/taxon-rank-badge'
import { PatchItem } from './patch-item'
import { selectedPatchIdsStore, selectionNightIdStore, setSelection, togglePatchSelection } from '~/stores/ui'
import { chunkIds, computeDetectionArea, getRankValue, getHorizontalPadding } from './grid-utils'
import { colorVariantsMap } from '~/utils/colors'
import { mapRankToVariant } from '~/utils/ranks'

const GRID_GAP_DEFAULT = 8
const GRID_GAP_COMPACT = 6
const FOOTER_HIDE_THRESHOLD = 100
// Extra per-item rows: one above, one below

const ITEM_TOP_ROWS = 1
const ITEM_BOTTOM_ROWS = 1
// Same height for top and bottom rows
const TOP_ROW_HEIGHT = 22
const DEFAULT_MIN_ITEM_WIDTH = 240
const HEADER_BASE_HEIGHT = 32
const HEADER_TOP_MARGIN = 20

export type PatchGridProps = {
  patches: PatchEntity[]
  nightId: string
  className?: string
  onOpenPatchDetail: (id: string) => void
  loading?: boolean
  onImageProgress?: (loaded: number, total: number) => void
  selectedTaxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }
  selectedBucket?: 'auto' | 'user'
}

export function PatchGrid(props: PatchGridProps) {
  const { patches, nightId, className, onOpenPatchDetail, loading, onImageProgress, selectedTaxon, selectedBucket } = props

  const containerRef = useRef<HTMLDivElement | null>(null)
  const desiredColumns = useStore(patchColumnsStore)
  const selected = useStore(selectedPatchIdsStore)
  useStore(selectionNightIdStore)

  const [isDragging, setIsDragging] = useState(false)
  const [dragToggled, setDragToggled] = useState<Set<string>>(new Set())
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState<number>(0)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const detections = useStore(detectionsStore)
  const orderedIds = useMemo(() => orderPatchIds({ patches, detections }), [patches, detections])

  const prevCountRef = useRef<number>(0)

  const [containerWidth, setContainerWidth] = useState<number>(0)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth
      const padding = getHorizontalPadding(el)
      const available = Math.max(0, width - padding)
      setContainerWidth(available)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const gapPx = useMemo(() => {
    const tentativeWidth =
      containerWidth && desiredColumns
        ? Math.floor((containerWidth - Math.max(0, desiredColumns - 1) * GRID_GAP_DEFAULT) / desiredColumns)
        : DEFAULT_MIN_ITEM_WIDTH
    return tentativeWidth < 100 ? GRID_GAP_COMPACT : GRID_GAP_DEFAULT
  }, [containerWidth, desiredColumns])

  const columns = useMemo(() => {
    if (!containerWidth) return Math.max(1, desiredColumns || 1)
    const maxColumns = 24
    const cols = Math.max(1, Math.min(maxColumns, Math.round(desiredColumns || 1)))
    return cols
  }, [containerWidth, desiredColumns])

  const itemWidth = useMemo(() => computeItemWidth({ containerWidth, columns, gap: gapPx }), [containerWidth, columns, gapPx])
  const rowHeight = useMemo(() => {
    const baseWidth = itemWidth || DEFAULT_MIN_ITEM_WIDTH
    const isCompact = (itemWidth || 0) < FOOTER_HIDE_THRESHOLD
    const topExtras = isCompact ? 0 : ITEM_TOP_ROWS * TOP_ROW_HEIGHT
    const bottomExtras = isCompact ? 0 : ITEM_BOTTOM_ROWS * TOP_ROW_HEIGHT
    const height = Math.max(0, baseWidth) + topExtras + bottomExtras + gapPx
    return height
  }, [itemWidth, gapPx])

  // Group blocks (headers + rows) mirroring left panel taxonomy
  const itemIndexById = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < orderedIds.length; i++) map.set(orderedIds[i]!, i)
    return map
  }, [orderedIds])

  type GridBlockHeader = { kind: 'header'; key: string; title: string; rank?: 'order' | 'family' | 'genus' | 'species'; count: number }
  type GridBlockRow = { kind: 'row'; key: string; itemIds: string[] }
  type GridBlock = GridBlockHeader | GridBlockRow

  const blocks = useMemo(() => {
    const UNASSIGNED_LABEL = 'Unassigned'
    const out: GridBlock[] = []
    if (!orderedIds.length) return out

    if (selectedBucket === 'user' && selectedTaxon?.name === 'ERROR') {
      out.push({ kind: 'header', key: 'hdr:errors', title: 'Errors', rank: 'species', count: orderedIds.length })
      const rows = chunkIds(orderedIds, Math.max(1, columns))
      rows.forEach((ids, idx) => out.push({ kind: 'row', key: `row:errors:${idx}`, itemIds: ids }))
      return out
    }

    const anchorRank: 'order' | 'family' | 'genus' = (selectedTaxon?.rank as any) || 'order'
    const anchorGroups = new Map<string, string[]>()
    for (const id of orderedIds) {
      const det = detections?.[id]
      const name = getRankValue({ det, rank: anchorRank }) || UNASSIGNED_LABEL
      const arr = anchorGroups.get(name) || []
      arr.push(id)
      anchorGroups.set(name, arr)
    }
    const sortedAnchor = Array.from(anchorGroups.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

    for (const [anchorName, idsOfAnchor] of sortedAnchor) {
      out.push({
        kind: 'header',
        key: `hdr:${anchorRank}:${anchorName}`,
        title: anchorName,
        rank: anchorRank,
        count: idsOfAnchor.length,
      })

      const subRank = anchorRank === 'order' ? 'family' : anchorRank === 'family' ? 'genus' : undefined
      if (!subRank) {
        const rows = chunkIds(idsOfAnchor, Math.max(1, columns))
        rows.forEach((ids, idx) => out.push({ kind: 'row', key: `row:${anchorRank}:${anchorName}:${idx}`, itemIds: ids }))
        continue
      }

      const bySub = new Map<string, string[]>()
      const noSub: string[] = []
      for (const id of idsOfAnchor) {
        const det = detections?.[id]
        const sub = getRankValue({ det, rank: subRank })
        if (!sub) noSub.push(id)
        else {
          const arr = bySub.get(sub) || []
          arr.push(id)
          bySub.set(sub, arr)
        }
      }
      if (noSub.length) {
        const rows = chunkIds(noSub, Math.max(1, columns))
        rows.forEach((ids, idx) => out.push({ kind: 'row', key: `row:${anchorRank}:${anchorName}:__nosub:${idx}`, itemIds: ids }))
      }
      const sortedSub = Array.from(bySub.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      for (const [subName, subIds] of sortedSub) {
        out.push({ kind: 'header', key: `hdr:${subRank}:${anchorName}/${subName}`, title: subName, rank: subRank, count: subIds.length })
        const rows = chunkIds(subIds, Math.max(1, columns))
        rows.forEach((ids, idx) => out.push({ kind: 'row', key: `row:${subRank}:${anchorName}/${subName}:${idx}`, itemIds: ids }))
      }
    }
    return out
  }, [orderedIds, detections, columns, selectedTaxon, selectedBucket])

  const itemIndexToBlockIndex = useMemo(() => {
    const map: number[] = []
    if (!blocks.length) return map
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      if (b.kind !== 'row') continue
      for (const id of b.itemIds) {
        const idx = itemIndexById.get(id)
        if (typeof idx === 'number') map[idx] = i
      }
    }
    return map
  }, [blocks, itemIndexById])

  const rowVirtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (i) => {
      const base = blocks[i]?.kind === 'row' ? rowHeight : HEADER_BASE_HEIGHT
      const nextIsHeader = blocks[i + 1]?.kind === 'header'
      const extra = nextIsHeader ? HEADER_TOP_MARGIN : 0
      const size = base + extra
      return size
    },
    overscan: 5,
    measureElement: (el) => {
      const node = el as HTMLElement | null
      const r = node?.getBoundingClientRect?.()
      const base = Math.ceil(r?.height || rowHeight)
      const idxAttr = node?.getAttribute('data-block-index')
      const idx = idxAttr != null ? Number(idxAttr) : -1
      const nextIsHeader = idx >= 0 && blocks[idx + 1]?.kind === 'header'
      const kind = node?.getAttribute('data-kind')
      const rowGapExtra = kind === 'row' ? gapPx : 0
      const extra = (nextIsHeader ? HEADER_TOP_MARGIN : 0) + rowGapExtra
      const h = base + extra
      return h
    },
  })

  // Preserve scroll position on minor list changes (e.g., identifying items)
  // Only reset scroll when the viewing context changes (night, bucket, or selected taxon)
  const lastContextRef = useRef<string>(`${nightId}|${selectedBucket || ''}|${selectedTaxon?.rank || ''}:${selectedTaxon?.name || ''}`)
  useEffect(() => {
    const count = orderedIds.length
    if (count === prevCountRef.current) return

    setIsDragging(false)
    setDragToggled(new Set())
    setAnchorIndex(null)
    setFocusIndex(0)

    const currentContext = `${nightId}|${selectedBucket || ''}|${selectedTaxon?.rank || ''}:${selectedTaxon?.name || ''}`
    const contextChanged = currentContext !== lastContextRef.current
    lastContextRef.current = currentContext

    if (contextChanged) {
      const el = containerRef.current
      if (el) el.scrollTo({ top: 0 })
      rowVirtualizer.scrollToIndex(0, { align: 'start' })
      rowVirtualizer.scrollToOffset(0)
      const totalSize = rowVirtualizer.getTotalSize()
    }

    prevCountRef.current = count
  }, [orderedIds.length, rowVirtualizer, columns, rowHeight, nightId, selectedBucket, selectedTaxon?.rank, selectedTaxon?.name])

  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTo({ top: 0 })
    rowVirtualizer.scrollToIndex(0, { align: 'start' })
    rowVirtualizer.scrollToOffset(0)
    const totalSize = rowVirtualizer.getTotalSize()
  }, [desiredColumns, rowVirtualizer, columns, rowHeight])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      rowVirtualizer.measure()
    })
    return () => cancelAnimationFrame(id)
  }, [rowHeight, columns, containerWidth, orderedIds.length, blocks.length, rowVirtualizer])

  const [loadedCount, setLoadedCount] = useState<number>(0)
  const totalCount = patches?.length || 0
  useEffect(() => {
    setLoadedCount(0)
  }, [nightId, patches])
  useEffect(() => {
    onImageProgress?.(loadedCount, totalCount)
  }, [loadedCount, totalCount, onImageProgress])
  function handleImageLoad() {
    setLoadedCount((c) => c + 1)
  }
  function handleImageError() {
    setLoadedCount((c) => c + 1)
  }

  useEffect(() => {
    function onMouseUp() {
      setIsDragging(false)
      setDragToggled(new Set())
    }
    if (isDragging) window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [isDragging])

  function handleItemMouseDown(e: React.MouseEvent, index: number, patchId: string) {
    e.preventDefault()
    if (e.shiftKey) {
      const start = anchorIndex ?? index
      const [lo, hi] = start <= index ? [start, index] : [index, start]
      const rangeIds = orderedIds.slice(lo, hi + 1)
      const current = new Set(selected ?? new Set())
      for (const id of rangeIds) current.add(id)
      setSelection({ nightId, patchIds: Array.from(current) })
      setAnchorIndex(index)
      setFocusIndex(index)
      focusItem(index)
      return
    }

    togglePatchSelection({ patchId })
    const next = new Set(dragToggled)
    next.add(patchId)
    setDragToggled(next)
    setIsDragging(true)
    setAnchorIndex(index)
    setFocusIndex(index)
    focusItem(index)
  }

  function handleItemMouseEnter(patchId: string) {
    if (!isDragging) return
    if (dragToggled.has(patchId)) return
    togglePatchSelection({ patchId })
    const next = new Set(dragToggled)
    next.add(patchId)
    setDragToggled(next)
  }

  function onMouseDownContainer(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    const indexAttr = target?.closest('[data-index]')?.getAttribute('data-index')
    if (indexAttr == null) return
    const index = Number(indexAttr)
    const id = orderedIds[index]
    if (!id) return
    handleItemMouseDown(e, index, id)
  }

  function onMouseMoveContainer(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    const indexAttr = target?.closest('[data-index]')?.getAttribute('data-index')
    if (indexAttr != null) {
      const index = Number(indexAttr)
      if (!Number.isNaN(index) && index !== hoverIndex) setHoverIndex(index)
      if (isDragging) {
        const id = orderedIds[index]
        if (id) handleItemMouseEnter(id)
      }
    } else if (hoverIndex != null) {
      setHoverIndex(null)
    }
  }

  function onMouseLeaveContainer(e: React.MouseEvent) {
    if (hoverIndex != null) setHoverIndex(null)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!orderedIds.length) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const delta = e.key === 'ArrowLeft' ? -1 : 1
      const next = Math.max(0, Math.min(orderedIds.length - 1, focusIndex + delta))
      setFocusIndex(next)
      focusItem(next)
      return
    }
    if (e.key === ' ') {
      e.preventDefault()
      if (hoverIndex != null) return
      const id = orderedIds[focusIndex]
      if (id) togglePatchSelection({ patchId: id })
      return
    }
  }

  const hoveredId = useMemo(() => {
    if (hoverIndex == null) return null
    const id = orderedIds[hoverIndex]
    return id ?? null
  }, [hoverIndex, orderedIds])

  useHotkeys(
    'space',
    (e) => {
      if (!hoveredId) return
      e.preventDefault()
      onOpenPatchDetail(hoveredId)
    },
    {},
    [hoveredId, onOpenPatchDetail],
  )

  function focusItem(index: number) {
    const blockIndex = itemIndexToBlockIndex[index]
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector(`[data-index="${index}"]`) as HTMLElement | null
      // Avoid scrolling when focusing the item
      el?.focus({ preventScroll: true })
    })
  }

  if (loading) return <CenteredLoader>🌀 Loading patches</CenteredLoader>

  return (
    <GridContainer
      ref={containerRef}
      className={className}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDownContainer}
      onMouseMove={onMouseMoveContainer}
      onMouseLeave={onMouseLeaveContainer}
    >
      <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {!orderedIds.length ? <div className='p-8 text-sm text-neutral-500'>No patches found</div> : null}

        {rowVirtualizer.getVirtualItems().map((stripe) => {
          const block = blocks[stripe.index]
          return (
            <div
              key={stripe.key}
              ref={rowVirtualizer.measureElement}
              data-block-index={stripe.index}
              data-kind={block?.kind}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${stripe.start}px)` }}
            >
              {block?.kind === 'header' ? (
                <GroupHeader title={block.title} rank={block.rank} count={block.count} className='px-8 py-6' />
              ) : block?.kind === 'row' ? (
                <RowGrid
                  itemIds={block.itemIds}
                  columns={columns}
                  gapPx={gapPx}
                  itemWidth={itemWidth}
                  itemIndexById={itemIndexById}
                  onOpenPatchDetail={onOpenPatchDetail}
                  onImageLoad={(id) => setLoadedCount((c) => c + 1)}
                  onImageError={(id) => setLoadedCount((c) => c + 1)}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </GridContainer>
  )
}

type GridContainerProps = {
  className?: string
  children: React.ReactNode
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onMouseLeave: (e: React.MouseEvent) => void
}

const GridContainer = React.forwardRef<HTMLDivElement, GridContainerProps>(function GridContainer(props, ref) {
  const { className, children, onMouseDown, onMouseMove, onKeyDown, onMouseLeave } = props
  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={cn('relative overflow-y-auto p-8 outline-none', className)}
    >
      {children}
    </div>
  )
})

function orderPatchIds(params: { patches: PatchEntity[]; detections: Record<string, DetectionEntity> }) {
  const { patches, detections } = params
  if (!Array.isArray(patches) || patches.length === 0) return [] as string[]
  const withSortKey = patches.map((p) => {
    const det = detections?.[p.id]
    const clusterId = typeof (det as any)?.clusterId === 'number' ? (det as any)?.clusterId : undefined
    const area = computeDetectionArea({ detection: det })
    return { id: p.id, name: p.name, clusterId, area }
  })
  withSortKey.sort((a, b) => {
    const aHas = typeof a.clusterId === 'number'
    const bHas = typeof b.clusterId === 'number'
    if (aHas && bHas && (a.clusterId as any) !== (b.clusterId as any)) return (a.clusterId as any) - (b.clusterId as any)
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    if (b.area !== a.area) return b.area - a.area
    return (a?.name || '').localeCompare(b?.name || '')
  })
  const ids = withSortKey.map((x) => x.id)
  return ids
}

function computeItemWidth(params: { containerWidth: number; columns: number; gap: number }) {
  const { containerWidth, columns, gap } = params
  if (!containerWidth || containerWidth <= 0 || !columns) return 0
  const totalGaps = Math.max(0, columns - 1) * gap
  const width = Math.max(0, containerWidth - totalGaps)
  const colWidth = Math.floor(width / Math.max(1, columns))
  return colWidth
}

function GroupHeader(props: { title: string; rank?: 'order' | 'family' | 'genus' | 'species'; count: number; className?: string }) {
  const { title, rank, count, className } = props

  const colorVariant = mapRankToVariant({ rank })
  const colorClass = colorVariantsMap[colorVariant as keyof typeof colorVariantsMap]

  return (
    <div className={cn('flex items-center ring-1 ring-inset rounded-sm justify-between', colorClass, className)}>
      <div className='flex items-center gap-6'>
        <TaxonRankLetterBadge rank={rank} size='xsm' />
        <span className='text-13 font-semibold text-ink-primary'>{title}</span>
      </div>
      <span className='text-12 text-neutral-600'>{count}</span>
    </div>
  )
}

type RowGridProps = {
  itemIds: string[]
  columns: number
  gapPx: number
  itemWidth: number
  itemIndexById: Map<string, number>
  onOpenPatchDetail: (id: string) => void
  onImageLoad: (id: string) => void
  onImageError: (id: string) => void
}

function RowGrid(props: RowGridProps) {
  const { itemIds, columns, gapPx, itemWidth, itemIndexById, onOpenPatchDetail, onImageLoad, onImageError } = props

  const compact = (itemWidth || 0) < FOOTER_HIDE_THRESHOLD

  return (
    <div
      className='grid'
      style={{
        gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))`,
        columnGap: `${gapPx}px`,
        rowGap: `0px`,
        marginBottom: `${gapPx}px`,
      }}
    >
      {itemIds.map((id) => {
        const index = itemIndexById.get(id) ?? 0
        return (
          <PatchItem
            id={id}
            key={id}
            index={index}
            compact={compact}
            onOpenDetail={onOpenPatchDetail}
            onImageLoad={onImageLoad}
            onImageError={onImageError}
          />
        )
      })}
    </div>
  )
}
