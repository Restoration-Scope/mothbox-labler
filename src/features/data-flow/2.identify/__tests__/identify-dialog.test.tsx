import { describe, it, expect } from 'vitest'
import { identifyDetection } from '~/features/data-flow/2.identify/identify'
import type { DetectionEntity } from '~/models/detection.types'
import type { TaxonRecord } from '~/models/taxonomy/types'

function createBaseDetection(): DetectionEntity {
  return {
    id: 'test-detection',
    patchId: 'test-patch',
    photoId: 'test-photo',
    nightId: 'test-night',
    detectedBy: 'auto',
  }
}

describe('IdentifyDialog - identification logic', () => {
  it('identifies detection with order taxon', () => {
    const detection = createBaseDetection()
    const taxon: TaxonRecord = {
      scientificName: 'Lepidoptera',
      taxonRank: 'order',
      order: 'Lepidoptera',
      taxonID: '12345',
    }

    const result = identifyDetection({
      detection,
      input: { type: 'taxon', taxon },
    })

    expect(result.changed).toBe(true)
    expect(result.skipped).toBe(false)
    expect(result.detection.taxon?.order).toBe('Lepidoptera')
    expect(result.detection.taxon?.taxonRank).toBe('order')
    expect(result.detection.taxon?.taxonID).toBe('12345')
    expect(result.detection.detectedBy).toBe('user')
    expect(result.detection.identifiedAt).toBeTruthy()
  })

  it('identifies detection with class taxon', () => {
    const detection = createBaseDetection()
    const taxon: TaxonRecord = {
      scientificName: 'Arachnida',
      taxonRank: 'class',
      class: 'Arachnida',
      taxonID: '67890',
    }

    const result = identifyDetection({
      detection,
      input: { type: 'taxon', taxon },
    })

    expect(result.changed).toBe(true)
    expect(result.skipped).toBe(false)
    expect(result.detection.taxon?.class).toBe('Arachnida')
    expect(result.detection.taxon?.taxonRank).toBe('class')
    expect(result.detection.taxon?.taxonID).toBe('67890')
    expect(result.detection.detectedBy).toBe('user')
  })

  it('identifies detection with genus taxon', () => {
    const detection = createBaseDetection()
    const taxon: TaxonRecord = {
      scientificName: 'Olinta',
      taxonRank: 'genus',
      genus: 'Olinta',
      taxonID: '11111',
    }

    const result = identifyDetection({
      detection,
      input: { type: 'taxon', taxon },
    })

    expect(result.changed).toBe(true)
    expect(result.skipped).toBe(false)
    expect(result.detection.taxon?.genus).toBe('Olinta')
    expect(result.detection.taxon?.taxonRank).toBe('genus')
    expect(result.detection.taxon?.taxonID).toBe('11111')
    expect(result.detection.detectedBy).toBe('user')
  })

  it('identifies detection with family taxon', () => {
    const detection = createBaseDetection()
    const taxon: TaxonRecord = {
      scientificName: 'Muscidae',
      taxonRank: 'family',
      family: 'Muscidae',
      taxonID: '22222',
    }

    const result = identifyDetection({
      detection,
      input: { type: 'taxon', taxon },
    })

    expect(result.changed).toBe(true)
    expect(result.skipped).toBe(false)
    expect(result.detection.taxon?.family).toBe('Muscidae')
    expect(result.detection.taxon?.taxonRank).toBe('family')
    expect(result.detection.taxon?.taxonID).toBe('22222')
    expect(result.detection.detectedBy).toBe('user')
  })

  it('identifies detection with tribe taxon', () => {
    const detection: DetectionEntity = {
      ...createBaseDetection(),
      taxon: { family: 'TestFamily' },
    }
    const taxon: TaxonRecord = {
      scientificName: 'TestTribe',
      taxonRank: 'tribe',
    }

    const result = identifyDetection({
      detection,
      input: { type: 'taxon', taxon },
    })

    expect(result.changed).toBe(true)
    expect(result.skipped).toBe(false)
    expect(result.detection.taxon?.taxonRank).toBe('tribe')
    expect(result.detection.taxon?.scientificName).toBe('TestTribe')
    expect(result.detection.detectedBy).toBe('user')
  })

  it('identifies detection with subfamily taxon', () => {
    const detection: DetectionEntity = {
      ...createBaseDetection(),
      taxon: { family: 'TestFamily' },
    }
    const taxon: TaxonRecord = {
      scientificName: 'TestSubfamily',
      taxonRank: 'subfamily',
    }

    const result = identifyDetection({
      detection,
      input: { type: 'taxon', taxon },
    })

    expect(result.changed).toBe(true)
    expect(result.skipped).toBe(false)
    expect(result.detection.taxon?.taxonRank).toBe('subfamily')
    expect(result.detection.taxon?.scientificName).toBe('TestSubfamily')
    expect(result.detection.detectedBy).toBe('user')
  })

  it('identifies detection with suborder taxon', () => {
    const detection: DetectionEntity = {
      ...createBaseDetection(),
      taxon: { order: 'Diptera' },
    }
    const taxon: TaxonRecord = {
      scientificName: 'TestSuborder',
      taxonRank: 'suborder',
    }

    const result = identifyDetection({
      detection,
      input: { type: 'taxon', taxon },
    })

    expect(result.changed).toBe(true)
    expect(result.skipped).toBe(false)
    expect(result.detection.taxon?.taxonRank).toBe('suborder')
    expect(result.detection.taxon?.scientificName).toBe('TestSuborder')
    expect(result.detection.detectedBy).toBe('user')
  })

  it('identifies detection with morphospecies label', () => {
    const detection: DetectionEntity = {
      ...createBaseDetection(),
      taxon: { order: 'Diptera', family: 'Muscidae' },
    }

    const result = identifyDetection({
      detection,
      input: { type: 'morphospecies', text: '111' },
    })

    expect(result.changed).toBe(true)
    expect(result.skipped).toBe(false)
    expect(result.detection.label).toBe('111')
    expect(result.detection.morphospecies).toBe('111')
    expect(result.detection.taxon?.order).toBe('Diptera')
    expect(result.detection.taxon?.family).toBe('Muscidae')
    expect(result.detection.detectedBy).toBe('user')
  })

  it('skips morphospecies when no parent taxonomy exists', () => {
    const detection = createBaseDetection()

    const result = identifyDetection({
      detection,
      input: { type: 'morphospecies', text: '111' },
    })

    expect(result.changed).toBe(false)
    expect(result.skipped).toBe(true)
    expect(result.skipReason).toContain('higher taxonomy context')
  })
})
