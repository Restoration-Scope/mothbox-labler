import { useStore } from '@nanostores/react'
import { projectsStore } from '~/stores/entities/1.projects'
import { sitesStore } from '~/stores/entities/2.sites'
import { deploymentsStore } from '~/stores/entities/3.deployments'
import { nightsStore } from '~/stores/entities/4.nights'
import { patchesStore } from '~/stores/entities/5.patches'
import { detectionsStore } from '~/stores/entities/detections'
import { nightSummariesStore } from '~/stores/entities/night-summaries'
import { pickerErrorStore } from '~/stores/ui'
import { useAppLoading } from '~/features/folder-processing/files-queries'
import { Row } from '~/styles'
import { Button } from '~/components/ui/button'
import { HomeSummaryPanel } from './home-summary-panel'
import { ProjectsSection } from './projects-section'

export function Home() {
  const { isLoading: isLoadingFolders } = useAppLoading()
  const pickerError = useStore(pickerErrorStore)
  const projects = useStore(projectsStore)
  const sites = useStore(sitesStore)
  const deployments = useStore(deploymentsStore)
  const nights = useStore(nightsStore)
  const patches = useStore(patchesStore)
  const detections = useStore(detectionsStore)
  const nightSummaries = useStore(nightSummariesStore)

  return (
    <Row className='p-20 pt-12 h-full min-h-0 items-start gap-16 overflow-y-auto'>
      <div className='w-[240px] sticky top-0'>
        <div className='mb-12'>
          <Button size='xsm' to={'/morphospecies'}>
            Morphospecies
          </Button>
        </div>
        <HomeSummaryPanel
          className=''
          projects={projects}
          sites={sites}
          deployments={deployments}
          nights={nights}
          patches={patches}
          detections={detections}
          nightSummaries={nightSummaries}
        />
      </div>
      <div className='min-h-0 flex-1'>
        {pickerError ? (
          <div className='mb-12 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{pickerError}</div>
        ) : null}
        <ProjectsSection
          isLoading={isLoadingFolders}
          projects={projects}
          sites={sites}
          deployments={deployments}
          nights={nights}
          detections={detections}
          nightSummaries={nightSummaries}
        />
      </div>
    </Row>
  )
}

export {}
