import { useParams } from '@tanstack/react-router'
import { useStore } from '@nanostores/react'
import { datasetStore } from '../stores/dataset'

export function Patches() {
  const dataset = useStore(datasetStore)
  const params = useParams({ from: '/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId' })

  if (!dataset) return <p className='text-sm text-neutral-500'>No dataset loaded</p>
  const project = dataset.projects.find((p) => p.id === params.projectId)
  if (!project) return <p className='text-sm text-neutral-500'>Project not found</p>
  const deployment = project.deployments.find((d) => d.name === params.deploymentId)
  if (!deployment) return <p className='text-sm text-neutral-500'>Deployment not found</p>
  const night = deployment.nights.find((n) => n.name === params.nightId)
  if (!night) return <p className='text-sm text-neutral-500'>Night not found</p>

  const photos = night.photos
  const patches = photos.flatMap((p) => p.patches)

  return (
    <div className='space-y-4'>
      <h2 className='text-lg font-semibold'>Patches for {night.name}</h2>
      {patches.length === 0 ? (
        <p className='text-sm text-neutral-500'>No patches found</p>
      ) : (
        <ul className='grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'>
          {patches.map((patch) => (
            <li key={patch.id} className='overflow-hidden rounded-md border bg-white'>
              <ImagePreview file={patch.imageFile.file} name={patch.name} />
              <div className='truncate px-2 py-1 text-xs text-neutral-600'>{patch.name}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ImagePreview(props: { file: File; name: string }) {
  const { file, name } = props
  const url = URL.createObjectURL(file)
  return <img src={url} alt={name} className='aspect-square w-full object-cover' onLoad={() => URL.revokeObjectURL(url)} />
}
