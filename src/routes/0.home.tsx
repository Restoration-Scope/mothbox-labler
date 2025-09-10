import { useStore } from '@nanostores/react'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Progress } from '~/components/ui/progress'
import { projectsStore, type ProjectEntity } from '~/stores/entities/1.projects'
import { sitesStore, type SiteEntity } from '~/stores/entities/2.sites'
import { deploymentsStore, type DeploymentEntity } from '~/stores/entities/3.deployments'
import { nightsStore, type NightEntity } from '~/stores/entities/4.nights'
import { patchesStore } from '~/stores/entities/5.patches'
import { detectionsStore, type DetectionEntity } from '~/stores/entities/detections'
import { nightSummariesStore, type NightSummaryEntity } from '~/stores/entities/night-summaries'
import { patchStoreById } from '~/stores/entities/patch-selectors'
import { pickerErrorStore } from '~/stores/ui'
import { formatRelativeTime } from '~/utils/time'
import { useAppLoading } from '~/features/folder-processing/files-queries'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { exportNightDarwinCSV } from '~/features/export/darwin-csv'
import { exportNightSummaryRS } from '~/features/export/rs-summary'
import { toast } from 'sonner'

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
    <div className='p-20 pt-12 h-full min-h-0 flex gap-16'>
      <div className='w-[240px] shrink-0'>
        <HomeSummaryPanel
          projects={projects}
          sites={sites}
          deployments={deployments}
          nights={nights}
          patches={patches}
          detections={detections}
        />
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto'>
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
    </div>
  )
}

type HierarchyStores = {
  sites: Record<string, SiteEntity>
  deployments: Record<string, DeploymentEntity>
  nights: Record<string, NightEntity>
}
type ListStores = Pick<HierarchyStores, 'deployments' | 'nights'>
type ProjectsSectionProps = HierarchyStores & {
  isLoading: boolean
  projects: Record<string, ProjectEntity>
  detections: Record<string, DetectionEntity>
  nightSummaries: Record<string, NightSummaryEntity>
}
function ProjectsSection(props: ProjectsSectionProps) {
  const { isLoading, projects, sites, deployments, nights, detections, nightSummaries } = props

  return (
    <section>
      <h2 className='mb-2 text-lg font-semibold'>Projects</h2>
      {isLoading ? (
        <CenteredLoader>🌀 Loading</CenteredLoader>
      ) : Object.keys(projects ?? {}).length ? (
        <ProjectsList
          projects={projects}
          sites={sites}
          deployments={deployments}
          nights={nights}
          detections={detections}
          nightSummaries={nightSummaries}
        />
      ) : (
        <p className='text-sm text-neutral-500'>Load a projects folder to see projects</p>
      )}
    </section>
  )
}

type ProjectsListProps = HierarchyStores & {
  projects: Record<string, ProjectEntity>
  detections: Record<string, DetectionEntity>
  nightSummaries: Record<string, NightSummaryEntity>
}
function ProjectsList(props: ProjectsListProps) {
  const { projects, sites, deployments, nights, detections, nightSummaries } = props
  const list = Object.values(projects ?? {})
  if (!list.length) return null

  return (
    <ul className='space-y-1'>
      {list.map((project) => (
        <ProjectItem
          key={project.id}
          project={project}
          sites={sites}
          deployments={deployments}
          nights={nights}
          detections={detections}
          nightSummaries={nightSummaries}
        />
      ))}
    </ul>
  )
}

type ProjectItemProps = HierarchyStores & {
  project: ProjectEntity
  detections: Record<string, DetectionEntity>
  nightSummaries: Record<string, NightSummaryEntity>
}
function ProjectItem(props: ProjectItemProps) {
  const { project, sites, deployments, nights, detections, nightSummaries } = props
  const prog = getProgressForProject({ projectId: project.id, detections, nightSummaries })

  return (
    <li className='rounded-md border bg-white p-8 relative group/project'>
      <div className='flex items-center gap-12'>
        <Link to={'/projects/$projectId/sites'} params={{ projectId: project.id }} className='font-medium text-blue-700 hover:underline'>
          {project.name}
        </Link>
        <div className='ml-auto flex items-center gap-12'>
          <InlineProgress total={prog.total} identified={prog.identified} />
          <ItemActions scope={'project'} id={project.id} nights={nights} />
        </div>
      </div>
      <SitesList
        projectId={project.id}
        sites={sites}
        deployments={deployments}
        nights={nights}
        detections={detections}
        nightSummaries={nightSummaries}
      />
    </li>
  )
}

