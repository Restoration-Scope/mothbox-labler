import { memo } from 'react'
import { useStore } from '@nanostores/react'
import { detectionStoreById } from '~/stores/entities/detections'
import { patchStoreById } from '~/stores/entities/patch-selectors'
import { Badge } from '~/components/ui/badge'
import { TaxonRankLetterBadge } from '~/components/taxon-rank-badge'
import { selectedPatchIdsStore, togglePatchSelection } from '~/stores/ui'
import { cn } from '~/utils/cn'
import { useObjectUrl } from '~/utils/use-object-url'
import { Button } from '~/components/ui/button'
import { ZoomInIcon } from 'lucide-react'
import type { BadgeVariants } from '~/components/ui/badge'
import { getClusterVariant } from '~/utils/colors'

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

  const clusterVariant: BadgeVariants['variant'] | undefined =
    props?.clusterVariant ?? (typeof clusterId === 'number' ? getClusterVariant(clusterId) : undefined)

  return (
    <div
      className={cn('group w-full relative bg-neutral-100 rounded-md cursor-pointer outline-none')}
      tabIndex={0}
      data-index={index}
      data-id={id}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onToggle()
      }}
      role='button'
      aria-pressed={isSelected}
    >
      {!compact && typeof clusterId === 'number' && <ClusterRow clusterId={clusterId} clusterVariant={clusterVariant} />}

      {!compact && (
        <Button
          icon={ZoomInIcon}
          className='absolute top-8 z-5 right-8 opacity-0 group-hover:opacity-100'
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
          onClick={onClickZoom}
          aria-label='Open details'
        />
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

function ClusterRow(props: { clusterId: number; clusterVariant: BadgeVariants['variant'] }) {
  const { clusterId, clusterVariant } = props
  return (
    <div className='h-[22px]'>
      <Badge size='xsm' className='h-16 mx-4' variant={clusterVariant} title='Cluster ID'>
        C{clusterId}
      </Badge>
    </div>
  )
}

export const PatchItem = memo(PatchItemImpl)
