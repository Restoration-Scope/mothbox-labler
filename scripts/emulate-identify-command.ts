declare const process: { argv?: string[] }

import {
  speciesListsStore,
  projectSpeciesSelectionStore,
  searchSpecies,
  type TaxonRecord,
  type SpeciesList,
} from '../src/stores/species-lists.ts'

// Identify dialog model (no UI) using the real searchSpecies and stores
function buildIdentifyModel(params: { projectId: string; query: string; limit?: number }) {
  const { projectId, query, limit = 20 } = params

  const selectionId = (projectSpeciesSelectionStore.get() || {})?.[projectId]
  const species = selectionId ? searchSpecies({ speciesListId: selectionId, query, limit }) : []

  return { species }
}

// Seed data
function seedSpecies({ listId, records }: { listId: string; records: TaxonRecord[] }) {
  const list: SpeciesList = { id: listId, name: listId, sourcePath: `/Species/${listId}.csv`, recordCount: records.length, records }
  const current = speciesListsStore.get() || {}
  speciesListsStore.set({ ...current, [listId]: list })
}

function seedProjectSelection({ projectId, listId }: { projectId: string; listId: string }) {
  const current = projectSpeciesSelectionStore.get() || {}
  projectSpeciesSelectionStore.set({ ...current, [projectId]: listId })
}

async function main() {
  const projectId = 'project-1'
  const listId = 'test-list'
  const records: TaxonRecord[] = [
    { scientificName: 'Chloroscirtus', taxonRank: 'genus', genus: 'Chloroscirtus' },
    { scientificName: 'Eupithecia chlorosata', taxonRank: 'species', genus: 'Eupithecia', family: 'Geometridae' },
  ]
  seedSpecies({ listId, records })
  seedProjectSelection({ projectId, listId })

  const argv = Array.isArray(process?.argv) ? process.argv : []
  const query = argv[2] || 'Chloroscirtus'
  const model = buildIdentifyModel({ projectId, query })
  console.log('🏁 Identify species results for query', query)
  console.log('species.count', model.species.length)
  console.log('species.sample', model.species.slice(0, 5))
}

void main()
