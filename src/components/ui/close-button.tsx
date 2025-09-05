import { X } from 'lucide-react'
import React from 'react'
import { Button } from '~/components/ui/button'

type Props = {
  onClick?: () => void
}

export const CloseButton = React.forwardRef((props: Props, ref) => {
  const { onClick, ...rest } = props

  return (
    <Button
      ref={ref}
      variant='ghost'
      size='icon'
      className='absolute right-4 top-4 z-[20] text-ink-secondary'
      onClick={onClick as any}
      {...(rest as any)}
    >
      <X className='h-16 w-16' />
      <span className='sr-only'>Close</span>
    </Button>
  )
})

CloseButton.displayName = 'CloseButton'
