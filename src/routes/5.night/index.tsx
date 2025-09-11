import { useStore } from '@nanostores/react'
import { useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
//
import { nightsStore } from '~/stores/entities/4.nights'
//
import { nightIngestProgressStore } from '~/stores/ui'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { useAppLoading } from '~/features/folder-processing/files-queries'
import { NightView } from './night-view'
import { useNightIngest } from './use-night-ingest'

export function Night() {
  const params = useParams({ from: '/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId' })
  const nights = useStore(nightsStore)
  const { isLoading: isLoadingFolders } = useAppLoading()

  const ingestProgress = useStore(nightIngestProgressStore)
  const [isNightIngesting, setIsNightIngesting] = useState(false)

  const nightId = `${params.projectId}/${params.siteId}/${params.deploymentId}/${params.nightId}`
  const night = nights[nightId]

  const ingestState = useNightIngest({ nightId })
  useEffect(() => {
    setIsNightIngesting(ingestState.isNightIngesting)
  }, [ingestState.isNightIngesting])

  const isNightLoading = isLoadingFolders || isNightIngesting

  if (isNightLoading) {
    const processed = ingestProgress?.processed ?? 0
    const total = ingestProgress?.total ?? 0
    console.log('🧪 night: loader progress snapshot', { nightId, processed, total, ingestProgress })
    return (
      <CenteredLoader>
        🌀 Processing patches {processed}/{total}
      </CenteredLoader>
    )
  }

  if (!night) return <p className='text-sm text-neutral-500'>Night not found</p>

  return <NightView nightId={nightId} />
}
