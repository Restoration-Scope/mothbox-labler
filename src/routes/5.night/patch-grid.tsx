import { cn } from '~/utils/cn'
import type { PatchEntity } from '~/stores/entities/5.patches'
import type { DetectionEntity } from '~/stores/entities/detections'
import { detectionsStore } from '~/stores/entities/detections'
import { PatchItem } from './patch-item'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import { selectedPatchIdsStore, selectionNightIdStore, setSelection, togglePatchSelection } from '~/stores/ui'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { useVirtualizer } from '@tanstack/react-virtual'
// noop

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
    const withArea = patches.map((p) => ({ id: p.id, name: p.name, area: computeDetectionArea({ detection: detections?.[p.id] }) }))
    withArea.sort((a, b) => {
      if (b.area !== a.area) return b.area - a.area
      return (a?.name || '').localeCompare(b?.name || '')
    })
    const ids = withArea.map((x) => x.id)
    return ids
  }, [patches, detections])

  // Measure container width to determine dynamic column count and item sizing
  const [containerWidth, setContainerWidth] = useState<number>(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const width = el.clientWidth
      const padding = getHorizontalPadding(el)
      const available = Math.max(0, width - padding)
      setContainerWidth(available)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const columns = useMemo(() => computeColumnCount({ containerWidth }), [containerWidth])
  const itemWidth = useMemo(() => computeItemWidth({ containerWidth, columns, gap: 8 }), [containerWidth, columns])
  const rowHeight = useMemo(() => {
    // Item height approximates square image + footer (h-28 = 28px) + vertical gap between rows (8px)
    const height = Math.max(0, itemWidth) + 28 + 8
    return height
  }, [itemWidth])

  const rowCount = useMemo(() => {
    if (!orderedIds.length) return 0
    const count = Math.ceil(orderedIds.length / Math.max(1, columns))
    return count
  }, [orderedIds, columns])

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  })

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

  if (!patches?.length) return <p className='text-sm text-neutral-500'>No patches found</p>

  return (
    <GridContainer
      ref={containerRef}
      className={className}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDownContainer}
      onMouseMove={onMouseMoveContainer}
    >
      <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
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
              <div className='grid gap-8' style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` }}>
                {items.map((id, i) => {
                  const index = start + i
                  return (
                    <PatchItem
                      id={id}
                      key={id}
                      index={index}
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

type ComputeDetectionAreaParams = { detection?: DetectionEntity }
function computeDetectionArea(params: ComputeDetectionAreaParams) {
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

function computeColumnCount(params: { containerWidth: number }) {
  const { containerWidth } = params
  const minColumns = 2
  const maxColumns = 5
  const minItemWidth = 240 // px
  const gap = 8 // px
  if (!containerWidth || containerWidth <= 0) return minColumns
  const raw = Math.floor((containerWidth + gap) / (minItemWidth + gap))
  const cols = Math.min(maxColumns, Math.max(minColumns, raw))
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
