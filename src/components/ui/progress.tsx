'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'

import { cn } from '~/utils/cn'

type ProgressColor = 'blue' | 'primary'

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  color?: ProgressColor
}

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, color = 'blue', ...props }, ref) => (
    <ProgressPrimitive.Root ref={ref} className={cn('relative h-4 w-full overflow-hidden rounded-full bg-ink-200', className)} {...props}>
      <ProgressPrimitive.Indicator
        className={cn('h-full w-full flex-1 transition-all', color === 'blue' ? 'bg-blue-500' : 'bg-brand')}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  ),
)
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
