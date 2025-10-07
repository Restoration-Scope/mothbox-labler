import { Outlet } from '@tanstack/react-router'
import { Nav } from '~/components/nav'
import { CenteredLoader } from '~/components/atomic/CenteredLoader'
import { useAppLoading } from '~/features/folder-processing/files-queries'
import { Toaster } from 'sonner'
import { UserInitialsDialog } from '~/components/user-initials-dialog'
import { ConfirmDialog } from '~/components/dialogs/ConfirmDialog'

export function RootLayout() {
  const { isLoading } = useAppLoading()
  return (
    <div className='min-h-screen max-h-screen flex flex-col overflow-hidden bg-neutral-50 text-neutral-900'>
      <Nav />

      <main className='flex flex-col flex-1 w-full h-full overflow-hidden'>
        {isLoading ? <CenteredLoader>🌀 Loading projects folder</CenteredLoader> : <Outlet />}
      </main>
      <Toaster />

      <UserInitialsDialog />
      <ConfirmDialog />
    </div>
  )
}
