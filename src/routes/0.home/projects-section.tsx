import { Link } from '@tanstack/react-router'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { InlineProgress } from './inline-progress'
import { ItemActions } from './item-actions'
import type { ProjectEntity } from '~/stores/entities/1.projects'
import type { SiteEntity } from '~/stores/entities/2.sites'
import type { DeploymentEntity } from '~/stores/entities/3.deployments'
import type { NightEntity } from '~/stores/entities/4.nights'
import type { DetectionEntity } from '~/stores/entities/detections'
import type { NightSummaryEntity } from '~/stores/entities/night-summaries'

type HierarchyStores = {
  sites: Record<string, SiteEntity>
  deployments: Record<string, DeploymentEntity>
  nights: Record<string, NightEntity>
}
type ListStores = Pick<HierarchyStores, 'deployments' | 'nights'>

export type ProjectsSectionProps = HierarchyStores & {
  isLoading: boolean
  projects: Record<string, ProjectEntity>
  detections: Record<string, DetectionEntity>
  nightSummaries: Record<string, NightSummaryEntity>
}

export function ProjectsSection(props: ProjectsSectionProps) {
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
  const res = last
  return res
}

function getProgressForNight(params: {
  nightId: string
  detections: Record<string, DetectionEntity>
  nightSummaries?: Record<string, NightSummaryEntity>
}) {
  const { nightId, detections, nightSummaries } = params
  const summary = nightSummaries?.[nightId]
  if (summary) return { total: summary.totalDetections || 0, identified: summary.totalIdentified || 0 }

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

