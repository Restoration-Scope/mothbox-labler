import { useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { KeyShortcuts } from '~/components/atomic/Kbd'
import { Button } from '~/components/ui/button'
import { cn } from '~/utils/cn'

export type SelectionBarProps = {
  selectedCount: number
  onIdentify: () => void
  onAccept: () => void
  onUnselect: () => void
  onSelectAll: () => void
  onResetToAuto?: () => void
  className?: string
}

export function SelectionBar(props: SelectionBarProps) {
  const { selectedCount, onIdentify, onAccept, onUnselect, onSelectAll, onResetToAuto, className } = props

  const hasSelection = selectedCount > 0
  const label = useMemo(() => `${selectedCount} selected`, [selectedCount])

  useHotkeys(
    'd',
    (e) => {
      e.preventDefault()
      if (hasSelection) onIdentify()
    },
    {},
    [hasSelection, onIdentify],
  )

  useHotkeys(
    'a',
    (e) => {
      e.preventDefault()
      if (hasSelection) onAccept()
    },
    {},
    [hasSelection, onAccept],
  )

  useHotkeys(
    'u',
    (e) => {
      e.preventDefault()
      if (hasSelection) onUnselect()
    },
    {},
    [hasSelection, onUnselect],
  )

  useHotkeys(
    'shift+a',
    (e) => {
      e.preventDefault()
      onSelectAll()
    },
    {},
    [onSelectAll],
  )

  if (!hasSelection) return null

  return (
    <div
      className={cn(
        'fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-white/95 px-16 py-12 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/70',
        className,
      )}
    >
      <div className='flex items-center gap-x-12'>
        <div className='text-13 text-neutral-700'>{label}</div>
        <div className='h-16 w-px bg-neutral-200' />
        <ActionButton label='Identify' keys={['d']} onClick={onIdentify} />
        <ActionButton label='Accept' keys={['a']} onClick={onAccept} />
        <ActionButton label='Unselect' keys={['u']} onClick={onUnselect} />
        <ActionButton label='Select All' keys={['shift', 'a']} onClick={onSelectAll} />
        {onResetToAuto ? <ActionButton label='Reset' onClick={onResetToAuto} /> : null}
      </div>
    </div>
  )
}

type ActionButtonProps = { label: string; keys?: string[]; onClick: () => void }

function ActionButton(props: ActionButtonProps) {
  const { label, keys, onClick } = props
  return (
    <Button size='sm' variant='outline' className='flex items-center gap-x-8' onClick={onClick}>
      <span>{label}</span>
      {keys && keys.length > 0 ? <KeyShortcuts keys={keys} /> : null}
    </Button>
  )
}
