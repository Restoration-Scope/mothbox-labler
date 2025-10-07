import { memo } from 'react'
import { useStore } from '@nanostores/react'
import { detectionStoreById, detectionsStore } from '~/stores/entities/detections'
import { patchStoreById } from '~/stores/entities/patch-selectors'
import { Badge } from '~/components/ui/badge'
import { TaxonRankLetterBadge } from '~/components/taxon-rank-badge'
import { selectedPatchIdsStore, togglePatchSelection, setSelection, selectedClusterIdStore, setSelectedClusterId } from '~/stores/ui'
import { cn } from '~/utils/cn'
import { useObjectUrl } from '~/utils/use-object-url'
import { Button } from '~/components/ui/button'
import { ZoomInIcon } from 'lucide-react'
import type { BadgeVariants } from '~/components/ui/badge'
import { getClusterVariant } from '~/utils/colors'
import { EllipsisVertical } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { setMorphoCover } from '~/stores/morphospecies/covers'

export type PatchItemProps = {
  id: string
  index?: number
  onOpenDetail?: (id: string) => void
  onImageLoad?: (id: string) => void
  onImageError?: (id: string) => void
  compact?: boolean
  clusterVariant?: BadgeVariants['variant']
}

function PatchItemImpl(props: PatchItemProps) {
  const { id, index, compact } = props
  const patch = useStore(patchStoreById(id))
  const detection = useStore(detectionStoreById(id))
  const detections = useStore(detectionsStore)
  const selected = useStore(selectedPatchIdsStore)
  const label = detection?.label || 'Unlabeled'
  const rank = detection?.isMorpho ? 'morphospecies' : detection?.taxon?.taxonRank
  const clusterId = typeof detection?.clusterId === 'number' ? detection.clusterId : undefined
  const isSelected = selected?.has?.(id)

  const url = useObjectUrl(patch?.imageFile?.file)

  function onToggle() {
    if (!id) return
    togglePatchSelection({ patchId: id })
  }

  function onClickZoom(e: React.MouseEvent) {
    e.stopPropagation()
    if (!id) return
    const open = props?.onOpenDetail
    if (open) open(id)
  }

  function onSetMorphoCover(e: React.MouseEvent) {
    e.stopPropagation()
    const morphoKey = (detection?.isMorpho ? detection?.label || '' : '').trim()
    if (!morphoKey) return
    if (!patch?.nightId || !patch?.id) return
    void setMorphoCover({ label: morphoKey, nightId: patch.nightId, patchId: patch.id })
  }

  const clusterVariant: BadgeVariants['variant'] | undefined =
    props?.clusterVariant ?? (typeof clusterId === 'number' ? getClusterVariant(clusterId) : undefined)

  function onSelectCluster() {
    const nightId = patch?.nightId

    if (typeof clusterId !== 'number') return
    if (!nightId) return

    const all = Object.values(detections || {})

    const ids = all
      .filter((d) => d?.nightId === nightId && typeof d?.clusterId === 'number' && d?.clusterId === clusterId)
      .map((d) => (d as any)?.id)
      .filter((x): x is string => typeof x === 'string' && !!x)

    if (ids.length === 0) return

    setSelection({ nightId, patchIds: ids })
  }

  return (
    <div
      className={cn('group w-full select-none relative bg-neutral-100 rounded-md cursor-pointer outline-none')}
      tabIndex={0}
      data-index={index}
      data-id={id}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onToggle()
      }}
      role='button'
      aria-pressed={isSelected}
    >
      {!compact && typeof clusterId === 'number' && (
        <ClusterRow clusterId={clusterId} clusterVariant={clusterVariant} onClick={onSelectCluster} />
      )}

      {!compact && (
        <Button
          icon={ZoomInIcon}
          size='icon-sm'
          className='absolute top-8 z-5 right-8 opacity-0 group-hover:opacity-100'
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
          onClick={onClickZoom}
          aria-label='Open details'
        />
      )}

      {!compact && detection?.isMorpho && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size='icon-sm'
              variant='ghostOnImage'
              className='absolute top-8 right-48 z-5 opacity-0 group-hover:opacity-100'
              onMouseDown={(e) => e.stopPropagation()}
              aria-label='More actions'
            >
              <EllipsisVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side='bottom' align='end' className='min-w-[220px] p-4'>
            <DropdownMenuItem onClick={onSetMorphoCover} onSelect={(e) => e.preventDefault()} className='text-13'>
              Use this image as morphospecies cover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div
        className={cn(
          'absolute pointer-events-none inset-0 ring-inset rounded-md ring-1 ring-black/10',
          'group-hover:ring-black/40 group-hover:ring-[1.5px]',
          isSelected && 'ring-2 group-hover:ring-2 group-hover:ring-black ring-brand',
        )}
      />
      {url ? (
        <img
          src={url}
          alt={patch?.name ?? 'patch'}
          className='aspect-square w-full object-contain rounded-t-[5px]'
          onDragStart={(e) => e.preventDefault()}
          decoding='async'
          loading='lazy'
          onLoad={() => {
            if (!id) return
            props?.onImageLoad?.(id)
          }}
          onError={() => {
            if (!id) return
            props?.onImageError?.(id)
          }}
        />
      ) : (
        <div className='aspect-square w-full ' />
      )}

      {!compact && <TaxonRankRow rank={rank} label={label} />}
    </div>
  )
}

function TaxonRankRow(props: { rank: string | undefined; label: string | undefined }) {
  const { rank, label } = props

  return (
    <div className='w-full h-[22px] mx-4 flex gap-4 items-center '>
      {rank && <TaxonRankLetterBadge rank={rank} size='xsm' />}
      <Badge size='sm'>{label}</Badge>
    </div>
  )
}

function ClusterRow(props: { clusterId: number; clusterVariant: BadgeVariants['variant']; onClick?: () => void }) {
  const { clusterId, clusterVariant, onClick } = props
  const hoveredClusterId = useStore(selectedClusterIdStore)
  const isPreview = typeof hoveredClusterId === 'number' && hoveredClusterId === clusterId

  if (clusterId === -1) return null

  return (
    <div className='h-[22px]'>
      <Badge
        size='xsm'
        className={cn(
          'h-16 mx-4 cursor-pointer',
          'hover:ring-2 hover:ring-black/60 hover:ring-inset',
          isPreview && 'ring-2 ring-black/60 ring-inset',
        )}
        variant={clusterVariant}
        title='Cluster ID'
        role='button'
        tabIndex={0}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        onMouseEnter={() => setSelectedClusterId({ clusterId })}
        onMouseLeave={() => setSelectedClusterId({ clusterId: null })}
        onFocus={() => setSelectedClusterId({ clusterId })}
        onBlur={() => setSelectedClusterId({ clusterId: null })}
        onClick={() => {
          if (onClick) onClick()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            if (onClick) onClick()
          }
        }}
        aria-label={`Select cluster C${clusterId}`}
      >
        C{clusterId}
      </Badge>
    </div>
  )
}

export const PatchItem = memo(PatchItemImpl)
