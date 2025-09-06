'use client'
import { Loader } from '~/components/atomic/Loader'
import { cn } from '~/utils/cn'

type Props = {
  className?: string
  children?: React.ReactNode
  onDark?: boolean
}

export const CenteredLoader = (props: Props) => {
  const { className, children, onDark, ...rest } = props
  return (
    <div className={`center relative flex h-[30vh] w-full ${className}`} {...rest}>
      {children ? (
        <div className='center flex-col'>
          <Loader onDark={onDark} />
          <div className={cn('mt-20 text-center text-14 font-medium', onDark && 'text-white')}>{children}...</div>
        </div>
      ) : (
        <Loader onDark={onDark} />
      )}
    </div>
  )
}
