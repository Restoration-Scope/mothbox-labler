'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '~/utils/cn'

const TooltipProvider = TooltipPrimitive.Provider
const TooltipPortal = TooltipPrimitive.Portal

const Tooltip = ({ ...props }) => <TooltipPrimitive.Root {...props} />
Tooltip.displayName = TooltipPrimitive.Tooltip.displayName

const TooltipTrigger = TooltipPrimitive.Trigger

interface Props extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  dark?: boolean
  noAnimations?: boolean
}

export const getTooltipContentClasses = (dark?: boolean, noAnimations?: boolean) =>
  cn(
    'z-[100] overflow-hidden rounded px-6 py-2 !text-13 text-ink-secondary  ',
    'border-[0.5px] bg-white shadow',

    !noAnimations &&
      'animate-in fade-in-50 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
    dark && 'border-neutral-800 bg-neutral-900 text-white/90',
    'animate',
  )

const TooltipContent = React.forwardRef<React.ElementRef<typeof TooltipPrimitive.Content>, Props>(
  ({ className, dark, sideOffset = 2, noAnimations, ...props }, ref) => (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(getTooltipContentClasses(dark, noAnimations), className)}
      {...props}
    />
  ),
)
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipPortal }
