import { incrementNightIngestProcessed } from '~/stores/ui'
import type { IndexedFile } from '~/stores/entities/photos'
import type { PhotoEntity } from '~/stores/entities/photos'
import type { PatchEntity } from '~/stores/entities/5.patches'
import type { DetectionEntity } from '~/stores/entities/detections'

import { extractNightDiskPathFromIndexedPath } from './ingest-paths'
import { extractPatchFilename, parseBotDetectionJsonSafely, parseUserDetectionJsonSafely } from './ingest-json'

export async function parseNightBotDetections(params: {
  photos: Record<string, PhotoEntity>
  files: IndexedFile[]
  patchMap?: Record<string, IndexedFile>
  parseDetectionsForNightId?: string | null
  patches: Record<string, PatchEntity>
  detections: Record<string, DetectionEntity>
}) {
  const { photos, files, patchMap, parseDetectionsForNightId, patches, detections } = params
  const targetNightId = typeof parseDetectionsForNightId === 'string' ? parseDetectionsForNightId : undefined
  const processedPatchIds = new Set<string>()

  for (const photo of Object.values(photos)) {
    if (parseDetectionsForNightId && photo.nightId !== parseDetectionsForNightId) continue
    const jsonFile = (photo as any)?.botDetectionFile as IndexedFile | undefined
    if (!jsonFile) continue

    const parsed = await parseBotDetectionJsonSafely({ file: jsonFile })
    if (!parsed) continue

    for (let i = 0; i < parsed.shapes.length; i++) {
      const shape = parsed.shapes[i] as any
      const patchFileName = extractPatchFilename({ patchPath: shape?.patch_path ?? '' })
      if (!patchFileName) continue
      const patchId = patchFileName
      const existingPatch = patches[patchId]

      const imageFileExisting = existingPatch?.imageFile
      const hasHydratedFile = !!(imageFileExisting as any)?.file
      const imageFile: IndexedFile | undefined = hasHydratedFile
        ? (imageFileExisting as any)
        : await (async () => {
            if (imageFileExisting) {
              const hydrated = await ensureFileHydrated(imageFileExisting as any)
              return hydrated as any
            }
            const found = await findPatchFileForPatchId({
              files,
              patchMap,
              patchId,
              nightDiskPath: extractNightDiskPathFromIndexedPath((jsonFile as any)?.path ?? ''),
            })
            return found as any
          })()

      patches[patchId] = {
        id: patchId,
        name: existingPatch?.name ?? patchId,
        nightId: photo.nightId,
        photoId: photo.id,
        imageFile: imageFile as any,
      } as any

      const detectionId = patchId
      const taxon = deriveTaxonFromShape(shape)

      detections[detectionId] = {
        id: detectionId,
        patchId,
        photoId: photo.id,
        nightId: photo.nightId,
        label: taxon?.scientificName || safeLabel(shape?.label),
        taxon,
        score: safeNumber(shape?.score),
        direction: safeNumber(shape?.direction),
        shapeType: safeLabel(shape?.shape_type),
        points: Array.isArray(shape?.points) ? (shape.points as any) : undefined,
        detectedBy: 'auto',
        clusterId: safeNumber(shape?.clusterID),
      } as any

      if (targetNightId && !processedPatchIds.has(patchId) && !!patches?.[patchId]?.imageFile) {
        processedPatchIds.add(patchId)
        incrementNightIngestProcessed({ nightId: targetNightId, by: 1 })
      }
    }
  }
}

export async function overlayNightUserDetections(params: {
  photos: Record<string, PhotoEntity>
  parseDetectionsForNightId?: string | null
  detections: Record<string, DetectionEntity>
}) {
  const { photos, parseDetectionsForNightId, detections } = params
  for (const photo of Object.values(photos)) {
    if (parseDetectionsForNightId && photo.nightId !== parseDetectionsForNightId) continue
    const userJson = (photo as any)?.userDetectionFile as IndexedFile | undefined
    if (!userJson) continue
    const parsedUser = await parseUserDetectionJsonSafely({ file: userJson })
    if (!parsedUser) continue
    if (Array.isArray(parsedUser.shapes)) {
      for (const s of parsedUser.shapes) {
        const shape = s as any
        const patchFileName = extractPatchFilename({ patchPath: shape?.patch_path ?? '' })
        if (!patchFileName) continue
        const detectionId = patchFileName
        const existing = detections[detectionId]
        const isError = (shape as any)?.is_error === true || String((shape as any)?.label || '').toUpperCase() === 'ERROR'
        const taxon = isError ? undefined : deriveTaxonFromShape(shape)
        const identifiedAt =
          typeof (shape as any)?.timestamp_ID_human === 'number'
            ? (shape as any).timestamp_ID_human
            : typeof (shape as any)?.human_identified_at === 'number'
            ? (shape as any).human_identified_at
            : (existing as any)?.identifiedAt
        const next: DetectionEntity = {
          id: detectionId,
          patchId: detectionId,
          photoId: (existing as any)?.photoId || (photo as any).id,
          nightId: (photo as any).nightId,
          label: isError ? 'ERROR' : taxon?.scientificName || safeLabel(shape?.label) || (existing as any)?.label,
          taxon: (taxon as any) ?? (isError ? undefined : (existing as any)?.taxon),
          score: (safeNumber(shape?.score) as any) ?? (existing as any)?.score,
          direction: (safeNumber(shape?.direction) as any) ?? (existing as any)?.direction,
          shapeType: (safeLabel(shape?.shape_type) as any) ?? (existing as any)?.shapeType,
          points: Array.isArray(shape?.points) ? (shape.points as any) : (existing as any)?.points,
          detectedBy: 'user',
          identifiedAt,
          clusterId: (safeNumber((shape as any)?.clusterID) as any) ?? (existing as any)?.clusterId,
          isError: isError ? true : undefined,
          morphospecies: !isError && !taxon?.scientificName ? safeLabel(shape?.label) ?? (existing as any)?.morphospecies : undefined,
        }
        detections[detectionId] = next
      }
    }
  }
}

