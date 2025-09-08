import { projectsStore, type ProjectEntity } from './1.projects'
import { sitesStore, type SiteEntity } from './2.sites'
import { deploymentsStore, type DeploymentEntity } from './3.deployments'
import { nightsStore, type NightEntity } from './4.nights'
import { photosStore, type PhotoEntity, type IndexedFile } from './photos'
import { patchesStore, type PatchEntity } from './5.patches'
import { detectionsStore, type DetectionEntity } from './detections'

export async function ingestFilesToStores(params: { files: IndexedFile[]; parseDetectionsForNightId?: string | null }) {
  const { files, parseDetectionsForNightId } = params
  if (!files?.length) return

  const proj: Record<string, ProjectEntity> = {}
  const sites: Record<string, SiteEntity> = {}
  const deps: Record<string, DeploymentEntity> = {}
  const nights: Record<string, NightEntity> = {}
  const photos: Record<string, PhotoEntity> = {}
  const patches: Record<string, PatchEntity> = {}
  const detections: Record<string, DetectionEntity> = {}

  let photoJpgCount = 0
  let patchFileCount = 0
  let botJsonCount = 0
  let userJsonCount = 0
  for (const f of files) {
    const parts = parsePathParts({ path: f.path })
    if (!parts) continue
    const { project, site, deployment, night, isPatch, isPhotoJpg, isBotJson, isUserJson, fileName, baseName } = parts
    if (!project || !site || !deployment || !night) continue

    // Ignore files that are not relevant media (avoids creating nights from exports like ID_HS_*)
    const hasRelevantMedia = isPhotoJpg || isPatch || isBotJson || isUserJson
    if (!hasRelevantMedia) continue

    const projectId = project
    const siteId = `${project}/${site}`
    const deploymentId = `${project}/${site}/${deployment}`
    const nightId = `${project}/${site}/${deployment}/${night}`

    proj[projectId] = proj[projectId] ?? { id: projectId, name: project }
    const siteDisplayName = deriveSiteFromDeploymentFolder(deployment) || site
    sites[siteId] = sites[siteId] ?? { id: siteId, name: siteDisplayName, projectId }
    deps[deploymentId] = deps[deploymentId] ?? { id: deploymentId, name: deployment, projectId, siteId }
    nights[nightId] = nights[nightId] ?? { id: nightId, name: night, projectId, siteId, deploymentId }

    const shouldIncludeMedia =
      parseDetectionsForNightId === undefined ? true : parseDetectionsForNightId === null ? false : nightId === parseDetectionsForNightId

    if (isPhotoJpg && shouldIncludeMedia) {
      const photoId = `${baseName}.jpg`
      const existing = photos[photoId] ?? { id: photoId, name: photoId, nightId }
      photos[photoId] = { ...existing, imageFile: f }
      photoJpgCount++
      continue
    }

    if (isPatch && shouldIncludeMedia) {
      const photoId = `${baseName}.jpg`
      const patchId = fileName
      patches[patchId] = patches[patchId] ?? { id: patchId, name: patchId, nightId, photoId, imageFile: f }
      patchFileCount++
      continue
    }

    if (isBotJson && shouldIncludeMedia) {
      const photoId = `${baseName}.jpg`
      const existing = photos[photoId] ?? { id: photoId, name: photoId, nightId }
      photos[photoId] = { ...existing, botDetectionFile: f }
      botJsonCount++
      continue
    }

    if (isUserJson && shouldIncludeMedia) {
      const photoId = `${baseName}.jpg`
      const existing = photos[photoId] ?? { id: photoId, name: photoId, nightId }
      photos[photoId] = { ...existing, userDetectionFile: f }
      userJsonCount++
      continue
    }
  }

  // Second pass
  let detectionsParsed = 0
  if (parseDetectionsForNightId !== null) {
    for (const photo of Object.values(photos)) {
      if (parseDetectionsForNightId && photo.nightId !== parseDetectionsForNightId) continue
      const jsonFile = photo.botDetectionFile
      if (!jsonFile) continue
      const parsed = await parseBotDetectionJsonSafely({ file: jsonFile })
      if (!parsed) continue
      for (let i = 0; i < parsed.shapes.length; i++) {
        const shape = parsed.shapes[i]
        const patchFileName = extractPatchFilename({ patchPath: shape.patch_path ?? '' })
        if (!patchFileName) continue
        const patchId = patchFileName
        const existingPatch = patches[patchId]
        patches[patchId] = {
          id: patchId,
          name: existingPatch?.name ?? patchId,
          nightId: photo.nightId,
          photoId: photo.id,
          imageFile:
            existingPatch?.imageFile ??
            findPatchFileForPatchId({ files, patchId, nightDiskPath: extractNightDiskPathFromIndexedPath((jsonFile as any)?.path ?? '') }),
        }
        const detectionId = patchId
        detections[detectionId] = {
          id: detectionId,
          patchId,
          photoId: photo.id,
          nightId: photo.nightId,
          label: safeLabel(shape?.label),
          score: safeNumber(shape?.score),
          direction: safeNumber(shape?.direction),
          shapeType: safeLabel(shape?.shape_type),
          points: Array.isArray(shape?.points) ? shape.points : undefined,
          detectedBy: 'auto',
        }
        detectionsParsed++
      }
    }
  }

  // Overlay user detections (if any) from *_detection.json files
  if (parseDetectionsForNightId !== null) {
    for (const photo of Object.values(photos)) {
      if (parseDetectionsForNightId && photo.nightId !== parseDetectionsForNightId) continue

      const userJson = (photo as any)?.userDetectionFile as IndexedFile | undefined

      if (!userJson) continue
      const parsed = await parseUserDetectionJsonSafely({ file: userJson })

      if (!parsed) continue
      for (const entry of parsed.detections) {
        const detectionId = entry?.patchId || entry?.id
        if (!detectionId) continue
        const existing = detections[detectionId]
        const next: DetectionEntity = {
          id: detectionId,
          patchId: detectionId,
          photoId: existing?.photoId || `${parsed.photoBase || ''}.jpg`,
          nightId: photo.nightId,
          label: safeLabel(entry?.label) ?? existing?.label,
          score: existing?.score,
          direction: existing?.direction,
          shapeType: existing?.shapeType,
          points: existing?.points,
          detectedBy: entry?.detectedBy === 'user' ? 'user' : existing?.detectedBy || 'auto',
          identifiedAt: typeof entry?.identifiedAt === 'number' ? entry.identifiedAt : existing?.identifiedAt,
        }
        detections[detectionId] = next
      }
    }
  }

  projectsStore.set(proj)
  sitesStore.set(sites)
  deploymentsStore.set(deps)
  nightsStore.set(nights)

  if (parseDetectionsForNightId === null) {
    photosStore.set({})
    patchesStore.set({})
  } else if (typeof parseDetectionsForNightId === 'string') {
    const currentPhotos = photosStore.get() || {}
    const currentPatches = patchesStore.get() || {}
    photosStore.set({ ...currentPhotos, ...photos })
    patchesStore.set({ ...currentPatches, ...patches })
  } else {
    photosStore.set(photos)
    patchesStore.set(patches)
  }

  if (parseDetectionsForNightId === null) {
    detectionsStore.set({})
  } else if (typeof parseDetectionsForNightId === 'string') {
    const currentDetections = detectionsStore.get() || {}
    const merged: Record<string, DetectionEntity> = { ...detections, ...currentDetections }
    detectionsStore.set(merged)
  } else {
    detectionsStore.set(detections)
  }
}

