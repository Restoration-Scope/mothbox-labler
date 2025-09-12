import fuzzysort from 'fuzzysort'

type TaxonRecord = {
  scientificName: string
  taxonRank?: string
  order?: string
  family?: string
  genus?: string
  species?: string
  vernacularName?: string
}

type SpeciesIndexItem = { ref: TaxonRecord; search: any }

function buildIndex(records: TaxonRecord[]): SpeciesIndexItem[] {
  return records.map((r) => {
    const combined = [r.scientificName, r.genus, r.family, r.order, r.vernacularName].filter(Boolean).join(' | ')
    const prepared = fuzzysort.prepare(combined)
    return { ref: r, search: prepared }
  })
}

function search(index: SpeciesIndexItem[], query: string, limit = 20): TaxonRecord[] {
  const results = fuzzysort.go(query.trim(), index as any, { key: 'search' as any, limit, threshold: -10000 }) as unknown as Array<{
    obj: SpeciesIndexItem
  }>
  return results.map((r) => r.obj.ref)
}

function seedRecords(): TaxonRecord[] {
  // Case 1: scientificName present and equals genus
  const r1: TaxonRecord = { scientificName: 'Chloroscirtus', taxonRank: 'genus', genus: 'Chloroscirtus' }
  // Case 2: scientificName missing, only genus provided (our ingestion now falls back to genus)
  const r2: TaxonRecord = { scientificName: 'Chloroscirtus', taxonRank: 'genus', genus: 'Chloroscirtus' }
  return [r1, r2]
}

async function main() {
  const records = seedRecords()
  const index = buildIndex(records)
  const queries = ['Chloroscirtus', 'chloroscirtus', 'Chloro']
  for (const q of queries) {
    const res = search(index, q, 10)
    console.log('✅ query', q, '→ count', res.length, 'first', res[0]?.scientificName)
  }
}

void main()
