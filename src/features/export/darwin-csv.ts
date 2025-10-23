import { detectionsStore, type DetectionEntity } from '~/stores/entities/detections'
import { photosStore, type PhotoEntity } from '~/stores/entities/photos'
import { patchesStore, type PatchEntity } from '~/stores/entities/5.patches'
import { idbGet } from '~/utils/index-db'
import { objectsToCSV } from '~/utils/csv'
import { fsaaWriteText, type FileSystemDirectoryHandleLike } from '~/utils/fsaa'
import { ensureReadWritePermission, persistenceConstants } from '~/features/folder-processing/files.persistence'

/**
add a new column:
- name: the deepest taxonomic level that was identifed as. If it was kingdom animalia, jsut animalia. If it was family "so and so" then it shoudl be that.  OR if it's morphospecies then it's that . Unless there's a genus and species. theen it hsoudl be `{genus} {species}`


 */

const SOFTWARE_NAME = 'Mothbeam v2'

const DARWIN_COLUMNS = [
  'basisOfRecord',
  'datasetID',
  'parentEventID',
  'eventID',
  'occurrenceID',
  'verbatimEventDate',
  'eventDate',
  'eventTime',
  'UTCOFFSET',
  'detectionBy',
  'detection_confidence',
  'identifiedBy',
  'ID_confidence',
  'kingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species',
  'taxonID',
  'taxonKey',
  'commonName',
  'scientificName',
  'species_list',
  'filepath',
  'mothbox',
  'software',
  'sheet',
  'country',
  'area',
  'point',
  'latitude',
  'longitude',
  'ground_height',
  'deployment_name',
  'deployment_date',
  'collect_date',
  'data_storage_location',
  'crew',
  'notes',
  'schedule',
  'habitat',
  'image_id',
  'label',
  'bbox',
  'segmentation',
  'attractor',
  'attractor_location',
] as const

type DarwinColumn = (typeof DARWIN_COLUMNS)[number]
type DarwinRow = Record<DarwinColumn, string>

export async function exportNightDarwinCSV(params: { nightId: string }): Promise<boolean> {
  const { nightId } = params
  if (!nightId) return false
  console.log('🏁 exportNightDarwinCSV: start', { nightId })

  const root = (await idbGet(
    persistenceConstants.IDB_NAME,
    persistenceConstants.IDB_STORE,
    'projectsRoot',
  )) as FileSystemDirectoryHandleLike | null
  if (!root) return false

  const granted = await ensureReadWritePermission(root as any)
  if (!granted) return false

  const generated = await generateNightDarwinCSVString({ nightId })
  if (!generated) return false
  const { csv, nightDiskPath } = generated

  const fileName = buildNightExportFileName({ nightId })
  const pathParts = [...nightDiskPath.split('/').filter(Boolean), fileName]
  await fsaaWriteText(root, pathParts, csv)
  console.log('✅ exportNightDarwinCSV: written file', { path: pathParts.join('/') })
  return true
}

export async function openNightFolderPicker(params: { nightId: string }): Promise<boolean> {
  const { nightId } = params
  if (!nightId) return false

  const root = (await idbGet(
    persistenceConstants.IDB_NAME,
    persistenceConstants.IDB_STORE,
    'projectsRoot',
  )) as FileSystemDirectoryHandleLike | null
  if (!root) return false

  const granted = await ensureReadWritePermission(root as any)
  if (!granted) return false

  const allPhotos = photosStore.get() || {}
  const photos = Object.values(allPhotos).filter((p) => (p as any)?.nightId === nightId)
  if (!photos.length) return false

  const nightDiskPath = getNightDiskPathFromAnyPhoto({ photos })
  if (!nightDiskPath) return false

  const dirParts = nightDiskPath.split('/').filter(Boolean)

  let current: FileSystemDirectoryHandleLike | null = root
  for (const part of dirParts) {
    const next = (await current?.getDirectoryHandle?.(part, { create: false })) as FileSystemDirectoryHandleLike | null
    if (!next) return false
    current = next
  }

  const canShow = typeof (window as unknown as { showDirectoryPicker?: unknown })?.showDirectoryPicker === 'function'
  if (!canShow) return false

  try {
    // @ts-expect-error: startIn can accept a FileSystemHandle; TS lib may be behind
    await window.showDirectoryPicker?.({ startIn: current as any })
    return true
  } catch {
    return false
  }
}

export async function copyNightFolderPathToClipboard(params: { nightId: string }): Promise<boolean> {
  const { nightId } = params
  if (!nightId) return false

  const allPhotos = photosStore.get() || {}
  const photos = Object.values(allPhotos).filter((p) => (p as any)?.nightId === nightId)
  if (!photos.length) return false

  const nightDiskPath = getNightDiskPathFromAnyPhoto({ photos })
  if (!nightDiskPath) return false

  const ok = await writeTextToClipboard(nightDiskPath)
  console.log(ok ? '📋 Copied night folder path' : '🚨 Failed to copy folder path', { nightDiskPath })
  return ok
}

