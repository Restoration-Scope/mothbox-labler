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
import { exportNightSummaryRS } from '~/features/export/rs-summary'
import { PatchSizeControl } from '~/components/atomic/patch-size-control'

type NightWarnings = {
  jsonWithoutPhotoCount?: number
  missingPatchImageCount?: number
}

type TaxonomyNode = {
  rank: 'order' | 'family' | 'genus' | 'species'
  name: string
  count: number
  children?: TaxonomyNode[]
}

export type NightLeftPanelProps = {
  taxonomyAuto?: TaxonomyNode[]
  taxonomyUser?: TaxonomyNode[]
  totalPatches: number
  totalDetections: number
  totalIdentified?: number
  selectedTaxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }
  selectedBucket?: 'auto' | 'user'
  onSelectTaxon: (params: { taxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }; bucket: 'auto' | 'user' }) => void
  warnings?: NightWarnings
  className?: string
}

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

type TaxonomySectionProps = {
  title: string
  nodes?: TaxonomyNode[]
  bucket: 'auto' | 'user'
  selectedTaxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }
  selectedBucket?: 'auto' | 'user'
  onSelectTaxon: (params: { taxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }; bucket: 'auto' | 'user' }) => void
  emptyText: string
  className?: string
}

function TaxonomySection(props: TaxonomySectionProps) {
  const { title, nodes, bucket, selectedTaxon, selectedBucket, onSelectTaxon, emptyText, className } = props

  if (!nodes || nodes.length === 0) {
    return (
      <div className={className}>
        <h4 className='mb-6 text-14 font-semibold'>{title}</h4>
        <p className='text-13 text-neutral-500'>{emptyText}</p>
      </div>
    )
  }

  const allCount = nodes.reduce((acc, n) => acc + (n?.count || 0), 0)
  const isAllSelected = !selectedTaxon && selectedBucket === bucket

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
              onSelectTaxon({ taxon: undefined, bucket })
            }}
          />
        ) : null}

        {nodes.map((orderNode) => (
          <div key={`order-${orderNode.name}`}>
            <TaxonomyRow
              rank='order'
              name={orderNode.name}
              count={orderNode.count}
              selected={selectedBucket === bucket && selectedTaxon?.rank === 'order' && selectedTaxon?.name === orderNode.name}
              onSelect={() => {
                clearPatchSelection()
                onSelectTaxon({ taxon: { rank: 'order', name: orderNode.name }, bucket })
              }}
            />

            {orderNode.children && orderNode.children.length ? (
              <div className='ml-8 pl-16 border-l border-inka-150'>
                {orderNode.children.map((familyNode) => (
                  <div key={`family-${orderNode.name}-${familyNode.name}`} className='relative'>
                    <TaxonomyRow
                      rank='family'
                      name={familyNode.name}
                      count={familyNode.count}
                      selected={selectedBucket === bucket && selectedTaxon?.rank === 'family' && selectedTaxon?.name === familyNode.name}
                      onSelect={() => {
                        clearPatchSelection()
                        onSelectTaxon({ taxon: { rank: 'family', name: familyNode.name }, bucket })
                      }}
                      withConnector
                    />
                    {familyNode.children && familyNode.children.length ? (
                      <div className='ml-8 pl-16 border-l border-inka-150'>
                        {familyNode.children.map((genusNode) => (
                          <div key={`genus-${orderNode.name}-${familyNode.name}-${genusNode.name}`} className='relative'>
                            <TaxonomyRow
                              rank='genus'
                              name={genusNode.name}
                              count={genusNode.count}
                              selected={
                                selectedBucket === bucket && selectedTaxon?.rank === 'genus' && selectedTaxon?.name === genusNode.name
                              }
                              onSelect={() => {
                                clearPatchSelection()
                                onSelectTaxon({ taxon: { rank: 'genus', name: genusNode.name }, bucket })
                              }}
                              withConnector
                            />
                            {genusNode.children && genusNode.children.length ? (
                              <div className='ml-8 pl-16 border-l border-inka-150'>
                                {genusNode.children.map((speciesNode) => (
                                  <div
                                    key={`species-${orderNode.name}-${familyNode.name}-${genusNode.name}-${speciesNode.name}`}
                                    className='relative'
                                  >
                                    <TaxonomyRow
                                      rank='species'
                                      name={speciesNode.name}
                                      count={speciesNode.count}
                                      selected={
                                        selectedBucket === bucket &&
                                        selectedTaxon?.rank === 'species' &&
                                        selectedTaxon?.name === speciesNode.name
                                      }
                                      onSelect={() => {
                                        clearPatchSelection()
                                        onSelectTaxon({ taxon: { rank: 'species', name: speciesNode.name }, bucket })
                                      }}
                                      withConnector
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
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

type TaxonomyRowProps = {
  rank: 'order' | 'family' | 'genus' | 'species'
  name: string
  count: number
  selected?: boolean
  onSelect: () => void
}

function TaxonomyRow(props: TaxonomyRowProps & { withConnector?: boolean }) {
  const { rank, name, count, selected, onSelect, withConnector } = props
  const prefix = rank === 'order' ? 'O' : rank === 'family' ? 'F' : rank === 'genus' ? 'G' : 'S'

  return (
    <div className='relative'>
      {withConnector ? <span className='absolute left-0 top-1/2 w-16 -translate-y-1/2 border-t border-inka-150'></span> : null}
      <div
        className={cn(
          'flex items-center justify-between first:rounded-t-md last:rounded-b-md hover:z-2 relative -mt-1 px-8 py-6 cursor-pointer',
          selected ? 'z-2 bg-brand/15 text-brand hover:bg-brand/20' : 'bg-background text-ink-primary hover:bg-neutral-100',
        )}
        onClick={onSelect}
      >
        <span className='text-13 font-medium'>
          <span className='mr-6 text-11 text-neutral-500'>{prefix}</span>
          {name}
        </span>
        <span className='text-13 text-neutral-700'>{count}</span>
      </div>
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
