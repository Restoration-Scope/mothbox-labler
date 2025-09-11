import { exportNightDarwinCSV } from '~/features/export/darwin-csv'
import { exportNightSummaryRS } from '~/features/export/rs-summary'
import type { NightEntity } from '~/stores/entities/4.nights'

export function exportScopeDarwinCSV(params: {
  scope: 'project' | 'site' | 'deployment' | 'night'
  id: string
  nights: Record<string, NightEntity>
}) {
  const { scope, id, nights } = params
  const nightIds = collectNightIdsForScope({ scope, id, nights })
  const tasks = nightIds.map((nightId) => exportNightDarwinCSV({ nightId }))
  const p = Promise.all(tasks).then(() => void 0)
  return p
}

export function exportScopeRS(params: {
  scope: 'project' | 'site' | 'deployment' | 'night'
  id: string
  nights: Record<string, NightEntity>
}) {
  const { scope, id, nights } = params
  const nightIds = collectNightIdsForScope({ scope, id, nights })
  const tasks = nightIds.map((nightId) => exportNightSummaryRS({ nightId }))
  const p = Promise.all(tasks).then(() => void 0)
  return p
}

export function collectNightIdsForScope(params: {
  scope: 'project' | 'site' | 'deployment' | 'night'
  id: string
  nights: Record<string, NightEntity>
}) {
  const { scope, id, nights } = params
  if (scope === 'night') return [id]
  if (scope === 'deployment')
    return Object.values(nights ?? {})
      .filter((n) => n.deploymentId === id)
      .map((n) => n.id)
  if (scope === 'site')
    return Object.values(nights ?? {})
      .filter((n) => n.siteId === id)
      .map((n) => n.id)
  if (scope === 'project')
    return Object.values(nights ?? {})
      .filter((n) => n.projectId === id)
      .map((n) => n.id)
  return []
}

