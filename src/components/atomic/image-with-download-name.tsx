import type { ImgHTMLAttributes } from 'react'
import { cn } from '~/utils/cn'

export type ImageWithDownloadNameProps = {
  src?: string | null
  alt: string
  downloadName?: string | null
  className?: string
  fallback?: React.ReactNode
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'className'>

export function ImageWithDownloadName(props: ImageWithDownloadNameProps) {
  const { src, alt, downloadName, className, fallback, ...imgProps } = props

  if (!src) {
    return fallback ? <>{fallback}</> : null
  }

  const downloadFilename = downloadName ? `${downloadName}.jpg` : undefined

  return (
    <a href={src} download={downloadFilename} onClick={(e) => e.preventDefault()} className='block'>
      <img src={src} alt={alt} className={cn(className)} {...imgProps} />
    </a>
  )
}

