import { Column } from '~/styles'
import { cn } from '~/utils/cn'
import { Progress } from '~/components/ui/progress'
import { clearPatchSelection } from '~/stores/ui'
import { Button } from '~/components/ui/button'
import { useParams } from '@tanstack/react-router'
import { useStore } from '@nanostores/react'
import { detectionsStore } from '~/stores/entities/detections'
import { exportNightDarwinCSV } from '~/features/export/darwin-csv'
import { toast } from 'sonner'

type NightWarnings = {
  jsonWithoutPhotoCount?: number
  missingPatchImageCount?: number
}

export type NightLeftPanelProps = {
  labelCounts: Record<string, number>
  identifiedLabelCounts?: Record<string, number>
  totalPatches: number
  totalDetections: number
  totalIdentified?: number
  selectedLabel?: string
  selectedBucket?: 'auto' | 'user'
  onSelectLabel: (params: { label?: string; bucket: 'auto' | 'user' }) => void
  warnings?: NightWarnings
  className?: string
}

export function NightLeftPanel(props: NightLeftPanelProps) {
  const {
    labelCounts,
    identifiedLabelCounts,
    totalPatches,
    totalDetections,
    totalIdentified = 0,
    selectedLabel,
    selectedBucket,
    onSelectLabel,
    warnings,
    className,
  } = props

  const params = useParams({ from: '/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId' })
  const nightId = `${params.projectId}/${params.siteId}/${params.deploymentId}/${params.nightId}`
  const detections = useStore(detectionsStore)
  const totalForNight = Object.values(detections ?? {}).filter((d) => (d as any)?.nightId === nightId).length
  const totalIdentifiedForNight = Object.values(detections ?? {}).filter(
    (d) => (d as any)?.nightId === nightId && (d as any)?.detectedBy === 'user',
  ).length
  const canExport = totalForNight > 0 && totalIdentifiedForNight === totalForNight

  return (
    <Column className={cn('p-20 pt-12', className)}>
      <WarningsBox warnings={warnings} className='mb-16' />
      <div className='mb-16'>
        <h3 className='mb-6 text-16 font-semibold'>Summary</h3>
        <div className='space-y-4 text-13 text-neutral-700'>
          <div className='flex items-center justify-between'>
            <span>Total patches</span>
            <span className='font-medium'>{totalPatches}</span>
          </div>
          <div className='flex items-center justify-between'>
            <span>Total detections</span>
            <span className='font-medium'>{totalDetections}</span>
          </div>
          <div className='flex items-center justify-between'>
            <span>Identified</span>
            <span className='font-medium'>{totalIdentified}</span>
          </div>
          <div className='pt-4'>
            <Progress value={totalDetections ? Math.round((totalIdentified / totalDetections) * 100) : 0} />
          </div>
        </div>
      </div>

      <CountsListSection
        title='Labels'
        counts={labelCounts}
        bucket='auto'
        selectedLabel={selectedLabel}
        selectedBucket={selectedBucket}
        onSelectLabel={onSelectLabel}
        emptyText='No labels'
      />

      <CountsListSection
        className='mt-16'
        title='Identified'
        counts={identifiedLabelCounts}
        bucket='user'
        selectedLabel={selectedLabel}
        selectedBucket={selectedBucket}
        onSelectLabel={onSelectLabel}
        emptyText='No identified labels yet'
      />

      <div className='mt-auto pt-16'>
        <Button
          disabled={!canExport}
          className='w-full'
          onClick={() => {
            const p = exportNightDarwinCSV({ nightId })
            toast.promise(p, {
              loading: '💾 Exporting Darwin CSV…',
              success: '✅ Darwin CSV exported',
              error: '🚨 Failed to export Darwin CSV',
            })
          }}
        >
          Export Darwin CSV
        </Button>
      </div>
    </Column>
  )
}

type CountsListSectionProps = {
  title: string
  counts?: Record<string, number>
  bucket: 'auto' | 'user'
  selectedLabel?: string
  selectedBucket?: 'auto' | 'user'
  onSelectLabel: (params: { label?: string; bucket: 'auto' | 'user' }) => void
  emptyText: string
  className?: string
}

function CountsListSection(props: CountsListSectionProps) {
  const { title, counts, bucket, selectedLabel, selectedBucket, onSelectLabel, emptyText, className } = props

  if (!counts || Object.keys(counts).length === 0) {
    return (
      <div className={className}>
        <h4 className='mb-6 text-14 font-semibold'>{title}</h4>
        <p className='text-13 text-neutral-500'>{emptyText}</p>
      </div>
    )
  }

  const items = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const allCount = Object.values(counts).reduce((acc, n) => acc + (n || 0), 0)
  const isAllSelected = !selectedLabel && selectedBucket === bucket

  return (
    <div className={className}>
      <h4 className='mb-6 text-14 font-semibold'>{title}</h4>
      <div>
        {bucket === 'auto' ? (
          <CountsRow
            label='All unapproved'
            count={allCount}
            selected={isAllSelected}
            onSelect={() => {
              clearPatchSelection()
              onSelectLabel({ label: undefined, bucket })
            }}
          />
        ) : null}
        {items.map(([label, count]) => {
          const isSelected = label === selectedLabel
          return (
            <CountsRow
              key={`${title}-${label}`}
              label={label}
              count={count}
              selected={isSelected && selectedBucket === bucket}
              onSelect={() => {
                clearPatchSelection()
                onSelectLabel({ label: isSelected && selectedBucket === bucket ? undefined : label, bucket })
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

type CountsRowProps = {
  label: string
  count: number
  selected?: boolean
  onSelect: () => void
}

function CountsRow(props: CountsRowProps) {
  const { label, count, selected, onSelect } = props

  return (
    <div
      className={cn(
        'flex items-center justify-between first:rounded-t-md last:rounded-b-md hover:z-2 relative -mt-1 px-8 py-6 cursor-pointer ring-1 ring-inset',
        selected
          ? 'z-2 bg-brand/20 text-brand ring-brand/20 hover:bg-brand/20 hover:ring-brand/20'
          : 'bg-background text-ink-primary ring-[rgba(0,0,0,0.1)] hover:bg-neutral-100',
      )}
      onClick={onSelect}
    >
      <span className='text-13 font-medium'>{label}</span>
      <span className='text-13 text-neutral-700'>{count}</span>
    </div>
  )
}

type WarningsBoxProps = { warnings?: NightWarnings; className?: string }
function WarningsBox(props: WarningsBoxProps) {
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
