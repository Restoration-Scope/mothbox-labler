import { Outlet } from '@tanstack/react-router'
import { Nav } from '~/components/nav'

export function RootLayout() {
  return (
    <div className='min-h-screen max-h-screen flex flex-col overflow-hidden bg-neutral-50 text-neutral-900'>
      <Nav />

      <main className='flex flex-col w-full h-full overflow-hidden'>
        <Outlet />
      </main>
    </div>
  )
}
