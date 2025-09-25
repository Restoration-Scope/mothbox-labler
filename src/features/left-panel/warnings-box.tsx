import { cn } from '~/utils/cn'
import type { NightWarnings } from './left-panel.types'

type WarningsBoxProps = { warnings?: NightWarnings; className?: string }

export function WarningsBox(props: WarningsBoxProps) {
  const { warnings, className } = props
  const jsonWithoutPhoto = warnings?.jsonWithoutPhotoCount ?? 0
  const missingPatchImages = warnings?.missingPatchImageCount ?? 0

  const hasAny = jsonWithoutPhoto > 0 || missingPatchImages > 0
  if (!hasAny) return null

  return (
    <div className={cn('rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-12', className)}>
      <div className='text-14 font-semibold mb-6'>⚠️ Data warnings</div>
      <div className='space-y-4 text-13'>
        {jsonWithoutPhoto > 0 ? (
          <div className='flex items-center justify-between'>
            <span>JSON files without a matching photo image</span>
            <span className='font-medium'>{jsonWithoutPhoto}</span>
          </div>
        ) : null}
        {missingPatchImages > 0 ? (
          <div className='flex items-center justify-between'>
            <span>Detections referencing missing patch images</span>
            <span className='font-medium'>{missingPatchImages}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
