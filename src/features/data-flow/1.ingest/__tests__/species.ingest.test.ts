import { describe, it, expect } from 'vitest'
import { mapRowToTaxonRecords } from '~/models/taxonomy/csv-parser'
import type { TaxonRecord } from '~/features/data-flow/2.identify/species-list.store'

describe('species.ingest - mapRowToTaxonRecords', () => {
  describe('full taxonomy row (kingdom -> species)', () => {
    it('should create 7 records for a complete taxonomy row', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'Arthropoda',
        class: 'Insecta',
        order: 'Diptera',
        family: 'Muscidae',
        genus: 'Musca',
        species: 'domestica',
        scientificName: 'Musca domestica',
        taxonID: '12345',
      }

      const records = mapRowToTaxonRecords(row)

      expect(records).toHaveLength(7)
      expect(records.map((r) => r.taxonRank)).toEqual(['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'])
    })

    it('should only include fields up to rank for kingdom record', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'Arthropoda',
        class: 'Insecta',
        order: 'Diptera',
        family: 'Muscidae',
        genus: 'Musca',
        species: 'domestica',
      }

      const records = mapRowToTaxonRecords(row)
      const kingdomRecord = records.find((r) => r.taxonRank === 'kingdom')

      expect(kingdomRecord).toBeDefined()
      expect(kingdomRecord?.kingdom).toBe('Animalia')
      expect(kingdomRecord?.phylum).toBeUndefined()
      expect(kingdomRecord?.class).toBeUndefined()
      expect(kingdomRecord?.order).toBeUndefined()
      expect(kingdomRecord?.family).toBeUndefined()
      expect(kingdomRecord?.genus).toBeUndefined()
      expect(kingdomRecord?.species).toBeUndefined()
    })

    it('should only include fields up to rank for phylum record', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'Arthropoda',
        class: 'Insecta',
        order: 'Diptera',
        family: 'Muscidae',
        genus: 'Musca',
        species: 'domestica',
      }

      const records = mapRowToTaxonRecords(row)
      const phylumRecord = records.find((r) => r.taxonRank === 'phylum')

      expect(phylumRecord).toBeDefined()
      expect(phylumRecord?.kingdom).toBe('Animalia')
      expect(phylumRecord?.phylum).toBe('Arthropoda')
      expect(phylumRecord?.class).toBeUndefined()
      expect(phylumRecord?.order).toBeUndefined()
      expect(phylumRecord?.family).toBeUndefined()
      expect(phylumRecord?.genus).toBeUndefined()
      expect(phylumRecord?.species).toBeUndefined()
    })

    it('should only include fields up to rank for class record', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'Arthropoda',
        class: 'Insecta',
        order: 'Diptera',
        family: 'Muscidae',
        genus: 'Musca',
        species: 'domestica',
      }

      const records = mapRowToTaxonRecords(row)
      const classRecord = records.find((r) => r.taxonRank === 'class')

      expect(classRecord).toBeDefined()
      expect(classRecord?.kingdom).toBe('Animalia')
      expect(classRecord?.phylum).toBe('Arthropoda')
      expect(classRecord?.class).toBe('Insecta')
      expect(classRecord?.order).toBeUndefined()
      expect(classRecord?.family).toBeUndefined()
      expect(classRecord?.genus).toBeUndefined()
      expect(classRecord?.species).toBeUndefined()
    })

    it('should only include fields up to rank for order record', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'Arthropoda',
        class: 'Insecta',
        order: 'Diptera',
        family: 'Muscidae',
        genus: 'Musca',
        species: 'domestica',
      }

      const records = mapRowToTaxonRecords(row)
      const orderRecord = records.find((r) => r.taxonRank === 'order')

      expect(orderRecord).toBeDefined()
      expect(orderRecord?.kingdom).toBe('Animalia')
      expect(orderRecord?.phylum).toBe('Arthropoda')
      expect(orderRecord?.class).toBe('Insecta')
      expect(orderRecord?.order).toBe('Diptera')
      expect(orderRecord?.family).toBeUndefined()
      expect(orderRecord?.genus).toBeUndefined()
      expect(orderRecord?.species).toBeUndefined()
    })

    it('should only include fields up to rank for family record', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'Arthropoda',
        class: 'Insecta',
        order: 'Diptera',
        family: 'Muscidae',
        genus: 'Musca',
        species: 'domestica',
      }

      const records = mapRowToTaxonRecords(row)
      const familyRecord = records.find((r) => r.taxonRank === 'family')

      expect(familyRecord).toBeDefined()
      expect(familyRecord?.kingdom).toBe('Animalia')
      expect(familyRecord?.phylum).toBe('Arthropoda')
      expect(familyRecord?.class).toBe('Insecta')
      expect(familyRecord?.order).toBe('Diptera')
      expect(familyRecord?.family).toBe('Muscidae')
      expect(familyRecord?.genus).toBeUndefined()
      expect(familyRecord?.species).toBeUndefined()
    })

    it('should only include fields up to rank for genus record', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'Arthropoda',
        class: 'Insecta',
        order: 'Diptera',
        family: 'Muscidae',
        genus: 'Musca',
        species: 'domestica',
      }

      const records = mapRowToTaxonRecords(row)
      const genusRecord = records.find((r) => r.taxonRank === 'genus')

      expect(genusRecord).toBeDefined()
      expect(genusRecord?.kingdom).toBe('Animalia')
      expect(genusRecord?.phylum).toBe('Arthropoda')
      expect(genusRecord?.class).toBe('Insecta')
      expect(genusRecord?.order).toBe('Diptera')
      expect(genusRecord?.family).toBe('Muscidae')
      expect(genusRecord?.genus).toBe('Musca')
      expect(genusRecord?.species).toBeUndefined()
    })

    it('should include all fields for species record', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'Arthropoda',
        class: 'Insecta',
        order: 'Diptera',
        family: 'Muscidae',
        genus: 'Musca',
        species: 'domestica',
        scientificName: 'Musca domestica',
      }

      const records = mapRowToTaxonRecords(row)
      const speciesRecord = records.find((r) => r.taxonRank === 'species')

      expect(speciesRecord).toBeDefined()
      expect(speciesRecord?.kingdom).toBe('Animalia')
      expect(speciesRecord?.phylum).toBe('Arthropoda')
      expect(speciesRecord?.class).toBe('Insecta')
      expect(speciesRecord?.order).toBe('Diptera')
      expect(speciesRecord?.family).toBe('Muscidae')
      expect(speciesRecord?.genus).toBe('Musca')
      expect(speciesRecord?.species).toBe('domestica')
    })
  })

  describe('scientificName field', () => {
    it('should only set scientificName for species-level records', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'Arthropoda',
        class: 'Insecta',
        order: 'Diptera',
        family: 'Muscidae',
        genus: 'Musca',
        species: 'domestica',
        scientificName: 'Musca domestica',
      }

      const records = mapRowToTaxonRecords(row)

      const speciesRecord = records.find((r) => r.taxonRank === 'species')
      expect(speciesRecord?.scientificName).toBe('domestica')

      const classRecord = records.find((r) => r.taxonRank === 'class')
      expect(classRecord?.scientificName).toBe('')

      const orderRecord = records.find((r) => r.taxonRank === 'order')
      expect(orderRecord?.scientificName).toBe('')
    })

    it('should use species value for scientificName when scientificName field is missing', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'Arthropoda',
        class: 'Insecta',
        order: 'Diptera',
        family: 'Muscidae',
        genus: 'Musca',
        species: 'domestica',
      }

      const records = mapRowToTaxonRecords(row)
      const speciesRecord = records.find((r) => r.taxonRank === 'species')

      expect(speciesRecord?.scientificName).toBe('domestica')
    })
  })

  describe('partial taxonomy', () => {
    it('should only create records for present ranks', () => {
      const row = {
        class: 'Insecta',
        order: 'Diptera',
      }

      const records = mapRowToTaxonRecords(row)

      expect(records).toHaveLength(2)
      expect(records.map((r) => r.taxonRank)).toEqual(['class', 'order'])

      const classRecord = records.find((r) => r.taxonRank === 'class')
      expect(classRecord?.class).toBe('Insecta')
      expect(classRecord?.order).toBeUndefined()

      const orderRecord = records.find((r) => r.taxonRank === 'order')
      expect(orderRecord?.class).toBe('Insecta')
      expect(orderRecord?.order).toBe('Diptera')
    })

    it('should handle only class present', () => {
      const row = {
        class: 'Insecta',
      }

      const records = mapRowToTaxonRecords(row)

      expect(records).toHaveLength(1)
      expect(records[0]?.taxonRank).toBe('class')
      expect(records[0]?.class).toBe('Insecta')
      expect(records[0]?.order).toBeUndefined()
      expect(records[0]?.family).toBeUndefined()
      expect(records[0]?.genus).toBeUndefined()
      expect(records[0]?.species).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should normalize "NA" values to undefined', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: 'NA',
        class: 'Insecta',
        order: 'n/a',
        family: 'null',
        genus: 'Musca',
        species: 'domestica',
      }

      const records = mapRowToTaxonRecords(row)

      expect(records).toHaveLength(4)
      expect(records.map((r) => r.taxonRank)).toEqual(['kingdom', 'class', 'genus', 'species'])

      const classRecord = records.find((r) => r.taxonRank === 'class')
      expect(classRecord?.phylum).toBeUndefined()
      expect(classRecord?.order).toBeUndefined()
      expect(classRecord?.family).toBeUndefined()
    })

    it('should handle empty strings', () => {
      const row = {
        kingdom: 'Animalia',
        phylum: '',
        class: 'Insecta',
        order: '   ',
        family: 'Muscidae',
      }

      const records = mapRowToTaxonRecords(row)

      expect(records).toHaveLength(3)
      expect(records.map((r) => r.taxonRank)).toEqual(['kingdom', 'class', 'family'])

      const classRecord = records.find((r) => r.taxonRank === 'class')
      expect(classRecord?.phylum).toBeUndefined()
      expect(classRecord?.order).toBeUndefined()
    })

    it('should handle case-insensitive field names', () => {
      const row = {
        Kingdom: 'Animalia',
        PHYLUM: 'Arthropoda',
        Class: 'Insecta',
        order: 'Diptera',
      }

      const records = mapRowToTaxonRecords(row)

      expect(records).toHaveLength(4)
      const classRecord = records.find((r) => r.taxonRank === 'class')
      expect(classRecord?.kingdom).toBe('Animalia')
      expect(classRecord?.phylum).toBe('Arthropoda')
      expect(classRecord?.class).toBe('Insecta')
      expect(classRecord?.order).toBeUndefined()
    })
  })

  describe('other fields', () => {
    it('should preserve taxonID, taxonomicStatus, and other metadata fields', () => {
      const row = {
        kingdom: 'Animalia',
        class: 'Insecta',
        taxonID: '12345',
        taxonomicStatus: 'accepted',
        acceptedTaxonKey: '67890',
        iucnRedListCategory: 'LC',
      }

      const records = mapRowToTaxonRecords(row)

      expect(records.length).toBeGreaterThan(0)
      records.forEach((record) => {
        expect(record.taxonID).toBe('12345')
        expect(record.taxonomicStatus).toBe('accepted')
        expect(record.acceptedTaxonKey).toBe('67890')
        expect(record.iucnRedListCategory).toBe('LC')
      })
    })
  })
})

