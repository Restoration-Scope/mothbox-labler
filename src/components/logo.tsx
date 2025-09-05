import { LogoIcon } from '~/components/logo-icon'

import { Row } from '~/styles'
import { cn } from '~/utils/cn'

type Props = {
  color?: string
  className?: string
  iconClassName?: string
  size?: number
}

export function Logo(props: Props) {
  const { color, className, iconClassName, size = 28 } = props

  return (
    <Row className={cn('row center gap-x-6', className)}>
      <LogoIcon size={size} className={iconClassName} color={color} />
      <div style={{ fontSize: size - 4 }} className={cn('text-16 font-[700] tracking-tight')}>
        MothBox Labeler
      </div>
    </Row>
  )
}
