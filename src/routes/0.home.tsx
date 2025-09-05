import { useStore } from '@nanostores/react'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { formatRelativeTime } from '~/utils/time'
import { projectsStore } from '~/stores/entities/1.projects'
import { sitesStore, type SiteEntity } from '~/stores/entities/2.sites'
import { deploymentsStore, type DeploymentEntity } from '~/stores/entities/3.deployments'
import { nightsStore, type NightEntity } from '~/stores/entities/4.nights'
import { patchesStore } from '~/stores/entities/5.patches'
import { type DetectionEntity } from '~/stores/entities/detections'
import { patchStoreById } from '~/stores/entities/patch-selectors'
import { clearSelections } from '~/features/folder-processing/files'
import { useOpenDirectoryMutation } from '~/features/folder-processing/files-queries'
import { Loader } from '~/components/atomic/Loader'
import { pickerErrorStore } from '~/stores/ui'

export function Home() {
  const pickerError = useStore(pickerErrorStore)
  const projects = useStore(projectsStore)
  const sites = useStore(sitesStore)
  const deployments = useStore(deploymentsStore)
  const nights = useStore(nightsStore)
  useStore(patchesStore)

  return (
    <div className='space-y-6 p-20 pt-12'>
      {pickerError ? <div className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{pickerError}</div> : null}

      <section>
        <h2 className='mb-2 text-lg font-semibold'>Projects</h2>
        {Object.keys(projects ?? {}).length ? (
          <ul className='space-y-2'>
            {Object.values(projects).map((p) => (
              <li key={p.id} className='rounded-md border bg-white p-3'>
                <div className='font-medium'>{p.name}</div>
                <ul className='ml-12 mt-2 space-y-1'>
                  {getSitesForProject({ sites, projectId: p.id }).map((s) => (
                    <li key={s.id}>
                      <div className='text-neutral-800'>{s.name}</div>
                      <ul className='ml-12 mt-1 space-y-1'>
                        {getDeploymentsForSite({ deployments, siteId: s.id }).map((d) => (
                          <li key={d.id}>
                            <div className='text-neutral-700'>{d.name}</div>
                            <ul className='ml-12 mt-1 space-y-1'>
                              {getNightsForDeployment({ nights, deploymentId: d.id }).map((n) => (
                                <li key={n.id}>
                                  <Link
                                    to={'/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId'}
                                    params={{
                                      projectId: p.id,
                                      siteId: lastPathSegment({ id: s.id }),
                                      deploymentId: lastPathSegment({ id: d.id }),
                                      nightId: lastPathSegment({ id: n.id }),
                                    }}
                                    className='text-sm text-blue-700 hover:underline'
                                  >
                                    {n.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-sm text-neutral-500'>Load a projects folder to see projects</p>
        )}
      </section>
    </div>
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
