import { useParams, Link } from '@tanstack/react-router'
import { useStore } from '@nanostores/react'
import { deploymentsStore } from '../stores/entities/3.deployments'

export function Deployments() {
  const params = useParams({ from: '/projects/$projectId/sites/$siteId/deployments' })
  const deployments = useStore(deploymentsStore)
  const list = Object.values(deployments).filter(
    (d) => d.projectId === params.projectId && d.siteId === `${params.projectId}/${params.siteId}`,
  )

  if (!list.length) return <p className='text-sm text-neutral-500'>No deployments found for this site</p>

  return (
    <div className='space-y-4'>
      <h2 className='text-lg font-semibold'>Deployments in {params.siteId}</h2>
      <ul className='space-y-3'>
        {list.map((dep) => (
          <li key={dep.id}>
            <Link
              to='/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights'
              params={{ projectId: params.projectId, siteId: params.siteId, deploymentId: dep.name }}
              className='block rounded-md border bg-white p-3 hover:bg-neutral-50'
            >
              <div className='font-medium'>{dep.name}</div>
              <div className='text-xs text-neutral-600'>Open nights</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
