import { Link } from '@tanstack/react-router'
import { useStore } from '@nanostores/react'
import { projectsStore } from '../stores/entities/1.projects'
import { deploymentsStore } from '../stores/entities/3.deployments'
import { nightsStore } from '../stores/entities/4.nights'
import { useAppLoading } from '~/features/folder-processing/files-queries'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { ViewContainer } from '~/styles'

export function Projects() {
  const { isLoading: isLoadingFolders } = useAppLoading()
  const projects = useStore(projectsStore)
  const deployments = useStore(deploymentsStore)
  const nights = useStore(nightsStore)
  if (isLoadingFolders) return <CenteredLoader>🌀 Loading</CenteredLoader>
  if (!Object.keys(projects || {}).length) return <p className='text-sm text-neutral-500'>Load a directory to see projects</p>

  return (
    <div className='space-y-6'>
      <h2 className='text-lg font-semibold'>Projects</h2>

      <ViewContainer className='space-y-4'>
        {Object.values(projects).map((project) => {
          const projectDeployments = Object.values(deployments).filter((d) => d.projectId === project.id)
          return (
            <div key={project.id} className='rounded-md border bg-white'>
              <div className='border-b px-3 py-2 font-medium'>{project.name}</div>
              <ul className='divide-y'>
                {projectDeployments.map((dep) => {
                  const depNights = Object.values(nights).filter((n) => n.deploymentId === dep.id)
                  const siteId = project?.id?.split('/')?.[1] ?? project.name
                  return (
                    <li key={dep.id} className='px-3 py-2'>
                      <div className='mb-1 text-sm text-neutral-600'>Deployment: {dep.name}</div>
                      <div className='flex flex-wrap gap-2'>
                        {depNights.map((night) => (
                          <Link
                            key={night.id}
                            to={'/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId'}
                            params={{ projectId: project.id, siteId, deploymentId: dep.name, nightId: night.name }}
                            className='rounded border px-3 py-1 text-sm hover:bg-neutral-50'
                          >
                            {night.name}
                          </Link>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </ViewContainer>
    </div>
  )
}
