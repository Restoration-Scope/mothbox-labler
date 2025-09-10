import { detectionsStore, type DetectionEntity } from '~/stores/entities/detections'
import { photosStore, type PhotoEntity } from '~/stores/entities/photos'
import { patchesStore, type PatchEntity } from '~/stores/entities/5.patches'
import { idbGet } from '~/utils/index-db'
import { fsaaWriteBytes, type FileSystemDirectoryHandleLike } from '~/utils/fsaa'
import { ensureReadWritePermission, persistenceConstants } from '~/features/folder-processing/files.persistence'
import { generateNightDarwinCSVString } from '~/features/export/darwin-csv'
import { zipSync, strToU8 } from 'fflate'

type ZipInput = { [path: string]: Uint8Array | string }

export async function exportNightSummaryRS(params: { nightId: string }) {
  const { nightId } = params
  if (!nightId) return
  console.log('🏁 exportNightSummaryRS: start', { nightId })

  const root = (await idbGet(
    persistenceConstants.IDB_NAME,
    persistenceConstants.IDB_STORE,
    'projectsRoot',
  )) as FileSystemDirectoryHandleLike | null
  if (!root) return

  const granted = await ensureReadWritePermission(root as any)
  if (!granted) return

  const csvGenerated = await generateNightDarwinCSVString({ nightId })
  if (!csvGenerated) return
  const { csv, nightDiskPath } = csvGenerated

  const zipEntries: ZipInput = {}
  zipEntries['darwin_export.csv'] = csv

  const allDetections = detectionsStore.get() || {}
  const allPatches = patchesStore.get() || {}
  const allPhotos = photosStore.get() || {}

  const identified = Object.values(allDetections).filter((d) => (d as any)?.nightId === nightId && (d as any)?.detectedBy === 'user')

  const bySpecies: Map<string, DetectionEntity> = new Map()
  for (const det of identified) {
    const speciesKey = getSpeciesKey(det)
    if (!speciesKey) continue
    if (!bySpecies.has(speciesKey)) bySpecies.set(speciesKey, det)
  }

  for (const [speciesKey, det] of bySpecies) {
    const patch = allPatches?.[det.patchId]
    const photo = allPhotos?.[det.photoId]
    const imageFile = patch?.imageFile?.file
    if (!imageFile) continue

    const safeName = buildExportImageName({ detection: det, speciesKey, patch, photo })
    const bytes = new Uint8Array(await imageFile.arrayBuffer())
    zipEntries[`images/${safeName}`] = bytes
  }

  const zipped = zipSync(zipEntries, { level: 6 })
  const pathParts = [...nightDiskPath.split('/').filter(Boolean), 'rs_summary.zip']
  await fsaaWriteBytes(root, pathParts, zipped)
  console.log('✅ exportNightSummaryRS: written file', { path: pathParts.join('/') })
}

function getSpeciesKey(d: DetectionEntity): string {
  const taxon = d?.taxon
  if (taxon?.scientificName) return taxon.scientificName
  const label = (d?.label ?? '').trim()
  if (label) return label
  return ''
}

function buildExportImageName(params: {
  detection: DetectionEntity
  speciesKey: string
  patch?: PatchEntity
  photo?: PhotoEntity
}): string {
  const { detection, speciesKey, patch } = params
  const id = detection?.id || patch?.id || ''
  const scientificName = detection?.taxon?.scientificName || speciesKey || 'unknown'
  const normalizedName = scientificName
    .replaceAll(/[^a-z0-9\-_. ]/gi, '_')
    .replaceAll(/\s+/g, '_')
    .slice(0, 120)
  const fileName = `${id}__${normalizedName}.jpg`
  return fileName
}
