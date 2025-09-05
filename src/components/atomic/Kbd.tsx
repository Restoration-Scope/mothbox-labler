import React, { PropsWithChildren } from 'react'
import { Row } from '~/styles'
import { cn } from '~/utils/cn'

type Props = PropsWithChildren<{ className?: string; dark?: boolean }>

export function Kbd(props: Props) {
  const { children, className, dark } = props

  return (
    <kbd
      className={cn(
        'h-22 min-w-[18px] rounded-sm border border-b-2 border-secondary-foreground/10 bg-secondary px-[6px] text-center font-mono text-[10px] font-medium text-ink-600',
        dark && 'border-white/10 bg-white/20 text-white/60',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

function isMacOS() {
  if (typeof window === 'undefined') return false
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent)
}

function getKeySymbol(key: string): string {
  const isMac = isMacOS()

  const keyMap: Record<string, string> = {
    meta: isMac ? '⌘' : 'Ctrl',
    enter: '↵',
    escape: 'Esc',
    backspace: '⌫',
    delete: '⌦',
    arrowLeft: '←',
    arrowRight: '→',
    arrowUp: '↑',
    arrowDown: '↓',
    tab: '⇥',
    shift: isMac ? '⇧' : 'Shift',
    alt: isMac ? '⌥' : 'Alt',
    ctrl: isMac ? '⌃' : 'Ctrl',
  }

  return keyMap[key] || key
}

export function KeyShortcuts(props: { keys: string[]; plain?: boolean }) {
  const { keys, plain } = props

  if (plain) {
    return <span className='font-mono text-12'>{keys.map((key) => getKeySymbol(key)).join('+')}</span>
  }

  return (
    <Row className='items-center gap-x-4'>
      {keys.map((key, index) => (
        <Kbd key={`${key}-${index}`}>{getKeySymbol(key)}</Kbd>
      ))}
    </Row>
  )
}
