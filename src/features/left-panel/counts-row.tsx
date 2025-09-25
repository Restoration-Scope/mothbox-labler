import { cn } from '~/utils/cn'

export type CountsRowProps = {
  label: string
  count: number
  selected?: boolean
  onSelect: () => void
}

export function CountsRow(props: CountsRowProps) {
  const { label, count, selected, onSelect } = props

  return (
    <div
      className={cn(
        'flex items-center justify-between first:rounded-t-md last:rounded-b-md hover:z-2 relative -mt-1 px-8 py-6 cursor-pointer ring-1 ring-inset',
        selected
          ? 'z-2 bg-brand/20 text-brand ring-brand/20 hover:bg-brand/20 hover:ring-brand/20'
          : 'bg-background text-ink-primary ring-[rgba(0,0,0,0.1)] hover:bg-neutral-100',
      )}
      onClick={onSelect}
    >
      <span className='text-13 font-medium'>{label}</span>
      <span className='text-13 text-neutral-700'>{count}</span>
    </div>
  )
}
