import { speciesListsStore, type SpeciesList } from '~/features/data-flow/2.identify/species-list.store'
import { invalidateSpeciesIndexForListId } from '~/features/data-flow/2.identify/species-search'
import { csvToObjects } from '~/utils/csv'
import type { IndexedFile as FolderIndexedFile } from './files.state'
import { stableTaxonKey } from '~/models/taxonomy/keys'
import type { TaxonRecord } from '~/models/taxonomy/types'
import { mapRowToTaxonRecords } from '~/models/taxonomy/csv-parser'

export type IndexedFile = FolderIndexedFile

export async function ingestSpeciesListsFromFiles(params: { files: IndexedFile[] }) {
  const { files } = params
  if (!files?.length) return

  const lists: Record<string, SpeciesList> = { ...(speciesListsStore.get() || {}) }

  for (const f of files) {
    const pathLower = (f?.path ?? '').replaceAll('\\', '/').toLowerCase()
    const isSpeciesFolder = pathLower.includes('/species/') || pathLower.startsWith('species/')
    const isCsv = pathLower.endsWith('.csv') || pathLower.endsWith('.tsv')
    if (!isSpeciesFolder || !isCsv) continue

    try {
      const rows = await readSpeciesCsvRows({ indexedFile: f })
      if (!Array.isArray(rows) || rows.length === 0) continue

      const records = rows.flatMap((row) => mapRowToTaxonRecords(row))

      const seen: Record<string, boolean> = {}
      const unique: TaxonRecord[] = []

      for (const r of records) {
        const key = stableTaxonKey(r)
        if (!key || seen[key]) continue
        seen[key] = true
        unique.push(r)
      }

      const id = f?.name || f?.path
      const fileName = f?.name || f?.path

      const baseName = fileName?.replace('SpeciesList_', '').replace('SpeciesList_', '.csv').split('_')
      const doi = baseName[2]
      const name = baseName[0] + ' - ' + baseName[1]

      lists[id] = {
        id,
        name,
        doi,
        fileName,
        sourcePath: f.path,
        records: unique,
        recordCount: unique.length,
      }

      invalidateSpeciesIndexForListId(id)
    } catch (err) {
      console.log('🚨 species: failed to parse species list', { path: f?.path, err })
    }
  }

  speciesListsStore.set(lists)
}

async function readSpeciesCsvRows(params: { indexedFile: IndexedFile }) {
  const { indexedFile } = params

  const file = indexedFile?.file || (await (indexedFile?.handle as any)?.getFile?.())
  if (!file) return [] as any[]

  const text = await file.text()
  if (!text) return [] as any[]

  const rows = csvToObjects({ csvContent: text, hasHeaders: true }) as any[]
  const result = Array.isArray(rows) ? rows : []
  return result
}
