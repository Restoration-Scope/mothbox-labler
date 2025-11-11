import { useLayoutEffect, useState } from 'react'
import { getHorizontalPadding } from '~/features/patch-grid/grid-utils'

export function useContainerWidth(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [containerWidth, setContainerWidth] = useState<number>(0)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const width = el.clientWidth
      const padding = getHorizontalPadding(el)
      const available = Math.max(0, width - padding)
      setContainerWidth(available)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  return containerWidth
}