export async function ingestDetectionsForNight(params: { files: IndexedFile[]; nightId: string }) {
  const { files, nightId } = params
  if (!files?.length || !nightId) return
  await ingestFilesToStores({ files, parseDetectionsForNightId: nightId })
}

function isLikelyNightFolderName(name: string) {
  const n = (name ?? '').toLowerCase()
  if (!n) return false
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(n)
  if (isDate) return true
  if (n.startsWith('night')) return true
  return false
}

function parsePathParts(params: { path: string }) {
  const { path } = params
  const normalized = (path ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length < 4) return null
  let project = ''
  let site = ''
  let deployment = ''
  let night = ''
  let rest: string[] = []
  if (segments.length >= 5) {
    ;[project, site, deployment, night, ...rest] = segments
  } else {
    ;[project, deployment, night, ...rest] = segments
    site = deriveSiteFromDeploymentFolder(deployment)
  }
  // Guard: only treat folder names that look like actual nights (e.g., YYYY-MM-DD or Night*)
  if (!isLikelyNightFolderName(night)) return null
  const isPatchesFolder = rest[0] === 'patches'
  const fileName = isPatchesFolder ? rest[1] : rest[0]
  if (!fileName) return null
  const lower = fileName.toLowerCase()
  const isPatch = isPatchesFolder && lower.endsWith('.jpg')
  const isPhotoJpg = !isPatchesFolder && lower.endsWith('.jpg')
  const isBotJson = lower.endsWith('_botdetection.json')
  const isUserJson = lower.endsWith('_detection.json')
  const baseName = isBotJson
    ? fileName.slice(0, -'_botdetection.json'.length)
    : isUserJson
    ? fileName.slice(0, -'_detection.json'.length)
    : fileName.endsWith('.jpg')
    ? fileName.slice(0, -'.jpg'.length)
    : fileName
  return { project, site, deployment, night, isPatch, isPhotoJpg, isBotJson, isUserJson, fileName, baseName }
}

