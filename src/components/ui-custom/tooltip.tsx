import React from 'react'
import { Tooltip as BaseTooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '~/components/ui/tooltip'

import { Column, Row } from '~/styles'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { Kbd } from '~/components/atomic/Kbd'

interface Props extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  content: any
  children: any
  dark?: boolean
  asChild?: boolean
  delay?: number
  disableHoverableContent?: boolean
  className?: string
  ref?: any
}

export function Tooltip(props: Props) {
  const { content, children, asChild = true, dark, delay, disableHoverableContent, className, ref, ...rest } = props

  return (
    <BaseTooltip delayDuration={delay} disableHoverableContent={disableHoverableContent}>
      <TooltipTrigger asChild={asChild} ref={ref}>
        {children}
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent dark={dark} className={className} {...rest}>
          {content}
        </TooltipContent>
      </TooltipPortal>
    </BaseTooltip>
  )
}

// Add this new component
export function TooltipWithHotkey({ content, hotkey, children }) {
  return (
    <Tooltip
      className='pr-2'
      content={
        <Row className='items-center gap-x-8'>
          {content} <Kbd>{hotkey}</Kbd>
        </Row>
      }
    >
      {children}
    </Tooltip>
  )
}