export async function copyNightExportFilePathToClipboard(params: { nightId: string }): Promise<boolean> {
  const { nightId } = params
  if (!nightId) return false

  const allPhotos = photosStore.get() || {}
  const photos = Object.values(allPhotos).filter((p) => (p as any)?.nightId === nightId)
  if (!photos.length) return false

  const nightDiskPath = getNightDiskPathFromAnyPhoto({ photos })
  if (!nightDiskPath) return false

  const fileName = buildNightExportFileName({ nightId })
  const fullPath = [...nightDiskPath.split('/').filter(Boolean), fileName].join('/')

  const ok = await writeTextToClipboard(fullPath)
  console.log(ok ? '📋 Copied export file path' : '🚨 Failed to copy export file path', { fullPath })
  return ok
}

async function writeTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator?.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    console.error('Error writing text to clipboard')
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    textarea.remove()
    return success
  } catch {
    return false
  }
}

export async function generateNightDarwinCSVString(params: { nightId: string }): Promise<{ csv: string; nightDiskPath: string } | null> {
  const { nightId } = params
  if (!nightId) return null

  const allDetections = detectionsStore.get() || {}
  const allPhotos = photosStore.get() || {}
  const allPatches = patchesStore.get() || {}

  const detections = Object.values(allDetections).filter((d) => (d as any)?.nightId === nightId)

  const photos = Object.values(allPhotos).filter((p) => (p as any)?.nightId === nightId)
  if (!photos.length) return null

  const nightDiskPath = getNightDiskPathFromAnyPhoto({ photos })
  if (!nightDiskPath) return null

  const rowObjs: DarwinRow[] = []
  for (const d of detections) {
    const patch = allPatches[d.patchId]
    const photo = allPhotos[d.photoId]
    const rowObj = buildDarwinRowObject({ detection: d, patch, photo, nightId, nightDiskPath })
    rowObjs.push(rowObj)
  }

  const csv = objectsToCSV({ objects: rowObjs as any[], headers: [...(DARWIN_COLUMNS as readonly string[])] as string[] })
  return { csv, nightDiskPath }
}

function buildNightExportFileName(params: { nightId: string }): string {
  const { nightId } = params
  const parts = (nightId || '').split('/').filter(Boolean)
  // Expected: [project, site?, deployment, night]
  const project = parts[0] || 'dataset'
  const deployment = parts.length >= 4 ? parts[2] : parts[1] || 'deployment'
  const night = parts[parts.length - 1] || 'night'

  const datasetName = sanitizeForFileName(project)
  const deploymentName = sanitizeForFileName(deployment)
  const nightName = sanitizeForFileName(night)
  const today = formatTodayYyyyMm_Dd()

  const fileName = `${datasetName}_${deploymentName}_${nightName}_exported-${today}.csv`
  return fileName
}

function sanitizeForFileName(input: string): string {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return 'unnamed'
  // Replace spaces with underscore and strip characters that are problematic in file names
  const replaced = trimmed.replace(/\s+/g, '_')
  const cleaned = replaced.replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned
}

function formatTodayYyyyMm_Dd(): string {
  const d = new Date()
  const yyyy = String(d.getFullYear())
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const DD = String(d.getDate()).padStart(2, '0')
  // Spec: YYYY-MM_DD
  const res = `${yyyy}-${MM}_${DD}`
  return res
}

