import React, { forwardRef } from 'react'
import { cn } from '~/utils/cn'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  style?: any
}

export const Row = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { className, ...rest } = props
  return <div ref={ref} className={cn('flex flex-row', className)} {...rest} />
})

Row.displayName = 'Row'

export const Column = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { className, ...rest } = props
  return <div ref={ref} className={cn('flex flex-col', className)} {...rest} />
})

Column.displayName = 'Column'

export const Grid = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { className, ...rest } = props
  return <div ref={ref} className={cn('grid', className)} {...rest} />
})

Grid.displayName = 'Grid'
