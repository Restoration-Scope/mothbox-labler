export type NightWarnings = {
  jsonWithoutPhotoCount?: number
  missingPatchImageCount?: number
}

export type TaxonomyNode = {
  rank: 'order' | 'family' | 'genus' | 'species'
  name: string
  count: number
  children?: TaxonomyNode[]
}

export type NightLeftPanelProps = {
  taxonomyAuto?: TaxonomyNode[]
  taxonomyUser?: TaxonomyNode[]
  totalPatches: number
  totalDetections: number
  totalIdentified?: number
  selectedTaxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }
  selectedBucket?: 'auto' | 'user'
  onSelectTaxon: (params: { taxon?: { rank: 'order' | 'family' | 'genus' | 'species'; name: string }; bucket: 'auto' | 'user' }) => void
  warnings?: NightWarnings
  className?: string
}
