'use client'

import { Slot } from '@radix-ui/react-slot'
import { VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { LucideIcon } from 'lucide-react'
import { isValidElement } from 'react'
import { ActiveLink, ActiveMatchTypes } from '~/components/atomic/ActiveLink'
import { Icon } from '~/components/atomic/Icon'
import { Loader } from '~/components/atomic/Loader'
import { cn } from '~/utils/cn'

const classes = cn(
  'inline-flex items-center justify-center rounded-md text-sm leading-[1.1] font-medium text-ellipsis cursor-pointer',
  'focus-visible:outline-none outline-none ',
  // 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background ',
  'disabled:opacity-60 disabled:pointer-events-none',
)

const buttonVariants = cva(classes, {
  variants: {
    variant: {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/70 shadow ring-1 ring-inset ring-black/10',
      secondary: cn(
        'bg-white text-ink-primary shadow ring-1 ring-sageA-4',
        'hover:bg-sage-3 hover:ring-sageA-6',
        'active:bg-sage-4',
        'data-[state=open]:bg-sage-3 data-[state=open]:ring-sageA-6',
      ),
      outline: 'border border-input hover:bg-accent hover:text-accent-foreground',

      ghost: 'hover:bg-inka-100 hover:text-accent-foreground group-[.active]:bg-inka-100 data-[state=open]:bg-muted dark:hover:bg-white/10',
      ghostMuted:
        'hover:bg-inka-100 text-ink-secondary hover:text-accent-foreground group-[.active]:bg-inka-100 data-[state=open]:bg-muted data-[state=open]:text-ink-primary dark:bg-black/10',
      ghostDestructive: 'hover:bg-red-100 hover:text-red-500 active:bg-red-200 data-[state=open]:bg-muted',
      ghostOnImage: cn(
        'text-white bg-white/10 backdrop-blur-sm',
        'hover:bg-white/20 hover:backdrop-blur-md',
        'transition-all duration-200',
      ),
      destructive:
        'bg-destructive text-destructive-foreground hover:bg-destructive/80 active:bg-destructive/60 shadow ring-1 ring-inset ring-black/10',
      link: 'underline-offset-4 hover:underline text-primary',
      table: 'bg-sage-3 !text-13 text-ink-primary hover:bg-sage-5 active:bg-accent-foreground/10 ring-1 ring-black/10',
      pill: 'rounded bg-bkg-3 pl-[5px] pr-6 py-[3px] !text-13 font-medium ',
      raw: '',
    },
    size: {
      default: 'h-40 py-8 px-16',
      md: 'h-32 py-6 px-12',
      sm: 'h-32 px-12 rounded-md',
      xsm: 'h-28 px-8 rounded-md',
      xxsm: 'h-24 px-6 rounded-md',
      lg: 'h-[44px] px-32 rounded-md',
      icon: 'h-36 w-36 shrink-0 ',
      'icon-sm': 'h-28 w-28 shrink-0 ',
      'icon-md': 'h-32 w-32 shrink-0 ',
      inline: 'px-8 py-4 -mx-8 -my-4',
      'inline-md': 'px-12 py-8 -mx-12 -my-8',
      auto: '',
    },
    tint: {
      blue: 'hover:!bg-blue-200 bg-blue-100 !text-blue-600',
      default: '',
    },
  },
  compoundVariants: [
    {
      variant: 'ghost',
      size: 'xsm',
      class: 'p-8',
    },
    {
      variant: 'table',
      size: 'default',
      class: 'h-auto px-6 py-4 rounded',
    },
    {
      variant: 'pill',
      size: 'default',
      class: ' ',
    },
    {
      variant: 'secondary',
      size: 'xxsm',
      class: '!text-13',
    },
  ],
  defaultVariants: {
    variant: 'secondary',
    size: 'xsm',
  },
})

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'link' | 'table' | 'ghost' | 'ghostDestructive' | 'raw'

export type ButtonVariants = VariantProps<typeof buttonVariants>

export interface BaseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariants {
  asChild?: boolean
}

export const BaseButton = React.forwardRef<HTMLButtonElement, BaseButtonProps>(
  ({ className, variant, size, tint, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn('ui-button', buttonVariants({ variant, size, tint, className }))} ref={ref} {...props} />
  },
)
BaseButton.displayName = 'BaseButton'

export interface BasePressableProps extends React.HTMLAttributes<HTMLDivElement>, ButtonVariants {
  asChild?: boolean
}
export const Pressable = React.forwardRef<HTMLDivElement, BasePressableProps>(
  ({ className, variant = 'ghost', size, tint, asChild = false, ...props }, ref) => {
    return <div className={cn(buttonVariants({ variant, size, tint, className }), '-mx-8')} ref={ref} {...props} />
  },
)
Pressable.displayName = 'Pressable'

// Custom part
export type ButtonProps = BaseButtonProps & {
  to?: string
  icon?: LucideIcon | string
  iconRight?: any
  submitting?: boolean
  iconSize?: number
  activeMatch?: ActiveMatchTypes
  iconClasses?: string
  linkClasses?: string

  openInNewTab?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const {
    children,
    to,
    icon,
    iconRight,
    iconClasses,
    iconSize = 16,
    className,
    submitting,
    activeMatch,
    openInNewTab,
    linkClasses,
    ...rest
  } = props

  const button = (
    <BaseButton ref={ref} className={cn('', className)} {...rest}>
      {!icon ? null : isValidElement(icon) ? (
        icon
      ) : (
        <Icon icon={icon} size={iconSize} className={cn(children && 'mr-8 opacity-70', iconClasses)} />
      )}
      {children}
      {!iconRight ? null : isValidElement(iconRight) ? (
        iconRight
      ) : (
        <Icon icon={iconRight} size={iconSize} className={cn(children && 'ml-8 opacity-50', iconClasses)} />
      )}

      {submitting && <Loader onDark={props.variant === 'primary' ? true : false} className='ml-8' size={16} />}
    </BaseButton>
  )

  if (to) {
    return (
      <ActiveLink activeMatch={activeMatch} href={to} target={openInNewTab ? '_blank' : undefined} className={linkClasses}>
        {button}
      </ActiveLink>
    )
  } else return button
})

Button.displayName = 'Button'

export { Button }
