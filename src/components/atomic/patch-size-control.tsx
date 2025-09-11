import { useStore } from '@nanostores/react'
import { atom } from 'nanostores'
import { cn } from '~/utils/cn'
import { Slider } from '~/components/ui/slider'

export const patchSizeStore = atom<number>(240)

export function setPatchSize(value: number) {
  const clamped = Math.max(30, Math.min(800, value || 0))
  patchSizeStore.set(clamped)
}

export function PatchSizeControl(props: { className?: string }) {
  const { className } = props || {}
  const value = useStore(patchSizeStore)

  return (
    <div className={cn(className)}>
      <h3 className='mb-6 text-16 font-semibold'>Patch size</h3>
      <div className='flex items-center gap-8'>
        <span className='w-36 text-12 text-neutral-600'>{Math.round(value)}px</span>
        <Slider
          value={[value]}
          min={30}
          max={800}
          step={10}
          onValueChange={(vals) => {
            const v = vals?.[0]
            if (typeof v === 'number') setPatchSize(v)
          }}
        />
      </div>
    </div>
  )
}
