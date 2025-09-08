import { atom } from 'nanostores'
import fuzzysort from 'fuzzysort'
import { csvToObjects } from '~/utils/csv'
import { idbGet, idbPut } from '~/utils/index-db'

export type IndexedFile = {
  file: File
  path: string
  name: string
  size: number
}

// Darwin Core-aligned subset used by the app. We keep additional file columns under extras.
export type TaxonRecord = {
  taxonID?: string | number
  scientificName: string
  taxonRank?: string
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  species?: string
  vernacularName?: string
  // passthroughs (optional)
  acceptedTaxonKey?: string | number
  acceptedScientificName?: string
  iucnRedListCategory?: string
  // raw source row (non-strict) for future export/mapping
  extras?: Record<string, unknown>
}

export type SpeciesList = {
  id: string
  name: string
  sourcePath: string
  recordCount: number
  records: TaxonRecord[]
}

export const speciesListsStore = atom<Record<string, SpeciesList>>({})

// projectId -> speciesListId
export const projectSpeciesSelectionStore = atom<Record<string, string>>({})

const IDB_DB = 'mothbox-labeler'
const IDB_SELECTION = 'species-selection'

export async function saveProjectSpeciesSelection(params: { projectId: string; speciesListId: string }) {
  const { projectId, speciesListId } = params
  if (!projectId || !speciesListId) return
  const current = projectSpeciesSelectionStore.get() || {}
  const next = { ...current, [projectId]: speciesListId }
  projectSpeciesSelectionStore.set(next)
  await idbPut(IDB_DB, IDB_SELECTION, 'selection', next)
}

export async function loadProjectSpeciesSelection() {
  try {
    const saved = (await idbGet(IDB_DB, IDB_SELECTION, 'selection')) as Record<string, string> | null
    if (saved && typeof saved === 'object') projectSpeciesSelectionStore.set(saved)
  } catch {
    // ignore
  }
}

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
      const text = await f.file.text()
      const rows = csvToObjects({ csvContent: text, hasHeaders: true }) as any[]
      if (!Array.isArray(rows) || rows.length === 0) continue
      const records = rows.map((row) => mapRowToTaxonRecord(row)).filter((r) => !!r?.scientificName)

      // Dedupe by taxonID || scientificName
      const seen: Record<string, boolean> = {}
      const unique: TaxonRecord[] = []
      for (const r of records) {
        const key = String(r?.taxonID ?? r?.scientificName ?? '')
          .trim()
          .toLowerCase()
        if (!key || seen[key]) continue
        seen[key] = true
        unique.push(r)
      }

      const id = f?.name || f?.path
      const name = f?.name || f?.path
      lists[id] = { id, name, sourcePath: f.path, records: unique, recordCount: unique.length }
      // Invalidate any cached index for this list so it rebuilds lazily
      delete speciesIndexCache[id]
    } catch (err) {
      console.log('🚨 species: failed to parse species list', { path: f?.path, err })
    }
  }

  speciesListsStore.set(lists)
}

// Simple in-memory index with prepared strings for fast searching
type SpeciesIndexItem = { ref: TaxonRecord; search: any }
const speciesIndexCache: Record<string, SpeciesIndexItem[] | undefined> = {}

function ensureSpeciesIndexForList(list: SpeciesList | undefined): SpeciesIndexItem[] {
  if (!list) return []
  const cached = speciesIndexCache[list.id]
  if (cached) return cached
  const items: SpeciesIndexItem[] = []
  for (const r of list.records) {
    const combined = [r.scientificName, r.genus, r.family, r.order, r.vernacularName].filter(Boolean).join(' | ')
    const prepared = fuzzysort.prepare(combined)
    items.push({ ref: r, search: prepared })
  }
  speciesIndexCache[list.id] = items
  return items
}

export function searchSpecies(params: { speciesListId?: string; query: string; limit?: number }) {
  const { speciesListId, query, limit = 20 } = params
  const trimmed = (query ?? '').trim()
  if (!trimmed) return [] as TaxonRecord[]
  const allLists = speciesListsStore.get() || {}
  const list = speciesListId ? allLists[speciesListId] : undefined
  const index = ensureSpeciesIndexForList(list)
  if (!index.length) return []

  const results = fuzzysort.go(trimmed, index as any, {
    key: 'search' as any,
    limit,
    threshold: -10000,
  }) as unknown as Array<{ obj: SpeciesIndexItem }>

  const mapped: TaxonRecord[] = results.map((r) => r.obj.ref)
  return mapped
}

function mapRowToTaxonRecord(row: any): TaxonRecord {
  const scientificName = safeString(row?.scientificName) || ''
  const record: TaxonRecord = {
    taxonID: row?.taxonID ?? row?.taxonKey ?? undefined,
    scientificName,
    taxonRank: safeString(row?.taxonRank),
    kingdom: safeString(row?.kingdom),
    phylum: safeString(row?.phylum),
    class: safeString(row?.class),
    order: safeString(row?.order),
    family: safeString(row?.family),
    genus: safeString(row?.genus),
    species: safeString(row?.species),
    vernacularName: safeString(row?.vernacularName ?? row?.commonName),
    acceptedTaxonKey: row?.acceptedTaxonKey,
    acceptedScientificName: safeString(row?.acceptedScientificName),
    iucnRedListCategory: safeString(row?.iucnRedListCategory),
    extras: row,
  }
  return record
}

function safeString(v: unknown) {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}