function buildDarwinRowObject(params: {
  detection: DetectionEntity
  patch?: PatchEntity
  photo?: PhotoEntity
  nightId: string
  nightDiskPath: string
}): DarwinRow {
  const { detection, patch, photo, nightId, nightDiskPath } = params
  const baseName = getPhotoBaseFromPhotoId(photo?.id || '')
  const verbatimEventDate = extractVerbatimEventDateFromPhotoBase({ baseName })
  const { eventDate, eventTime, utcOffset } = deriveEventDateTime({ verbatimEventDate })
  const filepath = patch?.imageFile?.path || ''
  const image_id = patch?.id || ''
  const label = detection?.taxon?.scientificName || detection?.label || ''
  const scientificName = label
  const kingdom = 'Animalia'
  const phylum = 'Arthropoda'
  const klass = 'Insecta'
  const order = detection?.taxon?.order || ''
  const family = detection?.taxon?.family || ''
  const genus = detection?.taxon?.genus || ''
  const species = ''
  const taxonID = String((detection as any)?.taxon?.taxonID || '')
  const taxonKey = String((detection as any)?.taxon?.acceptedTaxonKey ?? (detection as any)?.taxon?.taxonID ?? '')
  const commonName = detection?.taxon?.vernacularName || ''
  const species_list = String((detection as any)?.speciesListDOI || '')

  const datasetID = nightId.replaceAll('/', '_')
  const parentEventID = datasetID
  const eventID = photo?.id || ''
  const occurrenceID = patch?.id || ''

  const mothbox = extractMothboxFromNightDiskPath({ nightDiskPath })
  const software = SOFTWARE_NAME
  const detectionBy = extractDetectionByFromPatchId({ patchId: patch?.id || '', photoBase: baseName })
  const detection_confidence = detection?.score != null ? String(detection.score) : ''
  const identifiedBy = detection?.detectedBy === 'user' ? 'user' : ''
  const ID_confidence = ''

  const row: DarwinRow = {
    basisOfRecord: 'MachineObservation',
    datasetID,
    parentEventID,
    eventID,
    occurrenceID,
    verbatimEventDate,
    eventDate,
    eventTime,
    UTCOFFSET: utcOffset,
    detectionBy,
    detection_confidence,
    identifiedBy,
    ID_confidence,
    kingdom,
    phylum,
    class: klass,
    order,
    family,
    genus,
    species,
    taxonID,
    taxonKey,
    commonName,
    scientificName,
    species_list,
    filepath,
    mothbox,
    software,
    sheet: '',
    country: '',
    area: '',
    point: '',
    latitude: '',
    longitude: '',
    ground_height: '',
    deployment_name: '',
    deployment_date: '',
    collect_date: '',
    data_storage_location: '',
    crew: '',
    notes: '',
    schedule: '',
    habitat: '',
    image_id,
    label,
    bbox: '',
    segmentation: '',
    attractor: '',
    attractor_location: '',
  }
  return row
}

// FSAA writer moved to utils/fsaa.ts

function getNightDiskPathFromAnyPhoto(params: { photos: PhotoEntity[] }): string {
  const { photos } = params
  for (const p of photos) {
    const path = (p as any)?.imageFile?.path || (p as any)?.botDetectionFile?.path
    if (!path) continue
    const norm = String(path).replaceAll('\\', '/').replace(/^\/+/, '')
    const segments = norm.split('/').filter(Boolean)
    if (segments.length < 2) continue
    const withoutFile = segments.slice(0, -1)
    const joined = withoutFile.join('/')
    return joined
  }
  return ''
}

function getPhotoBaseFromPhotoId(photoId: string): string {
  const id = photoId || ''
  if (!id.toLowerCase().endsWith('.jpg')) return id
  const base = id.slice(0, -'.jpg'.length)
  return base
}

function extractVerbatimEventDateFromPhotoBase(params: { baseName?: string }) {
  const base = (params?.baseName ?? '').trim()
  if (!base) return ''

  const match = base.match(/(\d{4}_\d{2}_\d{2}__\d{2}_\d{2}_\d{2})/)
  const verbatim = match?.[1] || ''
  return verbatim
}

function deriveEventDateTime(params: { verbatimEventDate: string }): { eventDate: string; eventTime: string; utcOffset: string } {
  const { verbatimEventDate } = params

  if (!verbatimEventDate) return { eventDate: '', eventTime: '', utcOffset: '' }
  const m = verbatimEventDate.match(/(\d{4})_(\d{2})_(\d{2})__([0-9]{2})_([0-9]{2})_([0-9]{2})/)
  if (!m) return { eventDate: '', eventTime: '', utcOffset: '' }
  const yyyy = m[1]
  const MM = m[2]
  const dd = m[3]
  const hh = m[4]
  const mm = m[5]
  const ss = m[6]
  const eventDate = `${yyyy}-${MM}-${dd}`
  const eventTime = `${hh}:${mm}:${ss}`
  const utcOffset = ''
  return { eventDate, eventTime, utcOffset }
}

function extractMothboxFromNightDiskPath(params: { nightDiskPath: string }): string {
  const { nightDiskPath } = params

  const norm = String(nightDiskPath || '')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
  const parts = norm.split('/').filter(Boolean)

  if (parts.length < 2) return ''

  const deploymentFolder = parts[parts.length - 2]
  const m = deploymentFolder.match(/^(.*)_(\d{4}-\d{2}-\d{2})$/)
  const beforeDate = m ? m[1] : deploymentFolder
  const segs = beforeDate.split('_').filter(Boolean)
  const device = segs[segs.length - 1] || ''
  return device
}

function extractDetectionByFromPatchId(params: { patchId: string; photoBase: string }): string {
  const { patchId, photoBase } = params

  let name = (patchId || '').replace(/\.jpg$/i, '')
  const prefix = `${photoBase}_`

  if (photoBase && name.startsWith(prefix)) name = name.slice(prefix.length)
  const idx = name.indexOf('_')

  if (idx >= 0) name = name.slice(idx + 1)
  return name
}
