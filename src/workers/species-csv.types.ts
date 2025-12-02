import type { TaxonRecord } from '~/models/taxonomy/types'

export type SpeciesCsvWorkerRequest = {
  requestId: string
  csvText: string
  fileId: string
  fileName: string
  sourcePath: string
}

export type SpeciesCsvWorkerResponse = {
  requestId: string
  id: string
  name: string
  doi: string
  fileName: string
  sourcePath: string
  records: TaxonRecord[]
  recordCount: number
}