async function findPatchFileForPatchId(params: {
  files: IndexedFile[]
  nightDiskPath: string
  patchId: string
  patchMap?: Record<string, IndexedFile>
}) {
  const { files, nightDiskPath, patchId, patchMap } = params
  if (!files?.length || !nightDiskPath || !patchId) return undefined
  const fromMap = patchMap?.[patchId.toLowerCase()]
  if (fromMap) return await ensureFileHydrated(fromMap)
  const normalizedNight = nightDiskPath.replaceAll('\\', '/').replace(/^\/+/, '').toLowerCase()
  const patchIdLower = patchId.toLowerCase()
  const expectedSuffixLower = `${normalizedNight}/patches/${patchIdLower}`
  for (const f of files) {
    const pathLower = (f?.path ?? '').replaceAll('\\', '/').toLowerCase()
    if (!pathLower) continue
    if (pathLower.endsWith(expectedSuffixLower)) return await ensureFileHydrated(f)
  }
  const trailingLower = `/patches/${patchIdLower}`
  for (const f of files) {
    const pathLower = (f?.path ?? '').replaceAll('\\', '/').toLowerCase()
    if (!pathLower) continue
    if (pathLower.endsWith(trailingLower)) {
      console.log('💡 ingest: fallback matched patch file', { patchId, path: (f as any).path })
      return await ensureFileHydrated(f)
    }
  }
  return undefined
}

async function ensureFileHydrated(fileLike: IndexedFile): Promise<IndexedFile> {
  const hasFile = !!(fileLike as any)?.file
  if (hasFile) return fileLike
  const handle = (fileLike as any)?.handle as { getFile?: () => Promise<File> } | undefined
  if (handle && typeof handle.getFile === 'function') {
    try {
      const file = await handle.getFile()
      const hydrated = { ...fileLike, file, name: file?.name ?? fileLike.name, size: file?.size ?? fileLike.size }
      return hydrated as any
    } catch {
      return fileLike
    }
  }
  return fileLike
}

function safeLabel(value: unknown) {
  return typeof value === 'string' ? value : undefined
}
function safeNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function deriveTaxonFromShape(shape: any) {
  const kingdom = safeLabel(shape?.kingdom)
  const phylum = safeLabel(shape?.phylum)
  const klass = safeLabel(shape?.class)
  const order = safeLabel(shape?.order)
  const family = safeLabel(shape?.family)
  const genus = safeLabel(shape?.genus)
  const species = safeLabel(shape?.species)

  let scientificName: string | undefined
  let taxonRank: string | undefined
  if (species) {
    scientificName = species
    taxonRank = 'species'
  } else if (genus) {
    scientificName = genus
    taxonRank = 'genus'
  } else if (family) {
    scientificName = family
    taxonRank = 'family'
  } else if (order) {
    scientificName = order
    taxonRank = 'order'
  } else if (klass) {
    scientificName = klass
    taxonRank = 'class'
  } else if (phylum) {
    scientificName = phylum
    taxonRank = 'phylum'
  } else if (kingdom) {
    scientificName = kingdom
    taxonRank = 'kingdom'
  } else {
    scientificName = undefined
    taxonRank = undefined
  }

  if (!scientificName && !kingdom && !phylum && !klass && !order && !family && !genus && !species) return undefined as any

  const taxon = {
    scientificName: scientificName || '',
    taxonRank,
    kingdom,
    phylum,
    class: klass,
    order,
    family,
    genus,
    species,
  } as any
  return taxon
}
