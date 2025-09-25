import { cn } from '~/utils/cn'
import { Icon } from '~/components/atomic/Icon'
import { ChevronDownIcon, ChevronUpIcon, CircleMinusIcon, CirclePlusIcon } from 'lucide-react'
import { Row } from '~/styles'

export type TaxonomyRowProps = {
  rank: 'order' | 'family' | 'genus' | 'species'
  name: string
  count: number
  selected?: boolean
  onSelect: () => void
  withConnector?: boolean
  canToggle?: boolean
  expanded?: boolean
  onToggleExpanded?: () => void
  isFirstChild?: boolean
}

export function TaxonomyRow(props: TaxonomyRowProps) {
  const { rank, name, count, selected, onSelect, withConnector, canToggle, expanded, onToggleExpanded, isFirstChild } = props
  const prefix = rank === 'order' ? 'O' : rank === 'family' ? 'F' : rank === 'genus' ? 'G' : 'S'

  return (
    <div className='relative w-full'>
      {withConnector ? <ConnectorSpan withConnector={withConnector} isFirstChild={isFirstChild} /> : null}

      <Row className='relative w-full flex-1 items-center'>
        <ToggleControl canToggle={canToggle} expanded={expanded} onToggleExpanded={onToggleExpanded} count={count} />

        <ClickableRow selected={selected} onSelect={onSelect} prefix={prefix} name={name} count={count} />
      </Row>
    </div>
  )
}

type ToggleControlProps = { canToggle?: boolean; expanded?: boolean; onToggleExpanded?: () => void; count: number }
function ToggleControl(props: ToggleControlProps) {
  const { canToggle, expanded, onToggleExpanded } = props

  if (!canToggle) return <div className='w-20 h-16'></div>

  return (
    <div
      className='w-20 h-16 flex items-center justify-center cursor-pointer text-neutral-500 hover:text-ink-primary [&>circle]:!opacity-100'
      onClick={(e) => {
        e.stopPropagation()
        if (onToggleExpanded) onToggleExpanded()
      }}
      aria-label={expanded ? 'Collapse' : 'Expand'}
    >
      <Icon icon={expanded ? CircleMinusIcon : CirclePlusIcon} size={14} className='[&>circle]:opacity-40' />
    </div>
  )
}

type ConnectorSpanProps = { withConnector?: boolean; isFirstChild?: boolean }
function ConnectorSpan(props: ConnectorSpanProps) {
  const { withConnector, isFirstChild } = props
  return (
    <span
      className={cn(
        'absolute -left-[14.5px] bottom-1/2 w-[18px] box-border border-l border-ink-300 pointer-events-none',
        isFirstChild ? 'h-[22px]' : 'h-[44px]',
        withConnector ? 'border-b rounded-bl-[12px]' : '',
      )}
    />
  )
}

type ClickableRowProps = { selected?: boolean; onSelect: () => void; prefix: string; name: string; count: number }
function ClickableRow(props: ClickableRowProps) {
  const { selected, onSelect, prefix, name, count } = props

  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-between first:rounded-t-md last:rounded-b-md hover:z-2 relative -mt-1 px-8 py-6 cursor-pointer',
        selected ? 'z-2 bg-brand/15 text-brand hover:bg-brand/20' : 'bg-background text-ink-primary hover:bg-neutral-100',
        'select-none',
      )}
      onClick={onSelect}
    >
      <span className='text-13 font-medium'>
        <span className='mr-6 text-11 text-neutral-500'>{prefix}</span>
        {name}
      </span>
      <span className='text-13 text-neutral-700'>{count}</span>
    </div>
  )
}
