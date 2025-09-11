import { useStore } from '@nanostores/react'
import { Progress } from '~/components/ui/progress'
import { cn } from '~/utils/cn'
import { patchFileMapByNightStore } from '~/features/folder-processing/files.state'
import type { ProjectEntity } from '~/stores/entities/1.projects'
import type { SiteEntity } from '~/stores/entities/2.sites'
import type { DeploymentEntity } from '~/stores/entities/3.deployments'
import type { NightEntity } from '~/stores/entities/4.nights'
import type { DetectionEntity } from '~/stores/entities/detections'
import type { NightSummaryEntity } from '~/stores/entities/night-summaries'
import classed from '~/styles/classed'

export type HomeSummaryPanelProps = {
  projects: Record<string, ProjectEntity>
  sites: Record<string, SiteEntity>
  deployments: Record<string, DeploymentEntity>
  nights: Record<string, NightEntity>
  patches: Record<string, unknown>
  detections: Record<string, DetectionEntity>
  nightSummaries: Record<string, NightSummaryEntity>
  className?: string
}

export function HomeSummaryPanel(props: HomeSummaryPanelProps) {
  const { projects, sites, deployments, nights, patches, detections, nightSummaries, className } = props

  const patchMapByNight = useStore(patchFileMapByNightStore)

  const totalDetectionsFromSummaries = Object.values(nightSummaries ?? {}).reduce((acc, s) => acc + (s?.totalDetections || 0), 0)
  const totalIdentifiedFromSummaries = Object.values(nightSummaries ?? {}).reduce((acc, s) => acc + (s?.totalIdentified || 0), 0)
  const totalDetections = totalDetectionsFromSummaries || Object.keys(detections ?? {}).length
  const totalIdentified =
    totalIdentifiedFromSummaries || Object.values(detections ?? {}).filter((d) => (d as any)?.detectedBy === 'user').length

  const totalPatchesFromSummaries = Object.values(nightSummaries ?? {}).reduce((acc, s) => acc + (s?.totalDetections || 0), 0)
  const totalPatchesFromInit = Object.values(patchMapByNight ?? {}).reduce((acc, map) => acc + Object.keys(map ?? {}).length, 0)
  const totalPatches = totalPatchesFromSummaries || totalPatchesFromInit || Object.keys(patches ?? {}).length

  return (
    <div className={cn('p-12 rounded-md border bg-white', className)}>
      <h3 className='mb-6 text-16 font-semibold'>Summary</h3>

      <div className='space-y-4 text-13 text-neutral-700'>
        <StatPair>
          <span>Projects</span>
          <span className='font-medium'>{Object.keys(projects ?? {}).length}</span>
        </StatPair>
        <StatPair>
          <span>Sites</span>
          <span className='font-medium'>{Object.keys(sites ?? {}).length}</span>
        </StatPair>
        <StatPair>
          <span>Deployments</span>
          <span className='font-medium'>{Object.keys(deployments ?? {}).length}</span>
        </StatPair>
        <StatPair>
          <span>Nights</span>
          <span className='font-medium'>{Object.keys(nights ?? {}).length}</span>
        </StatPair>
        <StatPair>
          <span>Total patches</span>
          <span className='font-medium'>{totalPatches}</span>
        </StatPair>
        <StatPair>
          <span>Total detections</span>
          <span className='font-medium'>{totalDetections}</span>
        </StatPair>
        <StatPair>
          <span>Identified</span>
          <span className='font-medium'>{totalIdentified}</span>
        </StatPair>

        <div className='pt-4'>
          <Progress value={totalDetections ? Math.round((totalIdentified / totalDetections) * 100) : 0} />
        </div>
      </div>
    </div>
  )
}

const StatPair = classed('div', 'flex items-center justify-between')
