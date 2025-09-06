import { Outlet } from '@tanstack/react-router'
import { Nav } from '~/components/nav'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { useRestoreDirectoryQuery } from '~/features/folder-processing/files-queries'
import { useIsMutating } from '@tanstack/react-query'

export function RootLayout() {
  const restoreQuery = useRestoreDirectoryQuery()
  const isOpening = useIsMutating({ mutationKey: ['fs', 'open'] }) > 0
  const isLoading = restoreQuery.isLoading || isOpening
  return (
    <div className='min-h-screen max-h-screen flex flex-col overflow-hidden bg-neutral-50 text-neutral-900'>
      <Nav />

      <main className='flex flex-col flex-1 w-full h-full overflow-hidden'>
        {isLoading ? <CenteredLoader>🌀 Loading projects folder</CenteredLoader> : <Outlet />}
      </main>
    </div>
  )
}
