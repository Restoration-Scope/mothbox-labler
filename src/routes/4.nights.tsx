import { Link, useParams, useRouter } from '@tanstack/react-router'
import { useStore } from '@nanostores/react'
import { deploymentsStore } from '../stores/entities/3.deployments'
import { nightsStore } from '../stores/entities/4.nights'
import { useIsLoadingFolders } from '~/features/folder-processing/files-queries'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { ViewContainer } from '~/styles'

export function Nights() {
  const params = useParams({ from: '/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights' })
  const router = useRouter()
  const isLoadingFolders = useIsLoadingFolders()
  useStore(deploymentsStore)
  const nights = useStore(nightsStore)

  const deploymentId = `${params.projectId}/${params.siteId}/${params.deploymentId}`
  const list = Object.values(nights).filter((n) => n.deploymentId === deploymentId)

  const search = router.state.location.search as unknown as { nightId?: string }
  const activeNightId = search?.nightId

  if (isLoadingFolders) return <CenteredLoader>🌀 Loading nights</CenteredLoader>

  if (!list.length) return <p className='text-sm text-neutral-500'>No nights found</p>

  return (
    <ViewContainer tabIndex={0} className='space-y-6'>
      <h2 className='text-lg font-semibold'>Nights in {params.deploymentId}</h2>
      <ul className='space-y-3'>
        {list.map((night) => (
          <li key={night.id}>
            <Link
              to={'/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId'}
              params={{
                projectId: params.projectId,
                siteId: params.siteId,
                deploymentId: params.deploymentId,
                nightId: night.name,
              }}
              className='block rounded-md border bg-white p-3 hover:bg-neutral-50'
            >
              <div className='font-medium'>{night.name}</div>
              {activeNightId === night.id ? <div className='text-xs text-neutral-500'>Selected</div> : null}
            </Link>
          </li>
        ))}
      </ul>
    </ViewContainer>
  )
}
