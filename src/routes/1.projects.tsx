import { Link } from '@tanstack/react-router'
import { useStore } from '@nanostores/react'
import { datasetStore } from '../stores/dataset'
import { useIsLoadingFolders } from '~/features/folder-processing/files-queries'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'

export function Projects() {
  const isLoadingFolders = useIsLoadingFolders()
  const dataset = useStore(datasetStore)
  if (isLoadingFolders) return <CenteredLoader>🌀 Loading</CenteredLoader>
  if (!dataset) return <p className='text-sm text-neutral-500'>Load a directory to see projects</p>

  return (
    <div className='space-y-6'>
      <h2 className='text-lg font-semibold'>Projects</h2>
      <div className='space-y-4'>
        {dataset.projects.map((project) => (
          <div key={project.id} className='rounded-md border bg-white'>
            <div className='border-b px-3 py-2 font-medium'>{project.name}</div>
            <ul className='divide-y'>
              {project.deployments.map((dep) => (
                <li key={dep.id} className='px-3 py-2'>
                  <div className='mb-1 text-sm text-neutral-600'>Deployment: {dep.name}</div>
                  <div className='flex flex-wrap gap-2'>
                    {dep.nights.map((night) => (
                      <Link
                        key={night.id}
                        to={'/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId'}
                        params={{
                          projectId: project.id,
                          siteId: project?.id?.split('/')?.[1] ?? project.name,
                          deploymentId: dep.name,
                          nightId: night.id,
                        }}
                        className='rounded border px-3 py-1 text-sm hover:bg-neutral-50'
                        // search={{ nightId: night.id }}
                      >
                        {night.name}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
