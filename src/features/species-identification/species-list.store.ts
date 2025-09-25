import { atom } from 'nanostores'

export type SpeciesList = {
  id: string
  fileName: string
  name: string
  doi: string
  sourcePath: string
  recordCount: number
  records: TaxonRecord[]
}

export const speciesListsStore = atom<Record<string, SpeciesList>>({})

export type TaxonRecord = {
  taxonID?: string | number
  scientificName: string
  taxonRank?: string
  taxonomicStatus?: string
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  species?: string
  vernacularName?: string

  acceptedTaxonKey?: string | number
  acceptedScientificName?: string
  iucnRedListCategory?: string
  extras?: Record<string, unknown>
}
