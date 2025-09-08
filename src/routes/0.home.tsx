import { useStore } from '@nanostores/react'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Badge } from '~/components/ui/badge'
import { projectsStore, type ProjectEntity } from '~/stores/entities/1.projects'
import { sitesStore, type SiteEntity } from '~/stores/entities/2.sites'
import { deploymentsStore, type DeploymentEntity } from '~/stores/entities/3.deployments'
import { nightsStore, type NightEntity } from '~/stores/entities/4.nights'
import { patchesStore } from '~/stores/entities/5.patches'
import { type DetectionEntity } from '~/stores/entities/detections'
import { patchStoreById } from '~/stores/entities/patch-selectors'
import { pickerErrorStore } from '~/stores/ui'
import { formatRelativeTime } from '~/utils/time'
import { useIsLoadingFolders } from '~/features/folder-processing/files-queries'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'

export function Home() {
  const isLoadingFolders = useIsLoadingFolders()
  const pickerError = useStore(pickerErrorStore)
  const projects = useStore(projectsStore)
  const sites = useStore(sitesStore)
  const deployments = useStore(deploymentsStore)
  const nights = useStore(nightsStore)
  useStore(patchesStore)

  return (
    <div className='space-y-6 p-20 pt-12'>
      {pickerError ? <div className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{pickerError}</div> : null}

      <ProjectsSection isLoading={isLoadingFolders} projects={projects} sites={sites} deployments={deployments} nights={nights} />
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
}
function ProjectsSection(props: ProjectsSectionProps) {
  const { isLoading, projects, sites, deployments, nights } = props

  return (
    <section>
      <h2 className='mb-2 text-lg font-semibold'>Projects</h2>
      {isLoading ? (
        <CenteredLoader>🌀 Loading</CenteredLoader>
      ) : Object.keys(projects ?? {}).length ? (
        <ProjectsList projects={projects} sites={sites} deployments={deployments} nights={nights} />
      ) : (
        <p className='text-sm text-neutral-500'>Load a projects folder to see projects</p>
      )}
    </section>
  )
}

type ProjectsListProps = HierarchyStores & { projects: Record<string, ProjectEntity> }
function ProjectsList(props: ProjectsListProps) {
  const { projects, sites, deployments, nights } = props
  const list = Object.values(projects ?? {})
  if (!list.length) return null

  return (
    <ul className='space-y-2'>
      {list.map((project) => (
        <ProjectItem key={project.id} project={project} sites={sites} deployments={deployments} nights={nights} />
      ))}
    </ul>
  )
}

type ProjectItemProps = HierarchyStores & { project: ProjectEntity }
function ProjectItem(props: ProjectItemProps) {
  const { project, sites, deployments, nights } = props

  return (
    <li className='rounded-md border bg-white p-3'>
      <Link to={'/projects/$projectId/sites'} params={{ projectId: project.id }} className='font-medium text-blue-700 hover:underline'>
        {project.name}
      </Link>
      <SitesList projectId={project.id} sites={sites} deployments={deployments} nights={nights} />
    </li>
  )
}

type SitesListProps = HierarchyStores & { projectId: string }
function SitesList(props: SitesListProps) {
  const { projectId, sites, deployments, nights } = props
  const list = getSitesForProject({ sites, projectId })
  if (!list.length) return null

  return (
    <ul className='ml-12 mt-2 space-y-1'>
      {list.map((site) => (
        <SiteItem key={site.id} site={site} projectId={projectId} deployments={deployments} nights={nights} />
      ))}
    </ul>
  )
}

type SiteItemProps = ListStores & { site: SiteEntity; projectId: string }
function SiteItem(props: SiteItemProps) {
  const { site, projectId, deployments, nights } = props
  const siteParam = lastPathSegment({ id: site.id })

  return (
    <li>
      <Link
        to={'/projects/$projectId/sites/$siteId/deployments'}
        params={{ projectId, siteId: siteParam }}
        className='text-blue-700 hover:underline'
      >
        {site.name}
      </Link>
      <DeploymentsList projectId={projectId} siteId={site.id} deployments={deployments} nights={nights} />
    </li>
  )
}

type DeploymentsListProps = ListStores & { projectId: string; siteId: string }
function DeploymentsList(props: DeploymentsListProps) {
  const { projectId, siteId, deployments, nights } = props
  const list = getDeploymentsForSite({ deployments, siteId })
  if (!list.length) return null

  return (
    <ul className='ml-12 mt-1 space-y-1'>
      {list.map((dep) => (
        <DeploymentItem key={dep.id} projectId={projectId} siteId={siteId} deployment={dep} nights={nights} />
      ))}
    </ul>
  )
}

type DeploymentItemProps = Pick<HierarchyStores, 'nights'> & { projectId: string; siteId: string; deployment: DeploymentEntity }
function DeploymentItem(props: DeploymentItemProps) {
  const { projectId, siteId, deployment, nights } = props
  const siteParam = lastPathSegment({ id: siteId })
  const deploymentParam = lastPathSegment({ id: deployment.id })

  return (
    <li>
      <Link
        to={'/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights'}
        params={{ projectId, siteId: siteParam, deploymentId: deploymentParam }}
        className='text-blue-700 hover:underline'
      >
        {deployment.name}
      </Link>
      <NightsList projectId={projectId} siteId={siteId} deploymentId={deployment.id} nights={nights} />
    </li>
  )
}

type NightsListProps = Pick<HierarchyStores, 'nights'> & { projectId: string; siteId: string; deploymentId: string }
function NightsList(props: NightsListProps) {
  const { projectId, siteId, deploymentId, nights } = props
  const list = getNightsForDeployment({ nights, deploymentId })
  if (!list.length) return null

  return (
    <ul className='ml-12 mt-1 space-y-1'>
      {list.map((night) => (
        <li key={night.id}>
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
