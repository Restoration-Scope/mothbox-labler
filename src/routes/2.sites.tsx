import { useParams, Link } from '@tanstack/react-router'
import { useStore } from '@nanostores/react'
import { sitesStore } from '../stores/entities/2.sites'
import { useIsLoadingFolders } from '~/features/folder-processing/files-queries'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { ViewContainer } from '~/styles'

export function Sites() {
  const params = useParams({ from: '/projects/$projectId/sites' })
  const isLoadingFolders = useIsLoadingFolders()
  const sites = useStore(sitesStore)
  const list = Object.values(sites).filter((s) => s.projectId === params.projectId)

  if (isLoadingFolders) return <CenteredLoader>🌀 Loading</CenteredLoader>
  if (!list.length) return <p className='text-sm text-neutral-500'>No sites found for this project</p>

  return (
    <ViewContainer className='space-y-4'>
      <h2 className='text-lg font-semibold'>Sites in {params.projectId}</h2>
      <ul className='space-y-3'>
        {list.map((site) => (
          <li key={site.id}>
            <Link
              to={'/projects/$projectId/sites/$siteId/deployments'}
              params={{ projectId: params.projectId, siteId: site?.id?.split('/')?.[1] ?? site.name }}
              className='block rounded-md border bg-white p-3 hover:bg-neutral-50'
            >
              <div className='font-medium'>{site.name}</div>
              <div className='text-xs text-neutral-600'>Open deployments</div>
            </Link>
          </li>
        ))}
      </ul>
    </ViewContainer>
  )
}
