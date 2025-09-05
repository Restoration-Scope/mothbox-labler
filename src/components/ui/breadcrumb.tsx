'use client'
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '~/utils/cn'
import { Fragment } from 'react'
import { Icon } from '~/components/atomic/Icon'
import { Button } from '~/components/ui/button'
import classed from '~/styles/classed'

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'> & {
    separator?: React.ReactNode
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label='breadcrumb' {...props} />)
Breadcrumb.displayName = 'Breadcrumb'

const BreadcrumbList = React.forwardRef<HTMLOListElement, React.ComponentPropsWithoutRef<'ol'>>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn('flex flex-wrap items-center gap-4 break-words text-sm text-ink-secondary dark:text-white/70 sm:gap-4', className)}
    {...props}
  />
))
BreadcrumbList.displayName = 'BreadcrumbList'

const BreadcrumbItem = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<'li'>>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('inline-flex items-center gap-x-6', className)} {...props} />
))
BreadcrumbItem.displayName = 'BreadcrumbItem'

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & {
    asChild?: boolean
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : 'a'

  return <Comp ref={ref} className={cn('transition-colors hover:text-foreground', className)} {...props} />
})
BreadcrumbLink.displayName = 'BreadcrumbLink'

const BreadcrumbPage = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<'span'>>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role='link'
    aria-disabled='true'
    aria-current='page'
    className={cn('relative font-normal text-foreground', className)}
    {...props}
  />
))
BreadcrumbPage.displayName = 'BreadcrumbPage'

const BreadcrumbSeparator = ({ children, className, ...props }: React.ComponentProps<'li'>) => (
  <li role='presentation' aria-hidden='true' className={cn('[&>svg]:size-[14px]', className)} {...props}>
    {children ?? <ChevronRight size={14} />}
  </li>
)
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator'

const BreadcrumbEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span role='presentation' aria-hidden='true' className={cn('flex h-[36px] w-[36px] items-center justify-center', className)} {...props}>
    <MoreHorizontal className='h-16 w-16' />
    <span className='sr-only'>More</span>
  </span>
)
BreadcrumbEllipsis.displayName = 'BreadcrumbElipssis'

export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis }

export type BreadcrumbItem = {
  href?: string
  label: string
  icon?: LucideIcon
  entityName?: string
}

type BreadcrumbsProps = {
  breadcrumbs: BreadcrumbItem[]
  className?: string
  dark?: boolean
}

export function Breadcrumbs(props: BreadcrumbsProps) {
  const { breadcrumbs, className, dark } = props
  if (!breadcrumbs?.length) return null

  return (
    <Breadcrumb className={cn(dark && 'dark', className)}>
      <BreadcrumbList>
        {breadcrumbs.map((item, index) => (
          <Fragment key={index}>
            {index < breadcrumbs.length - 1 && item.href ? (
              <BreadcrumbItem className='relative'>
                {item.entityName && <EntityTypeLabel>{item.entityName}</EntityTypeLabel>}
                <Button
                  variant='ghost'
                  className='-mx-8 gap-x-4 leading-[1.2]'
                  size='xsm'
                  to={item.href}
                  linkClasses='inline-flex items-center'
                >
                  {item.icon && <Icon icon={item.icon} className='size-4' />}
                  <span className='relative top-[0.5px] min-w-0 truncate'>{item.label}</span>
                </Button>
              </BreadcrumbItem>
            ) : (
              <BreadcrumbItem className='relative'>
                {item.entityName && <EntityTypeLabel>{item.entityName}</EntityTypeLabel>}
                <BreadcrumbPage className='col h-28 justify-center'>{item.label}</BreadcrumbPage>
              </BreadcrumbItem>
            )}
            {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

const EntityTypeLabel = classed('span', 'absolute -top-[9px] left-0 text-12 opacity-80 pointer-events-none whitespace-nowrap')