async function parseBotDetectionJsonSafely(params: { file: IndexedFile }): Promise<BotDetectionJson | null> {
  try {
    const text = await params.file.file.text()
    const json = JSON.parse(text) as BotDetectionJson
    if (!json || !Array.isArray(json.shapes)) return null
    return json
  } catch {
    return null
  }
}

function extractPatchFilename(params: { patchPath: string }) {
  const { patchPath } = params
  if (!patchPath) return ''
  const normalized = patchPath.replaceAll('\\', '/').trim()
  const segments = normalized.split('/')
  const name = segments[segments.length - 1]
  return name ?? ''
}

type BotDetectionJson = {
  version?: string
  shapes: Array<{
    label?: unknown
    score?: unknown
    direction?: unknown
    shape_type?: unknown
    points?: number[][]
    patch_path?: string
  }>
}

type UserDetectionJson = {
  version?: string
  photoBase?: string
  detections: Array<{
    id?: string
    patchId?: string
    label?: unknown
    detectedBy?: 'auto' | 'user'
    identifiedAt?: number
  }>
}

async function parseUserDetectionJsonSafely(params: { file: IndexedFile }): Promise<UserDetectionJson | null> {
  try {
    const text = await params.file.file.text()
    const json = JSON.parse(text) as UserDetectionJson
    if (!json || !Array.isArray(json.detections)) return null
    return json
  } catch {
    return null
  }
}

function findPatchFileForPatchId(params: { files: IndexedFile[]; nightDiskPath: string; patchId: string }) {
  const { files, nightDiskPath, patchId } = params
  if (!files?.length || !nightDiskPath || !patchId) return undefined

  const normalizedNight = nightDiskPath.replaceAll('\\', '/').replace(/^\/+/, '').toLowerCase()
  const patchIdLower = patchId.toLowerCase()
  const expectedSuffixLower = `${normalizedNight}/patches/${patchIdLower}`
  for (const f of files) {
    const pathLower = (f?.path ?? '').replaceAll('\\', '/').toLowerCase()
    if (!pathLower) continue
    if (pathLower.endsWith(expectedSuffixLower)) return f
  }

  // Fallback: match by just the trailing "/patches/<patchId>" without full night path (tolerates minor path drifts)
  const trailingLower = `/patches/${patchIdLower}`
  for (const f of files) {
    const pathLower = (f?.path ?? '').replaceAll('\\', '/').toLowerCase()
    if (!pathLower) continue
    if (pathLower.endsWith(trailingLower)) {
      console.log('💡 ingest: fallback matched patch file', { patchId, path: f.path })
      return f
    }
  }

  return undefined
}

function deriveSiteFromDeploymentFolder(deploymentFolderName: string) {
  const name = deploymentFolderName ?? ''
  if (!name) return ''
  const parts = name.split('_').filter(Boolean)
  if (parts.length >= 2) return parts[1]
  return name
}

function extractNightDiskPathFromIndexedPath(path: string) {
  const normalized = (path ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length < 2) return ''
  const withoutFile = segments.slice(0, -1)
  const joined = withoutFile.join('/')
  return joined
}

function safeLabel(value: unknown) {
  return typeof value === 'string' ? value : undefined
}
function safeNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

export function resetAllEntityStores() {
  projectsStore.set({})
  sitesStore.set({})
  deploymentsStore.set({})
  nightsStore.set({})
  photosStore.set({})
  patchesStore.set({})
  detectionsStore.set({})
}
