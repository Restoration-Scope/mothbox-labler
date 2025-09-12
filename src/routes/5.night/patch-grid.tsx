import { cn } from '~/utils/cn'
import type { PatchEntity } from '~/stores/entities/5.patches'
import { useStore } from '@nanostores/react'
import type { DetectionEntity } from '~/stores/entities/detections'
import { detectionsStore } from '~/stores/entities/detections'
import { PatchItem } from './patch-item'
import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { patchColumnsStore } from '~/components/atomic/patch-size-control'
import { selectedPatchIdsStore, selectionNightIdStore, setSelection, togglePatchSelection } from '~/stores/ui'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { useVirtualizer } from '@tanstack/react-virtual'
// noop

const DEFAULT_MIN_ITEM_WIDTH = 240
const GRID_GAP_DEFAULT = 8
const GRID_GAP_COMPACT = 6
const FOOTER_HEIGHT = 28
const FOOTER_HIDE_THRESHOLD = 100 // hide footer when base size smaller than this

export type PatchGridProps = {
  patches: PatchEntity[]
  nightId: string
  className?: string
  onOpenPatchDetail: (id: string) => void
  loading?: boolean
  onImageProgress?: (loaded: number, total: number) => void
}

export function PatchGrid(props: PatchGridProps) {
  const { patches, nightId, className, onOpenPatchDetail, loading, onImageProgress } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const desiredColumns = useStore(patchColumnsStore)
  const selected = useStore(selectedPatchIdsStore)
  useStore(selectionNightIdStore)

  // Loading is passed from parent (night-level). Avoid coupling to global folder restore here to prevent flicker.

  const [isDragging, setIsDragging] = useState(false)
  const [dragToggled, setDragToggled] = useState<Set<string>>(new Set())
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState<number>(0)

  const detections = useStore(detectionsStore)
  const orderedIds = useMemo(() => {
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
  }, [patches, detections])

  // Reset scroll and focus when the visible item count changes (filters)
  const prevCountRef = useRef<number>(0)

  // Measure container width to determine dynamic column count and item sizing
  const [containerWidth, setContainerWidth] = useState<number>(0)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth
      const padding = getHorizontalPadding(el)
      const available = Math.max(0, width - padding)
      setContainerWidth(available)
      console.log('📐 grid: measure container', { width, padding, available })
    }
    // Measure immediately to avoid an initial 0-width pass that collapses rows
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const minItemWidth = DEFAULT_MIN_ITEM_WIDTH
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
    // Item height approximates square image + footer + vertical gap between rows
    // Fallback to MIN_ITEM_WIDTH before the container is measured to prevent ultra-short rows
    const baseWidth = itemWidth || minItemWidth
    const footer = (itemWidth || 0) < FOOTER_HIDE_THRESHOLD ? 0 : FOOTER_HEIGHT
    const height = Math.max(0, baseWidth) + footer + gapPx
    console.log('📏 grid: sizing', { containerWidth, columns, itemWidth, footer, gapPx, rowHeight: height })
    return height
  }, [itemWidth, containerWidth, columns, gapPx, minItemWidth])

  const rowCount = useMemo(() => {
    if (!orderedIds.length) return 0
    const count = Math.ceil(orderedIds.length / Math.max(1, columns))
    console.log('🔢 grid: rows', { items: orderedIds.length, columns, rowCount: count })
    return count
  }, [orderedIds, columns])

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
    measureElement: (el) => {
      const r = (el as HTMLElement)?.getBoundingClientRect?.()
      const h = Math.ceil(r?.height || rowHeight)
      return h
    },
  })

  // When the number of visible items changes (filters), reset scroll/focus to avoid stale positions
  useEffect(() => {
    const count = orderedIds.length
    if (count === prevCountRef.current) return

    setIsDragging(false)
    setDragToggled(new Set())
    setAnchorIndex(null)
    setFocusIndex(0)

    const el = containerRef.current
    if (el) el.scrollTo({ top: 0 })

    rowVirtualizer.scrollToIndex(0, { align: 'start' })
    rowVirtualizer.scrollToOffset(0)
    const totalSize = rowVirtualizer.getTotalSize()
    console.log('🔄 grid: filter change reset', { prev: prevCountRef.current, next: count, columns, rowHeight, totalSize })
    prevCountRef.current = count
  }, [orderedIds.length, rowVirtualizer, columns, rowHeight])

  // Also reset scroll when item base size changes to prevent stale virtualization window
  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTo({ top: 0 })
    rowVirtualizer.scrollToIndex(0, { align: 'start' })
    rowVirtualizer.scrollToOffset(0)
    const totalSize = rowVirtualizer.getTotalSize()
    console.log('🔄 grid: size change reset', { desiredColumns, columns, rowHeight, totalSize })
  }, [desiredColumns, rowVirtualizer, columns, rowHeight])

  // Proactively re-measure after layout-affecting changes (prevents short stacked rows after 0-items view)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      rowVirtualizer.measure()
      console.log('📣 grid: virtualizer measure', { columns, rowHeight, items: orderedIds.length, containerWidth })
    })
    return () => cancelAnimationFrame(id)
  }, [rowHeight, columns, containerWidth, orderedIds.length, rowVirtualizer])

  // Track image load progress
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
    console.log('🖱️ grid: mousedown on item', { index, patchId })
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

    // Start drag toggle gesture
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
    if (indexAttr != null && isDragging) {
      const index = Number(indexAttr)
      const id = orderedIds[index]
      if (id) handleItemMouseEnter(id)
    }
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
      const id = orderedIds[focusIndex]
      if (id) togglePatchSelection({ patchId: id })
      return
    }
  }

  function focusItem(index: number) {
    const colCount = Math.max(1, columns)
    const rowIndex = Math.floor(index / colCount)
    rowVirtualizer.scrollToIndex(rowIndex, { align: 'center' })
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector(`[data-index="${index}"]`) as HTMLElement | null
      el?.focus()
    })
  }

  if (loading) return <CenteredLoader>🌀 Loading patches</CenteredLoader>

  // Keep container mounted even when there are no items to avoid losing measurements

  return (
    <GridContainer
      ref={containerRef}
      className={className}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDownContainer}
      onMouseMove={onMouseMoveContainer}
    >
      <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {!orderedIds.length ? <div className='p-8 text-sm text-neutral-500'>No patches found</div> : null}

        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * Math.max(1, columns)
          const end = Math.min(start + Math.max(1, columns), orderedIds.length)
          const items = orderedIds.slice(start, end)
          return (
            <div
              key={virtualRow.key}
              data-row-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className='grid' style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))`, gap: `${gapPx}px` }}>
                {items.map((id, i) => {
                  const index = start + i
                  return (
                    <PatchItem
                      id={id}
                      key={id}
                      index={index}
                      compact={(itemWidth || 0) < FOOTER_HIDE_THRESHOLD}
                      onOpenDetail={onOpenPatchDetail}
                      onImageLoad={handleImageLoad}
                      onImageError={handleImageError}
                    />
                  )
                })}
              </div>
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
}

const GridContainer = React.forwardRef<HTMLDivElement, GridContainerProps>(function GridContainer(props, ref) {
  const { className, children, onMouseDown, onMouseMove, onKeyDown } = props
  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      className={cn('relative overflow-y-auto p-8 outline-none', className)}
    >
      {children}
    </div>
  )
})

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

function computeColumnCount(params: { containerWidth: number; minItemWidth: number; gap?: number }) {
  const { containerWidth, minItemWidth, gap = GRID_GAP_DEFAULT } = params
  const minColumns = 1
  if (!containerWidth || containerWidth <= 0) return minColumns
  const clampedMin = Math.max(30, Math.min(800, minItemWidth))
  const raw = Math.floor((containerWidth + gap) / (clampedMin + gap))
  const cols = Math.max(minColumns, raw)
  return cols
}

function computeItemWidth(params: { containerWidth: number; columns: number; gap: number }) {
  const { containerWidth, columns, gap } = params
  if (!containerWidth || containerWidth <= 0 || !columns) return 0
  const totalGaps = Math.max(0, columns - 1) * gap
  const width = Math.max(0, containerWidth - totalGaps)
  const colWidth = Math.floor(width / Math.max(1, columns))
  return colWidth
}

function getHorizontalPadding(el: HTMLElement) {
  if (!el) return 0
  const styles = getComputedStyle(el)
  const left = parseFloat(styles?.paddingLeft || '0')
  const right = parseFloat(styles?.paddingRight || '0')
  const total = (isFinite(left) ? left : 0) + (isFinite(right) ? right : 0)
  return total
}
