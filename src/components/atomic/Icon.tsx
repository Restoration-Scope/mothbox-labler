import type { LucideIcon } from 'lucide-react'
import { Icon as LucideIconComponent } from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'

import { cn } from '~/utils/cn'

export type IconType = LucideIcon | string

export type Props = {
  icon: IconType
  size?: number
  className?: string
  style?: any
  ref?: React.RefObject<SVGSVGElement>
}

export function Icon(props: Props) {
  const { icon, className, size = 16, style, ref } = props

  const sharedProps: any = {
    style: { width: size, height: size, ...style },
    className: cn('icon shrink-0', className),
    ref,
  }

  const CustomIcon = typeof icon === 'string' && customIcons[icon]
  let Icon: any = null
  if (typeof icon === 'string' && !CustomIcon) {
    Icon = DynamicIcon
    sharedProps.name = icon || 'x'
  } else {
    Icon = icon
  }

  if (Array.isArray(icon)) {
    return <LucideIconComponent iconNode={icon as any} {...sharedProps} />
  }

  return CustomIcon ? (
    <SvgIcon {...sharedProps}>
      <CustomIcon />
    </SvgIcon>
  ) : (
    <Icon {...sharedProps} />
  )
}

const customIcons = {
  female: FemaleIcon,
  drone: DroneIcon,
}

function SvgIcon({ ...rest }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      strokeWidth='2'
      stroke='currentColor'
      strokeLinecap='round'
      fill='none'
      strokeLinejoin='round'
      {...rest}
    />
  )
}

function FemaleIcon() {
  return (
    <>
      <path d='M12 14C15.3137 14 18 11.3137 18 8C18 4.68629 15.3137 2 12 2C8.68629 2 6 4.68629 6 8C6 11.3137 8.68629 14 12 14Z' />
      <path d='M12 14L12 22' />
      <path d='M16 18H8' />
    </>
  )
}

function DroneIcon() {
  return (
    <>
      <path
        d='M3.9844 8.61711C3.43514 8.25011 3.00704 7.72847 2.75424 7.11816C2.50145 6.50786 2.4353 5.8363 2.56418 5.1884C2.69305 4.5405 3.01116 3.94537 3.47826 3.47826C3.94537 3.01116 4.5405 2.69305 5.1884 2.56418C5.8363 2.4353 6.50786 2.50145 7.11816 2.75424C7.72847 3.00704 8.25011 3.43514 8.61711 3.9844'
        strokeWidth='2'
        strokeMiterlimit='10'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M20.0156 8.61711C20.5649 8.25011 20.993 7.72847 21.2458 7.11816C21.4986 6.50786 21.5647 5.8363 21.4358 5.1884C21.3069 4.5405 20.9888 3.94537 20.5217 3.47826C20.0546 3.01116 19.4595 2.69305 18.8116 2.56418C18.1637 2.4353 17.4921 2.50145 16.8818 2.75424C16.2715 3.00704 15.7499 3.43514 15.3829 3.9844'
        strokeWidth='2'
        strokeMiterlimit='10'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M3.4844 15.3829C2.93514 15.7499 2.50704 16.2715 2.25424 16.8818C2.00145 17.4921 1.9353 18.1637 2.06418 18.8116C2.19305 19.4595 2.51116 20.0546 2.97826 20.5217C3.44537 20.9888 4.0405 21.3069 4.6884 21.4358C5.3363 21.5647 6.00786 21.4986 6.61816 21.2458C7.22847 20.993 7.75011 20.5649 8.11711 20.0156'
        strokeWidth='2'
        strokeMiterlimit='10'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M20.0156 15.3829C20.5649 15.7499 20.993 16.2715 21.2458 16.8818C21.4986 17.4921 21.5647 18.1637 21.4358 18.8116C21.3069 19.4595 20.9888 20.0546 20.5217 20.5217C20.0546 20.9888 19.4595 21.3069 18.8116 21.4358C18.1637 21.5647 17.4921 21.4986 16.8818 21.2458C16.2715 20.993 15.7499 20.5649 15.3829 20.0156'
        strokeWidth='2'
        strokeMiterlimit='10'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path d='M9 9L6 6' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
      <path d='M15 9L18 6' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
      <path d='M8.5 15L5.5 18' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
      <path d='M15 15L18 18' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
      <rect x='9' y='7' width='6' height='10' rx='3' strokeWidth='2' />
    </>
  )
}
