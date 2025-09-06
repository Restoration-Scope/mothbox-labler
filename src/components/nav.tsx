import { useStore } from '@nanostores/react'
import { useIsMutating } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { Logo } from '~/components/logo'
import { Breadcrumbs } from '~/components/ui/breadcrumb'
import { deploymentsStore, nightsStore, projectsStore, sitesStore } from '~/stores/entities'
import { useOpenDirectoryMutation, useRestoreDirectoryQuery } from '~/features/folder-processing/files-queries'
import { Loader } from '~/components/atomic/Loader'
import { Button } from '~/components/ui/button'
import { clearSelections } from '~/features/folder-processing/files.service'
// removed isLoadingFoldersStore usage here; loading is derived in root layout

export function Nav() {
  const projects = useStore(projectsStore)
  const sites = useStore(sitesStore)
  const deployments = useStore(deploymentsStore)
  const nights = useStore(nightsStore)
  const { pathname } = useRouterState({ select: (s) => s.location })
  const breadcrumbs = getBreadcrumbs({ pathname, projects, sites, deployments, nights })

  const restoreQuery = useRestoreDirectoryQuery()

  const isOpening = useIsMutating({ mutationKey: ['fs', 'open'] }) > 0

  return (
    <header className='border-b bg-white'>
      <div className='flex flex-row items-center gap-4 px-20 py-3'>
        <Link to='/' className='text-xl font-semibold hover:opacity-80 mr-40'>
          <Logo size={32} />
        </Link>

        {breadcrumbs.length === 0 ? <FolderPicking /> : null}

        <div className='justify-self-center relative top-4'>{breadcrumbs.length ? <Breadcrumbs breadcrumbs={breadcrumbs} /> : null}</div>

        {restoreQuery.isLoading || isOpening ? (
          <div className='flex items-center gap-8 px-12 py-8 text-12 text-neutral-600 '>
            <Loader size={14} className='inline-block' />
            <span>{restoreQuery.isLoading ? '🌀 Restoring previously picked folder…' : '🌀 Processing selected folder…'}</span>
          </div>
        ) : null}
      </div>
    </header>
  )
}

function FolderPicking() {
  const openMutation = useOpenDirectoryMutation()

  function onClear() {
    clearSelections()
  }
  function onPick() {
    if (openMutation.isPending) return
    void openMutation.mutateAsync()
  }

  return (
    <section className='flex flex-wrap items-center gap-3'>
      <Button onClick={onPick} disabled={openMutation.isPending}>
        {openMutation.isPending ? (
          <span className='inline-flex items-center gap-6'>
            <Loader size={14} /> Processing…
          </span>
        ) : (
          'Pick projects folder'
        )}
      </Button>
      <Button onClick={onClear}>Clear</Button>
    </section>
  )
}

function getBreadcrumbs(params: {
  pathname: string
  projects: Record<string, { id: string; name: string }>
  sites: Record<string, { id: string; name: string }>
  deployments: Record<string, { id: string; name: string }>
  nights: Record<string, { id: string; name: string }>
}) {
  const { pathname, projects, sites, deployments, nights } = params
  const parts = (pathname ?? '').replace(/^\/+/, '').split('/').filter(Boolean)
  if (parts.length === 0) return []
  if (parts[0] !== 'projects') return []

  const items: Array<{ href?: string; label: string; entityName?: string }> = []
  if (parts.length === 1) return items

  const projectId = parts[1]
  if (!projectId) return items
  const projectName = projects?.[projectId]?.name ?? projectId
  items.push({ label: projectName, entityName: 'Project', href: `/projects/${projectId}/sites` })

  if (parts.length <= 3) return items
  const siteId = parts[3]

  if (!siteId) return items
  const siteKey = `${projectId}/${siteId}`
  const siteName = sites?.[siteKey]?.name ?? siteId
  items.push({ label: siteName, entityName: 'Site', href: `/projects/${projectId}/sites` })

  if (parts.length <= 5) return items
  const deploymentId = parts[5]

  if (!deploymentId) return items
  const depKey = `${projectId}/${siteId}/${deploymentId}`
  const deploymentName = deployments?.[depKey]?.name ?? deploymentId
  items.push({ label: deploymentName, entityName: 'Deployment', href: `/projects/${projectId}/sites/${siteId}/deployments` })

  if (parts.length <= 7) return items
  const nightId = parts[7]

  if (!nightId) return items
  const nightKey = `${projectId}/${siteId}/${deploymentId}/${nightId}`
  const nightName = nights?.[nightKey]?.name ?? nightId
  items.push({
    label: nightName,
    entityName: 'Night',
    href: `/projects/${projectId}/sites/${siteId}/deployments/${deploymentId}/nights/${nightId}`,
  })

  return items
}