type SitesListProps = HierarchyStores & {
  projectId: string
  detections: Record<string, DetectionEntity>
  nightSummaries: Record<string, NightSummaryEntity>
}
function SitesList(props: SitesListProps) {
  const { projectId, sites, deployments, nights, detections, nightSummaries } = props
  const list = getSitesForProject({ sites, projectId })
  if (!list.length) return null

  return (
    <ul className='ml-12 mt-2 space-y-1'>
      {list.map((site) => (
        <SiteItem
          key={site.id}
          site={site}
          projectId={projectId}
          deployments={deployments}
          nights={nights}
          detections={detections}
          nightSummaries={nightSummaries}
        />
      ))}
    </ul>
  )
}

type SiteItemProps = ListStores & {
  site: SiteEntity
  projectId: string
  detections: Record<string, DetectionEntity>
  nightSummaries: Record<string, NightSummaryEntity>
}
function SiteItem(props: SiteItemProps) {
  const { site, projectId, deployments, nights, detections, nightSummaries } = props
  const siteParam = lastPathSegment({ id: site.id })
  const prog = getProgressForSite({ siteId: site.id, detections, nightSummaries })

  return (
    <li className='relative group/site'>
      <div className='flex items-center gap-12'>
        <Link
          to={'/projects/$projectId/sites/$siteId/deployments'}
          params={{ projectId, siteId: siteParam }}
          className='text-blue-700 hover:underline'
        >
          {site.name}
        </Link>
        <div className='ml-auto flex items-center gap-12'>
          <InlineProgress total={prog.total} identified={prog.identified} />
          <ItemActions scope={'site'} id={site.id} nights={nights} />
        </div>
      </div>
      <DeploymentsList
        projectId={projectId}
        siteId={site.id}
        deployments={deployments}
        nights={nights}
        detections={detections}
        nightSummaries={nightSummaries}
      />
    </li>
  )
}

type DeploymentsListProps = ListStores & {
  projectId: string
  siteId: string
  detections: Record<string, DetectionEntity>
  nightSummaries: Record<string, NightSummaryEntity>
}
function DeploymentsList(props: DeploymentsListProps) {
  const { projectId, siteId, deployments, nights, detections, nightSummaries } = props
  const list = getDeploymentsForSite({ deployments, siteId })
  if (!list.length) return null

  return (
    <ul className='ml-12 mt-1 space-y-1'>
      {list.map((dep) => (
        <DeploymentItem
          key={dep.id}
          projectId={projectId}
          siteId={siteId}
          deployment={dep}
          nights={nights}
          detections={detections}
          nightSummaries={nightSummaries}
        />
      ))}
    </ul>
  )
}

type DeploymentItemProps = Pick<HierarchyStores, 'nights'> & {
  projectId: string
  siteId: string
  deployment: DeploymentEntity
  detections: Record<string, DetectionEntity>
  nightSummaries: Record<string, NightSummaryEntity>
}
function DeploymentItem(props: DeploymentItemProps) {
  const { projectId, siteId, deployment, nights, detections, nightSummaries } = props
  const siteParam = lastPathSegment({ id: siteId })
  const deploymentParam = lastPathSegment({ id: deployment.id })
  const prog = getProgressForDeployment({ deploymentId: deployment.id, detections, nightSummaries })

  return (
    <li className='relative group/deployment'>
      <div className='flex items-center gap-12'>
        <Link
          to={'/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights'}
          params={{ projectId, siteId: siteParam, deploymentId: deploymentParam }}
          className='text-blue-700 hover:underline'
        >
          {deployment.name}
        </Link>
        <div className='ml-auto flex items-center gap-12'>
          <InlineProgress total={prog.total} identified={prog.identified} />
          <ItemActions scope={'deployment'} id={deployment.id} nights={nights} />
        </div>
      </div>
      <NightsList
        projectId={projectId}
        siteId={siteId}
        deploymentId={deployment.id}
        nights={nights}
        detections={detections}
        nightSummaries={nightSummaries}
      />
    </li>
  )
}

