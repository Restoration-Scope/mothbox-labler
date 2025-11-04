import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies BEFORE importing the module under test
// Must match the exact import paths used in detections.ts
vi.mock('~/features/folder-processing/files.writer', async () => {
  return {
    scheduleSaveUserDetections: vi.fn(),
  }
})

vi.mock('~/stores/entities/night-summaries', async () => {
  return {
    nightSummariesStore: {
      get: vi.fn(() => ({})),
      set: vi.fn(),
    },
  }
})

vi.mock('~/features/species-identification/species-list.store', async () => {
  return {
    speciesListsStore: {
      get: vi.fn(() => ({})),
    },
  }
})

vi.mock('~/stores/species/project-species-list', async () => {
  return {
    projectSpeciesSelectionStore: {
      get: vi.fn(() => ({})),
    },
  }
})

// Import after mocks are set up
import { detectionsStore } from '../detections'
import { labelDetections } from '../detections'
import type { DetectionEntity } from '../detections'
import type { TaxonRecord } from '~/features/species-identification/species-list.store'

describe('Detection Identification Scenarios', () => {
  beforeEach(() => {
    detectionsStore.set({})
  })

  const BASE_DETECTION = {
    id: 'patch1',
    patchId: 'patch1',
    photoId: 'photo1',
    nightId: 'project/site/deployment/night1',
    detectedBy: 'auto' as const,
  } as const

  const BASE_TAXON = {
    kingdom: 'Animalia',
    phylum: 'Arthropoda',
    class: 'Insecta',
  } as const

  type TaxonRecordWithName = TaxonRecord & { name?: string }

  type Scenario = {
    name: string
    initial: DetectionEntity
    action: { label?: string; taxon?: TaxonRecord }
    expected: Partial<DetectionEntity & { taxon?: TaxonRecordWithName }>
  }

  const scenarios: Scenario[] = [
    // Scenario 1: Auto detection with order/family/genus context -> morphospecies
    {
      name: 'Create morphospecies from auto detection with taxonomic context',
      initial: {
        ...BASE_DETECTION,
        label: 'Diptera',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: undefined,
          genus: undefined,
          species: undefined,
          scientificName: 'Diptera',
          taxonRank: 'order',
        },
      },
      action: {
        label: 'Custom Morpho A',
      },
      expected: {
        label: 'Custom Morpho A',
        detectedBy: 'user',
        morphospecies: 'Custom Morpho A',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: undefined,
          genus: undefined,
          species: undefined,
          scientificName: 'Diptera',
          taxonRank: 'order',
          name: 'Custom Morpho A',
        },
      },
    },

    // Scenario 2: Morphospecies -> Add order/family/genus (should merge, preserving morphospecies)
    {
      name: 'Add order/family/genus to existing morphospecies (should merge and preserve morphospecies)',
      initial: {
        ...BASE_DETECTION,
        label: 'Custom Morpho A',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: undefined,
          genus: undefined,
          species: undefined,
          scientificName: 'Diptera',
          taxonRank: 'order',
        },
        detectedBy: 'user',
        morphospecies: 'Custom Morpho A',
      },
      action: {
        label: 'Lispe',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: 'Muscidae',
          genus: 'Lispe',
          species: undefined,
          scientificName: 'Lispe',
          taxonRank: 'genus',
        },
      },
      expected: {
        label: 'Lispe',
        detectedBy: 'user',
        morphospecies: 'Custom Morpho A', // Should preserve morphospecies
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera', // Should preserve/add order
          family: 'Muscidae', // Should add family
          genus: 'Lispe', // Should add genus
          species: undefined, // Should be undefined when genus is added
          scientificName: 'Lispe', // Should be genus name
          taxonRank: 'genus',
          name: 'Lispe Custom Morpho A', // Genus + morphospecies
        },
      },
    },

    // Scenario 3: Morphospecies -> Add family (should merge)
    {
      name: 'Add family to existing morphospecies (should merge)',
      initial: {
        ...BASE_DETECTION,
        label: 'Custom Morpho B',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: undefined,
          genus: undefined,
          species: 'Custom Morpho B',
          scientificName: 'Custom Morpho B',
          taxonRank: 'species',
        },
        detectedBy: 'user',
        morphospecies: 'Custom Morpho B',
      },
      action: {
        label: 'Tachinidae',
        taxon: {
          ...BASE_TAXON,
          order: undefined,
          family: 'Tachinidae',
          genus: undefined,
          species: undefined,
          scientificName: 'Tachinidae',
          taxonRank: 'family',
        },
      },
      expected: {
        label: 'Tachinidae',
        detectedBy: 'user',
        morphospecies: 'Custom Morpho B',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: 'Tachinidae',
          genus: undefined,
          species: 'Custom Morpho B',
          scientificName: 'Tachinidae',
          taxonRank: 'family',
          name: 'Custom Morpho B', // Morphospecies only (no genus)
        },
      },
    },

    // Scenario 4: Auto detection without context -> cannot create morphospecies
    {
      name: 'Cannot create morphospecies without taxonomic context',
      initial: {
        ...BASE_DETECTION,
        label: 'Unknown',
        taxon: undefined,
      },
      action: {
        label: 'Custom Morpho C',
      },
      expected: {
        // Should remain unchanged - no taxonomic context
        label: 'Unknown',
        detectedBy: 'auto',
        morphospecies: undefined,
        taxon: undefined,
      },
    },

    // Scenario 5: Morphospecies -> Replace with full species taxon (should clear morphospecies)
    {
      name: 'Replace morphospecies with full species taxon (should clear morphospecies)',
      initial: {
        ...BASE_DETECTION,
        label: 'Custom Morpho D',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: 'Muscidae',
          genus: undefined,
          species: 'Custom Morpho D',
          scientificName: 'Custom Morpho D',
          taxonRank: 'species',
        },
        detectedBy: 'user',
        morphospecies: 'Custom Morpho D',
      },
      action: {
        label: 'Musca domestica',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: 'Muscidae',
          genus: 'Musca',
          species: 'Musca domestica',
          scientificName: 'Musca domestica',
          taxonRank: 'species',
        },
      },
      expected: {
        label: 'Musca domestica',
        detectedBy: 'user',
        morphospecies: undefined, // Should clear morphospecies
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: 'Muscidae',
          genus: 'Musca',
          species: 'Musca domestica', // Note: species field contains full binomial
          scientificName: 'Musca domestica',
          taxonRank: 'species',
          name: 'Musca Musca domestica', // Function concatenates genus + species field as-is
        },
      },
    },

    // Scenario 6: Auto detection -> Mark as ERROR
    {
      name: 'Mark detection as ERROR',
      initial: {
        ...BASE_DETECTION,
        label: 'Diptera',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: undefined,
          genus: undefined,
          species: undefined,
          scientificName: 'Diptera',
          taxonRank: 'order',
        },
      },
      action: {
        label: 'ERROR',
      },
      expected: {
        label: 'ERROR',
        detectedBy: 'user',
        isError: true,
        morphospecies: undefined,
        taxon: undefined, // Should clear taxon
      },
    },

    // Scenario 7: Morphospecies with genus -> Add order (should merge)
    {
      name: 'Add order to morphospecies that already has genus',
      initial: {
        ...BASE_DETECTION,
        label: 'Lispe',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: 'Muscidae',
          genus: 'Lispe',
          species: 'Custom Morpho A',
          scientificName: 'Lispe',
          taxonRank: 'genus',
        },
        detectedBy: 'user',
        morphospecies: 'Custom Morpho A',
      },
      action: {
        label: 'Coleoptera',
        taxon: {
          ...BASE_TAXON,
          order: 'Coleoptera',
          family: undefined,
          genus: undefined,
          species: undefined,
          scientificName: 'Coleoptera',
          taxonRank: 'order',
        },
      },
      expected: {
        label: 'Coleoptera',
        detectedBy: 'user',
        morphospecies: 'Custom Morpho A',
        taxon: {
          ...BASE_TAXON,
          order: 'Coleoptera', // Should update order
          family: 'Muscidae', // Should preserve family
          genus: 'Lispe', // Should preserve genus
          species: 'Custom Morpho A', // Should preserve morphospecies
          scientificName: 'Coleoptera',
          taxonRank: 'order',
          name: 'Lispe Custom Morpho A', // Genus + morphospecies
        },
      },
    },

    // Scenario 8: Auto detection with only order -> morphospecies
    {
      name: 'Create morphospecies from auto detection with only order',
      initial: {
        ...BASE_DETECTION,
        label: 'Diptera',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: undefined,
          genus: undefined,
          species: undefined,
          scientificName: 'Diptera',
          taxonRank: 'order',
        },
      },
      action: {
        label: 'Custom Morpho E',
      },
      expected: {
        label: 'Custom Morpho E',
        detectedBy: 'user',
        morphospecies: 'Custom Morpho E',
        taxon: {
          ...BASE_TAXON,
          order: 'Diptera',
          family: undefined,
          genus: undefined,
          species: undefined,
          scientificName: 'Diptera',
          taxonRank: 'order',
          name: 'Custom Morpho E', // Morphospecies name, but taxon hierarchy preserved
        },
      },
    },

    // Scenario 9: Two-step identification flow (real-world scenario)
    // Step 1: Auto detection -> morphospecies
    {
      name: 'Step 1: Create morphospecies from auto detection (real-world flow)',
      initial: {
        ...BASE_DETECTION,
        label: 'Hymenoptera',
        taxon: {
          ...BASE_TAXON,
          order: 'Hymenoptera',
          family: undefined,
          genus: undefined,
          species: undefined,
          scientificName: 'Hymenoptera',
          taxonRank: 'order',
        },
      },
      action: {
        label: '111',
      },
      expected: {
        label: '111',
        detectedBy: 'user',
        morphospecies: '111',
        taxon: {
          ...BASE_TAXON,
          order: 'Hymenoptera',
          family: undefined,
          genus: undefined,
          species: undefined,
          scientificName: 'Hymenoptera',
          taxonRank: 'order',
          name: '111', // Morphospecies name, but taxon hierarchy preserved
        },
      },
    },

    // Scenario 10: Two-step identification flow (continuation)
    // Step 2: Add genus to existing morphospecies
    {
      name: 'Step 2: Add genus Lispe to morphospecies 111 (real-world flow)',
      initial: {
        ...BASE_DETECTION,
        label: '111',
        taxon: {
          ...BASE_TAXON,
          order: 'Hymenoptera',
          family: undefined,
          genus: undefined,
          species: '111',
          scientificName: '111',
          taxonRank: 'species',
        },
        detectedBy: 'user',
        morphospecies: '111',
      },
      action: {
        label: 'Lispe',
        taxon: {
          ...BASE_TAXON,
          order: undefined,
          family: undefined,
          genus: 'Lispe',
          species: undefined,
          scientificName: '', // Empty for genus level (after normalization) - will be set to genus name
          taxonRank: 'genus',
        },
      },
      expected: {
        label: 'Lispe',
        detectedBy: 'user',
        morphospecies: '111', // Should preserve morphospecies
        taxon: {
          ...BASE_TAXON,
          order: 'Hymenoptera', // Should preserve existing order
          family: undefined,
          genus: 'Lispe', // Should add new genus
          species: undefined, // Should be undefined when genus is added
          scientificName: 'Lispe', // Should be set to genus name
          taxonRank: 'genus',
          name: 'Lispe 111', // Genus + morphospecies
        },
      },
    },
  ]

  scenarios.forEach((scenario) => {
    it(scenario.name, () => {
      const initialStore: Record<string, DetectionEntity> = {
        [scenario.initial.id]: scenario.initial as DetectionEntity,
      }
      detectionsStore.set(initialStore)

      labelDetections({
        detectionIds: [scenario.initial.id],
        label: scenario.action.label,
        taxon: scenario.action.taxon,
      })

      const result = detectionsStore.get()[scenario.initial.id]

      // Check label
      if (scenario.expected.label !== undefined) {
        expect(result.label).toBe(scenario.expected.label)
      }

      // Check detectedBy
      if (scenario.expected.detectedBy !== undefined) {
        expect(result.detectedBy).toBe(scenario.expected.detectedBy)
      }

      // Check isError
      if (scenario.expected.isError !== undefined) {
        expect(result.isError).toBe(scenario.expected.isError)
      }

      // Check morphospecies
      if (scenario.expected.morphospecies !== undefined) {
        expect(result.morphospecies).toBe(scenario.expected.morphospecies)
      }

      // Check taxon
      if (scenario.expected.taxon !== undefined) {
        expect(result.taxon).toBeDefined()
        if (scenario.expected.taxon === null) {
          expect(result.taxon).toBeNull()
        } else {
          const expectedTaxon = scenario.expected.taxon as TaxonRecordWithName
          expect(result.taxon).toMatchObject(expectedTaxon)
        }
      } else if (scenario.expected.taxon === null) {
        expect(result.taxon).toBeUndefined()
      }

      // Check identifiedAt is set when detectedBy is 'user'
      if (scenario.expected.detectedBy === 'user') {
        expect(result.identifiedAt).toBeDefined()
        expect(typeof result.identifiedAt).toBe('number')
      }
    })
  })
})
