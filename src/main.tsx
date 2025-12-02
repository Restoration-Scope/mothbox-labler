import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setMeta } from './utils/meta'

const rootElement = document.getElementById('root')!
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})

setMeta({
  title: 'Mothbox Classify',
  siteName: 'Mothbox Classify',
  description: 'Local app to review and label MothBox insect detections per night.',
  image: '/mothbox.svg',
  url: '/',
})

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
