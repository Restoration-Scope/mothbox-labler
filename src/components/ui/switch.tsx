'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'

import { cn } from '~/utils/cn'
import { VariantProps, cva } from 'class-variance-authority'

const switchVariants = cva(
  cn(
    'peer inline-flex shrink-0 cursor-pointer items-center rounded-full',
    'ring-1 ring-inset ring-inset ring-sageA-6',
    // ' border-2 border-transparent',
    'transition-colors duration-200 ease-in-out',
    'hover:ring-black/10',
    // 'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'data-[state=unchecked]:bg-sageA-3 data-[state=checked]:bg-highlight ',
    'dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900 dark:data-[state=unchecked]:bg-slate-700 dark:data-[state=checked]:bg-slate-400',
    '',
  ),
  {
    variants: {
      size: {
        sm: 'h-14 w-24 p-2',
        md: 'h-20 w-[38px] p-[3px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

const thumbVariants = cva(
  cn(
    'pointer-events-none relative inline-block border border-transparent rounded-full bg-white shadow ring-1 ring-sageA-6 transition-transform data-[state=unchecked]:translate-x-0',
    '',
  ),

  {
    variants: {
      size: {
        sm: 'h-[9px] w-[9px] data-[state=unchecked]:translate-x-1 data-[state=checked]:translate-x-10',
        md: 'h-[14px] w-[14px] data-[state=checked]:translate-x-[18px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export type SwitchSize = 'sm' | 'md' | 'lg'
export type SwitchVariants = VariantProps<typeof switchVariants>

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>, SwitchVariants {}

const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitives.Root>, SwitchProps>(
  ({ className, size, ...props }, ref) => (
    <SwitchPrimitives.Root
      className={cn(
        switchVariants({ size }),

        className,
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb className={cn(thumbVariants({ size }))} />
    </SwitchPrimitives.Root>
  ),
)
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
