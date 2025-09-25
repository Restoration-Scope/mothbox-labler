import { Column } from '~/styles'
import { cn } from '~/utils/cn'
import { Progress } from '~/components/ui/progress'
import { Button } from '~/components/ui/button'
import { useParams } from '@tanstack/react-router'
import { useStore } from '@nanostores/react'
import { detectionsStore } from '~/stores/entities/detections'
import { exportNightDarwinCSV } from '~/features/export/darwin-csv'
import { toast } from 'sonner'
import { exportNightSummaryRS } from '~/features/export/rs-summary'
import { PatchSizeControl } from '~/components/atomic/patch-size-control'
import type { NightLeftPanelProps } from './left-panel.types'
import { WarningsBox } from './warnings-box'
import { TaxonomySection } from './taxonomy-section'

export function NightLeftPanel(props: NightLeftPanelProps) {
  const {
    taxonomyAuto,
    taxonomyUser,
    totalPatches,
    totalDetections,
    totalIdentified = 0,
    selectedTaxon,
    selectedBucket,
    onSelectTaxon,
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

      <PatchSizeControl className='mb-16' />

      <TaxonomySection
        title='Auto'
        nodes={taxonomyAuto}
        bucket='auto'
        selectedTaxon={selectedTaxon}
        selectedBucket={selectedBucket}
        onSelectTaxon={onSelectTaxon}
        emptyText='No detections'
      />

      <TaxonomySection
        className='mt-16'
        title='Identified'
        nodes={taxonomyUser}
        bucket='user'
        selectedTaxon={selectedTaxon}
        selectedBucket={selectedBucket}
        onSelectTaxon={onSelectTaxon}
        emptyText='No identifications yet'
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

        <Button
          disabled={!canExport}
          className='w-full mt-8'
          onClick={() => {
            const p = exportNightSummaryRS({ nightId })
            toast.promise(p, {
              loading: '💾 Exporting RS summary…',
              success: '✅ RS summary exported',
              error: '🚨 Failed to export RS summary',
            })
          }}
        >
          Export summary to RS
        </Button>
      </div>
    </Column>
  )
}
