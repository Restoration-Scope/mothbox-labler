/**
 * Accept detection business logic.
 * Validates detections and finds matching order taxon from species list.
 */

import type { DetectionEntity } from '~/models/detection.types'
import type { TaxonRecord } from '~/models/taxonomy/types'
import { searchSpecies } from './species-search'
import { getProjectIdFromNightId } from '~/utils/paths'

export type AcceptValidationError = {
  detectionId: string
  message: string
}

export type AcceptGroupedByOrder = {
  ids: string[]
  order: string
  speciesListId: string
}

export type AcceptResult = {
  groupedByOrder: AcceptGroupedByOrder[]
  errors: AcceptValidationError[]
}

/**
 * Validates detections for acceptance and groups them by order.
 * Returns grouped detections and validation errors.
 */
export function validateAndGroupDetectionsForAccept(params: {
  detectionIds: string[]
  detections: Record<string, DetectionEntity>
  selectionByProject: Record<string, string | undefined>
}): AcceptResult {
  const { detectionIds, detections, selectionByProject } = params

  const errors: AcceptValidationError[] = []
  const detectionsByOrder = new Map<string, AcceptGroupedByOrder>()

  for (const id of detectionIds) {
    const existing = detections?.[id]
    if (!existing) continue

    const order = existing?.taxon?.order
    if (!order) {
      errors.push({ detectionId: id, message: 'Cannot accept: detection missing order' })
      continue
    }

    const projectId = getProjectIdFromNightId(existing?.nightId)
    const speciesListId = projectId ? selectionByProject?.[projectId] : undefined

    if (!speciesListId) {
      errors.push({ detectionId: id, message: `Cannot accept: no species list selected for project` })
      continue
    }

    const key = `${speciesListId}:${order}`
    const group = detectionsByOrder.get(key)
    if (group) {
      group.ids.push(id)
    } else {
      detectionsByOrder.set(key, { ids: [id], order, speciesListId })
    }
  }

  const groupedByOrder = Array.from(detectionsByOrder.values())

  return { groupedByOrder, errors }
}

export type ResolveOrderTaxonResult = {
  taxon: TaxonRecord | null
  errorIds: string[]
  errorMessage?: string
}

/**
 * Resolves the order taxon from the species list.
 * Returns the taxon or error information.
 */
export function resolveOrderTaxonFromSpeciesList(params: { group: AcceptGroupedByOrder }): ResolveOrderTaxonResult {
  const { group } = params
  const { ids, order, speciesListId } = group

  const searchResults = searchSpecies({ speciesListId, query: order, limit: 1 })

  if (!searchResults || searchResults.length === 0) {
    return {
      taxon: null,
      errorIds: ids,
      errorMessage: `Cannot accept: order '${order}' not found in species list`,
    }
  }

  const orderTaxon = searchResults[0]
  if (!orderTaxon) {
    return {
      taxon: null,
      errorIds: ids,
      errorMessage: `Cannot accept: order '${order}' not found in species list`,
    }
  }

  return { taxon: orderTaxon, errorIds: [] }
}