type NightsListProps = Pick<HierarchyStores, 'nights'> & {
  projectId: string
  siteId: string
  deploymentId: string
  detections: Record<string, DetectionEntity>
  nightSummaries: Record<string, NightSummaryEntity>
}
function NightsList(props: NightsListProps) {
  const { projectId, siteId, deploymentId, nights, detections, nightSummaries } = props
  const list = getNightsForDeployment({ nights, deploymentId })
  if (!list.length) return null

  return (
    <ul className='ml-12 mt-1 space-y-1'>
      {list.map((night) => (
        <li key={night.id} className='relative group/night'>
          <div className='flex items-center gap-12'>
            <Link
              to={'/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId'}
              params={{
                projectId,
                siteId: lastPathSegment({ id: siteId }),
                deploymentId: lastPathSegment({ id: deploymentId }),
                nightId: lastPathSegment({ id: night.id }),
              }}
              className='text-sm text-blue-700 hover:underline'
            >
              {night.name}
            </Link>
            <div className='ml-auto flex items-center gap-12'>
              <InlineProgress
                total={getProgressForNight({ nightId: night.id, detections, nightSummaries }).total}
                identified={getProgressForNight({ nightId: night.id, detections, nightSummaries }).identified}
              />
              <ItemActions scope={'night'} id={night.id} nights={nights} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function getSitesForProject(params: { sites: Record<string, SiteEntity>; projectId: string }) {
  const { sites, projectId } = params
  const list = Object.values(sites ?? {}).filter((s) => s.projectId === projectId)
  return list
}

function getDeploymentsForSite(params: { deployments: Record<string, DeploymentEntity>; siteId: string }) {
  const { deployments, siteId } = params
  const list = Object.values(deployments ?? {}).filter((d) => d.siteId === siteId)
  return list
}

function getNightsForDeployment(params: { nights: Record<string, NightEntity>; deploymentId: string }) {
  const { nights, deploymentId } = params
  const list = Object.values(nights ?? {}).filter((n) => n.deploymentId === deploymentId)
  return list
}

function lastPathSegment(params: { id: string }) {
  const { id } = params
  const parts = (id ?? '').split('/')
  const last = parts[parts.length - 1] ?? ''
  return last
}

type RecentIdentificationCardProps = { detection: DetectionEntity }
export function RecentIdentificationCard(props: RecentIdentificationCardProps) {
  const { detection } = props
  const patch = useStore(patchStoreById(detection?.patchId))
  const url = useMemo(() => (patch?.imageFile ? URL.createObjectURL(patch.imageFile.file) : ''), [patch?.imageFile])

  const label = detection?.label || 'Unlabeled'
  const [projectId, siteId, deploymentId, nightId] = (detection?.nightId ?? '').split('/')

  const hrefParams = { projectId, siteId, deploymentId, nightId }
  const when = formatRelativeTime({ ts: detection?.identifiedAt })

  return (
    <Link
      to={'/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId'}
      params={hrefParams as any}
      className='block rounded-md border bg-white hover:border-primary/40 overflow-hidden'
    >
      {url ? (
        <img src={url} alt={patch?.name ?? 'patch'} className='aspect-square w-full object-cover' onLoad={() => URL.revokeObjectURL(url)} />
      ) : (
        <div className='aspect-square w-full bg-neutral-100' />
      )}
      <div className='flex items-center justify-between px-8 py-8'>
        <Badge size='sm'>{label}</Badge>
        {when ? <span className='text-11 text-neutral-500'>{when}</span> : null}
      </div>
    </Link>
  )
}

type HomeSummaryPanelProps = {
  projects: Record<string, ProjectEntity>
  sites: Record<string, SiteEntity>
  deployments: Record<string, DeploymentEntity>
  nights: Record<string, NightEntity>
  patches: Record<string, unknown>
  detections: Record<string, DetectionEntity>
}
function HomeSummaryPanel(props: HomeSummaryPanelProps) {
  const { projects, sites, deployments, nights, patches, detections } = props
  const totalDetections = Object.keys(detections ?? {}).length
  const totalIdentified = Object.values(detections ?? {}).filter((d) => (d as any)?.detectedBy === 'user').length
  const totalPatches = Object.keys(patches ?? {}).length

  return (
    <div className='p-12 rounded-md border bg-white'>
      <h3 className='mb-6 text-16 font-semibold'>Summary</h3>
      <div className='space-y-4 text-13 text-neutral-700'>
        <div className='flex items-center justify-between'>
          <span>Projects</span>
          <span className='font-medium'>{Object.keys(projects ?? {}).length}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span>Sites</span>
          <span className='font-medium'>{Object.keys(sites ?? {}).length}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span>Deployments</span>
          <span className='font-medium'>{Object.keys(deployments ?? {}).length}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span>Nights</span>
          <span className='font-medium'>{Object.keys(nights ?? {}).length}</span>
        </div>
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
  )
}

function InlineProgress(props: { total: number; identified: number }) {
  const { total, identified } = props
  const pct = total ? Math.round((identified / total) * 100) : 0
  return (
    <div className='flex items-center gap-8 text-12 text-neutral-600'>
      <span>
        {identified}/{total}
      </span>
      <div className='w-[80px]'>
        <Progress value={pct} />
      </div>
    </div>
  )
}

type ItemActionsProps = { scope: 'project' | 'site' | 'deployment' | 'night'; id: string; nights: Record<string, NightEntity> }
function ItemActions(props: ItemActionsProps) {
  const { scope, id, nights } = props
  return (
    <div
      className={
        scope === 'project'
          ? 'opacity-0 group/project-hover:opacity-100 transition-opacity flex items-center gap-6'
          : scope === 'site'
          ? 'opacity-0 group/site-hover:opacity-100 transition-opacity flex items-center gap-6'
          : scope === 'deployment'
          ? 'opacity-0 group/deployment-hover:opacity-100 transition-opacity flex items-center gap-6'
          : 'opacity-0 group/night-hover:opacity-100 transition-opacity flex items-center gap-6'
      }
    >
      <Button
        size='sm'
        variant='outline'
        onClick={() => {
          const p = exportScopeDarwinCSV({ scope, id, nights })
          toast.promise(p, { loading: '💾 Exporting DwC…', success: '✅ DwC exported', error: '🚨 Failed to export DwC' })
        }}
      >
        Export DwC
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={() => {
          const p = exportScopeRS({ scope, id, nights })
          toast.promise(p, { loading: '💾 Exporting RS…', success: '✅ RS exported', error: '🚨 Failed to export RS' })
        }}
      >
        Export RS
      </Button>
    </div>
  )
}

function exportScopeDarwinCSV(params: {
  scope: 'project' | 'site' | 'deployment' | 'night'
  id: string
  nights: Record<string, NightEntity>
}) {
  const { scope, id, nights } = params
  const nightIds = collectNightIdsForScope({ scope, id, nights })
  const tasks = nightIds.map((nightId) => exportNightDarwinCSV({ nightId }))
  const p = Promise.all(tasks).then(() => void 0)
  return p
}

function exportScopeRS(params: { scope: 'project' | 'site' | 'deployment' | 'night'; id: string; nights: Record<string, NightEntity> }) {
  const { scope, id, nights } = params
  const nightIds = collectNightIdsForScope({ scope, id, nights })
  const tasks = nightIds.map((nightId) => exportNightSummaryRS({ nightId }))
  const p = Promise.all(tasks).then(() => void 0)
  return p
}

function collectNightIdsForScope(params: {
  scope: 'project' | 'site' | 'deployment' | 'night'
  id: string
  nights: Record<string, NightEntity>
}) {
  const { scope, id, nights } = params
  if (scope === 'night') return [id]
  if (scope === 'deployment')
    return Object.values(nights ?? {})
      .filter((n) => n.deploymentId === id)
      .map((n) => n.id)
  if (scope === 'site')
    return Object.values(nights ?? {})
      .filter((n) => n.siteId === id)
      .map((n) => n.id)
  if (scope === 'project')
    return Object.values(nights ?? {})
      .filter((n) => n.projectId === id)
      .map((n) => n.id)
  return []
}

function getProgressForNight(params: {
  nightId: string
  detections: Record<string, DetectionEntity>
  nightSummaries?: Record<string, NightSummaryEntity>
}) {
  const { nightId, detections, nightSummaries } = params
  const summary = nightSummaries?.[nightId]
  if (summary) return { total: summary.totalDetections || 0, identified: summary.totalIdentified || 0 }
  // Fallback to live computation
  let total = 0
  let identified = 0
  for (const d of Object.values(detections ?? {})) {
    if ((d as any)?.nightId !== nightId) continue
    total++
    if ((d as any)?.detectedBy === 'user') identified++
  }
  return { total, identified }
}

function getProgressForDeployment(params: {
  deploymentId: string
  detections: Record<string, DetectionEntity>
  nightSummaries?: Record<string, NightSummaryEntity>
}) {
  const { deploymentId, detections, nightSummaries } = params
  const prefix = deploymentId + '/'
  if (nightSummaries && Object.keys(nightSummaries).length) {
    let total = 0
    let identified = 0
    for (const [nightId, s] of Object.entries(nightSummaries)) {
      if (!nightId.startsWith(prefix)) continue
      total += s?.totalDetections || 0
      identified += s?.totalIdentified || 0
    }
    return { total, identified }
  }
  let total = 0
  let identified = 0
  for (const d of Object.values(detections ?? {})) {
    const nightId = (d as any)?.nightId || ''
    if (!nightId.startsWith(prefix)) continue
    total++
    if ((d as any)?.detectedBy === 'user') identified++
  }
  return { total, identified }
}

function getProgressForSite(params: {
  siteId: string
  detections: Record<string, DetectionEntity>
  nightSummaries?: Record<string, NightSummaryEntity>
}) {
  const { siteId, detections, nightSummaries } = params
  const prefix = siteId + '/'
  if (nightSummaries && Object.keys(nightSummaries).length) {
    let total = 0
    let identified = 0
    for (const [nightId, s] of Object.entries(nightSummaries)) {
      if (!nightId.startsWith(prefix)) continue
      total += s?.totalDetections || 0
      identified += s?.totalIdentified || 0
    }
    return { total, identified }
  }
  let total = 0
  let identified = 0
  for (const d of Object.values(detections ?? {})) {
    const nightId = (d as any)?.nightId || ''
    if (!nightId.startsWith(prefix)) continue
    total++
    if ((d as any)?.detectedBy === 'user') identified++
  }
  return { total, identified }
}

function getProgressForProject(params: {
  projectId: string
  detections: Record<string, DetectionEntity>
  nightSummaries?: Record<string, NightSummaryEntity>
}) {
  const { projectId, detections, nightSummaries } = params
  const prefix = projectId + '/'
  if (nightSummaries && Object.keys(nightSummaries).length) {
    let total = 0
    let identified = 0
    for (const [nightId, s] of Object.entries(nightSummaries)) {
      if (!nightId.startsWith(prefix)) continue
      total += s?.totalDetections || 0
      identified += s?.totalIdentified || 0
    }
    return { total, identified }
  }
  let total = 0
  let identified = 0
  for (const d of Object.values(detections ?? {})) {
    const nightId = (d as any)?.nightId || ''
    if (!nightId.startsWith(prefix)) continue
    total++
    if ((d as any)?.detectedBy === 'user') identified++
  }
  return { total, identified }
}
