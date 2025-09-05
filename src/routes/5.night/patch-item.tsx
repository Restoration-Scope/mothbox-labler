import { memo, useMemo } from 'react'
import { useStore } from '@nanostores/react'
import { detectionStoreById } from '~/stores/entities/detections'
import { patchStoreById } from '~/stores/entities/patch-selectors'
import { Badge } from '~/components/ui/badge'
import { selectedPatchIdsStore, togglePatchSelection } from '~/stores/ui'
import { cn } from '~/utils/cn'

export type PatchItemProps = { id: string; index?: number }

function PatchItemImpl(props: PatchItemProps) {
  const { id, index } = props
  const patch = useStore(patchStoreById(id))
  const detection = useStore(detectionStoreById(id))
  const selected = useStore(selectedPatchIdsStore)
  const label = detection?.label || 'Unlabeled'
  const isSelected = selected?.has?.(id)

  const url = useMemo(() => (patch?.imageFile ? URL.createObjectURL(patch.imageFile.file) : ''), [patch?.imageFile])

  function onToggle() {
    if (!id) return
    togglePatchSelection({ patchId: id })
  }

  return (
    <div
      className={cn(
        'w-full bg-neutral-100 border border-black/10 rounded-md cursor-pointer outline-none',
        'hover:border-primary/40',
        isSelected ? 'ring-2 ring-primary bg-brand/20' : '',
      )}
      tabIndex={0}
      data-index={index}
      data-id={id}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onToggle()
      }}
      role='button'
      aria-pressed={isSelected}
    >
      {url ? (
        <img
          src={url}
          alt={patch?.name ?? 'patch'}
          className='aspect-square w-full object-contain rounded-t-[5px]'
          onLoad={() => URL.revokeObjectURL(url)}
        />
      ) : (
        <div className='aspect-square w-full ' />
      )}
      <div className='h-28 w-full px-6 flex items-center justify-between'>
        <Badge size='sm'>{label}</Badge>
      </div>
    </div>
  )
}

export const PatchItem = memo(PatchItemImpl)
