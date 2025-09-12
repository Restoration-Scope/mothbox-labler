import { memo } from 'react'
import { useStore } from '@nanostores/react'
import { detectionStoreById } from '~/stores/entities/detections'
import { patchStoreById } from '~/stores/entities/patch-selectors'
import { Badge } from '~/components/ui/badge'
import { selectedPatchIdsStore, togglePatchSelection } from '~/stores/ui'
import { cn } from '~/utils/cn'
import { useObjectUrl } from '~/utils/use-object-url'
import { Button } from '~/components/ui/button'
import { ZoomInIcon } from 'lucide-react'

export type PatchItemProps = {
  id: string
  index?: number
  onOpenDetail?: (id: string) => void
  onImageLoad?: (id: string) => void
  onImageError?: (id: string) => void
  compact?: boolean
}

function PatchItemImpl(props: PatchItemProps) {
  const { id, index, compact } = props
  const patch = useStore(patchStoreById(id))
  const detection = useStore(detectionStoreById(id))
  const selected = useStore(selectedPatchIdsStore)
  const label = detection?.label || 'Unlabeled'
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
          'hover:ring-black/40 hover:ring-[1.5px]',
          isSelected && 'ring-2 hover:ring-2 hover:ring-black ring-brand',
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

      {!compact && (
        <div className='h-28 w-full px-6 flex items-center justify-between'>
          <Badge size='sm'>{label}</Badge>
        </div>
      )}
    </div>
  )
}

export const PatchItem = memo(PatchItemImpl)
