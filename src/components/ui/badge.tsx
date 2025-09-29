import * as React from 'react'
import { VariantProps, cva } from 'class-variance-authority'
import chroma from 'chroma-js'
import { cn } from '~/utils/cn'
import { Icon } from '~/components/atomic/Icon'
import { LucideIcon } from 'lucide-react'

const badgeVariants = cva('inline-flex items-center grow-0 rounded-sm font-medium ring-1 ring-inset ring-[rgba(0,0,0,0.03)]', {
  variants: {
    variant: {
      default: 'bg-background !text-ink-primary ring-[rgba(0,0,0,0.1)]',

      secondary: 'bg-secondary text-secondary-foreground',
      destructive: 'bg-destructive text-destructive-foreground',
      outline: 'text-foreground ring-1 ring-inset ring-black/10',

      warn: 'bg-amber-100 !text-amber-700 ring-amber-200',
      error: 'bg-red-100 !text-red-700 ring-red-200',

      red: 'bg-red-100 !text-red-700 ring-red-200',
      orange: 'bg-orange-100 !text-orange-700 ring-orange-200',
      amber: 'bg-amber-100 !text-amber-700 ring-amber-200',
      yellow: 'bg-yellow-100 !text-yellow-700 ring-yellow-200',
      lime: 'bg-lime-100 !text-lime-700 ring-lime-200',
      green: 'bg-green-100 !text-green-700 ring-green-200',
      brand: 'bg-brand/20 text-brand ring-brand/20',
      emerald: 'bg-emerald-100 !text-emerald-700 ring-emerald-200',
      teal: 'bg-teal-100 !text-teal-700 ring-teal-200',
      cyan: 'bg-cyan-100 !text-cyan-700 ring-cyan-200',
      sky: 'bg-sky-100 !text-sky-700 ring-sky-200',
      blue: 'bg-blue-100 !text-blue-700 ring-blue-200',
      indigo: 'bg-indigo-100 !text-indigo-700 ring-indigo-200',
      violet: 'bg-violet-100 !text-violet-700 ring-violet-200',
      purple: 'bg-purple-100 !text-purple-700 ring-purple-200',
      fuchsia: 'bg-fuchsia-100 !text-fuchsia-700 ring-fuchsia-200',
      pink: 'bg-pink-100 !text-pink-700 ring-pink-200',
      rose: 'bg-rose-100 !text-rose-700 ring-rose-200',
      gray: 'bg-sageA-4 !text-ink-primary',
    },
    size: {
      default: 'px-6 py-[3px] text-13',
      xsm: 'px-[3px] h-[14px] !text-[10px]',
      sm: 'px-[5px] py-1 text-13',
      md: 'px-8 py-4 text-14 rounded-md',
      lg: 'px-12 py-12 text-14 rounded-lg',
      inline: 'px-8 py-4 text-13 -my-4',
      iconOnly: 'p-4',
    },
  },
  compoundVariants: [
    { size: 'default', className: '[&>svg]:ml-[-2px] [&>svg]:mr-4' },
    { size: 'xsm', className: '[&>svg]:ml-[-2px] [&>svg]:mr-0' },
    { size: 'sm', className: '[&>svg]:ml-[-2px] [&>svg]:mr-2' },
    { size: 'md', className: '[&>svg]:mr-6' },
    { size: 'lg', className: '[&>svg]:mr-8' },
    { size: 'inline', className: '' },
    { size: 'iconOnly', className: '[&>svg]:m-0' },
  ],
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

export type BadgeVariants = VariantProps<typeof badgeVariants>

type VariantKeys = keyof BadgeVariants['variant']

function getColorStyle(color: string, existingStyle?: React.CSSProperties): React.CSSProperties {
  const baseColor = chroma(color)
  const textColor = baseColor.darken(2).hex() // Darken the color significantly for better contrast
  const backgroundColor = baseColor.alpha(0.12).css() // ~12% opacity
  const borderColor = baseColor.alpha(0.3).css() // ~30% opacity

  return {
    backgroundColor,
    color: textColor,
    borderColor,
    ...existingStyle,
  } as React.CSSProperties
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, BadgeVariants {
  icon?: LucideIcon | any
  color?: string
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size = 'default', children, icon, color, style, ...rest }, ref) => {
    const finalSize = !children && icon ? 'iconOnly' : size
    const colorStyle = color ? getColorStyle(color, style) : style

    return (
      <div ref={ref} className={cn(badgeVariants({ variant, size: finalSize }), className)} style={colorStyle} {...rest}>
        {icon && <Icon icon={icon} size={size === 'sm' ? 14 : 16} />}
        {children}
      </div>
    )
  },
)

Badge.displayName = 'Badge'

export { Badge }

type VariantOptions =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose'
  | 'gray'

export interface MappedBadgeProps extends Omit<BadgeProps, 'variant'> {
  variantMap: Record<string, VariantOptions>
  value: string
}

export function MappedBadge({ variantMap, value, ...rest }: MappedBadgeProps) {
  const variant = variantMap[value] || 'default'
  return (
    <Badge variant={variant} {...rest}>
      {value}
    </Badge>
  )
}
