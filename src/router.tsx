import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { Projects } from './routes/1.projects'
import { Sites } from './routes/2.sites'
import { Deployments } from './routes/3.deployments'
import { Nights } from './routes/4.nights'
import { Night } from './routes/5.night'
import { TestIdentification } from './routes/test-identification'
import { RootLayout } from '~/root-layout'
import { Home } from '~/routes/0.home'

export const rootRoute = createRootRoute({
  component: RootLayout,
})

export const indexRoute = createRoute({
  getParentRoute,
  path: '/',
  component: Home,
})

export const projectsRoute = createRoute({
  getParentRoute,
  path: '/projects',
  component: Projects,
})

export const sitesRoute = createRoute({
  getParentRoute,
  path: '/projects/$projectId/sites',
  component: Sites,
})

export const deploymentsRoute = createRoute({
  getParentRoute,
  path: '/projects/$projectId/sites/$siteId/deployments',
  component: Deployments,
})

export const nightsRoute = createRoute({
  getParentRoute,
  path: '/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights',
  component: Nights,
})

export const nightRoute = createRoute({
  getParentRoute,
  path: '/projects/$projectId/sites/$siteId/deployments/$deploymentId/nights/$nightId',
  component: Night,
})

export const testIdentificationRoute = createRoute({
  getParentRoute,
  path: '/test-identification',
  component: TestIdentification,
})

export const routeTree = rootRoute.addChildren([
  indexRoute,
  projectsRoute,
  sitesRoute,
  deploymentsRoute,
  nightsRoute,
  nightRoute,
  testIdentificationRoute,
])

export const router = createRouter({
  routeTree,
  basepath: '/',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function getParentRoute() {
  const parent = rootRoute
  return parent
}
