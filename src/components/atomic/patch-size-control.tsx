import { useStore } from '@nanostores/react'
import { atom } from 'nanostores'
import { cn } from '~/utils/cn'
import { Slider } from '~/components/ui/slider'

export const patchColumnsStore = atom<number>(4)

export function setPatchColumns(value: number) {
  const clamped = Math.max(1, Math.min(12, Math.round(value || 1)))
  patchColumnsStore.set(clamped)
}

export function PatchSizeControl(props: { className?: string }) {
  const { className } = props || {}
  const columns = useStore(patchColumnsStore)

  return (
    <div className={cn(className)}>
      <h3 className='mb-6 text-16 font-semibold'>Grid columns</h3>
      <div className='flex items-center gap-8'>
        <span className='w-36 text-12 text-neutral-600'>{columns} col</span>
        <Slider
          value={[columns]}
          min={1}
          max={12}
          step={1}
          onValueChange={(vals) => {
            const v = vals?.[0]
            if (typeof v === 'number') setPatchColumns(v)
          }}
        />
      </div>
    </div>
  )
}
