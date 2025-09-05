import { atom, computed } from 'nanostores'

export type IndexedFile = {
  file: File
  path: string
  name: string
  size: number
}

export type ProjectEntity = { id: string; name: string }
export type SiteEntity = { id: string; name: string; projectId: string }
export type DeploymentEntity = { id: string; name: string; projectId: string; siteId: string }
export type NightEntity = { id: string; name: string; projectId: string; siteId: string; deploymentId: string }
export type PhotoEntity = { id: string; name: string; nightId: string; imageFile?: IndexedFile; botDetectionFile?: IndexedFile }
export type PatchEntity = { id: string; name: string; nightId: string; photoId: string; imageFile?: IndexedFile }

export type DetectionEntity = {
  id: string
  patchId: string
  photoId: string
  nightId: string
  label?: string
  score?: number
  direction?: number
  shapeType?: string
  points?: number[][]
  detectedBy?: 'auto' | 'user'
  identifiedAt?: number
}

export const projectsStore = atom<Record<string, ProjectEntity>>({})
export const sitesStore = atom<Record<string, SiteEntity>>({})
export const deploymentsStore = atom<Record<string, DeploymentEntity>>({})
export const nightsStore = atom<Record<string, NightEntity>>({})
export const photosStore = atom<Record<string, PhotoEntity>>({})
export const patchesStore = atom<Record<string, PatchEntity>>({})
export const detectionsStore = atom<Record<string, DetectionEntity>>({})

export async function ingestFilesToStores(params: { files: IndexedFile[]; parseDetectionsForNightId?: string | null }) {
  const { files, parseDetectionsForNightId } = params
  if (!files?.length) return

  const tStart = performance.now()
  console.log('🏁 ingest: start', { totalFiles: files.length })

  const proj: Record<string, ProjectEntity> = {}
  const sites: Record<string, SiteEntity> = {}
  const deps: Record<string, DeploymentEntity> = {}
  const nights: Record<string, NightEntity> = {}
  const photos: Record<string, PhotoEntity> = {}
  const patches: Record<string, PatchEntity> = {}
  const detections: Record<string, DetectionEntity> = {}

  // First pass: folders and image/json placement
  let photoJpgCount = 0
  let patchFileCount = 0
  let botJsonCount = 0
  for (const f of files) {
    const parts = parsePathParts({ path: f.path })
    if (!parts) continue

    const { project, site, deployment, night, isPatch, isPhotoJpg, isBotJson, fileName, baseName } = parts
    if (!project || !site || !deployment || !night) continue

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
  }

  // Second pass: parse botdetection JSONs and attach detections to patches
  const tParse = performance.now()
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
        // Ensure patch exists and ALWAYS sync correct night/photo linkage from JSON context
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

  projectsStore.set(proj)
  sitesStore.set(sites)
  deploymentsStore.set(deps)
  nightsStore.set(nights)
  // Photos/Patches apply strategy:
  // - parseDetectionsForNightId === null: skip media entirely (clear to empty)
  // - parseDetectionsForNightId is string: merge into existing (this night only)
  // - undefined: full build
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

  // Detections apply strategy mirrors above, but prefer existing (user-edited) entries on merge
  if (parseDetectionsForNightId === null) {
    detectionsStore.set({})
  } else if (typeof parseDetectionsForNightId === 'string') {
    const currentDetections = detectionsStore.get() || {}
    const merged: Record<string, DetectionEntity> = { ...detections, ...currentDetections }
    detectionsStore.set(merged)
  } else {
    detectionsStore.set(detections)
  }

  const tEnd = performance.now()
  console.log('✅ ingest: complete', {
    projects: Object.keys(proj).length,
    sites: Object.keys(sites).length,
    deployments: Object.keys(deps).length,
    nights: Object.keys(nights).length,
    photos: Object.keys(photos).length,
    patches: Object.keys(patches).length,
    detections: Object.keys(detectionsStore.get() || {}).length,
    counts: { photoJpgs: photoJpgCount, patchJpgs: patchFileCount, botJsons: botJsonCount, detectionsParsed },
    parseMs: Math.round(tEnd - tParse),
    totalMs: Math.round(tEnd - tStart),
  })
}

export async function ingestDetectionsForNight(params: { files: IndexedFile[]; nightId: string }) {
  const { files, nightId } = params
  if (!files?.length || !nightId) return
  await ingestFilesToStores({ files, parseDetectionsForNightId: nightId })
}

export function labelDetections(params: { detectionIds: string[]; label: string }) {
  const { detectionIds, label } = params
  const trimmed = (label ?? '').trim()
  if (!Array.isArray(detectionIds) || detectionIds.length === 0) return
  if (!trimmed) return

  const current = detectionsStore.get() || {}
  const updated: Record<string, DetectionEntity> = { ...current }
  for (const id of detectionIds) {
    const existing = current?.[id]
    if (!existing) continue
    const identifiedAt = Date.now()
    updated[id] = { ...existing, label: trimmed, detectedBy: 'user', identifiedAt }
  }
  detectionsStore.set(updated)
}

export function acceptDetections(params: { detectionIds: string[] }) {
  const { detectionIds } = params
  if (!Array.isArray(detectionIds) || detectionIds.length === 0) return

  const current = detectionsStore.get() || {}
  const updated: Record<string, DetectionEntity> = { ...current }
  for (const id of detectionIds) {
    const existing = current?.[id]
    if (!existing) continue
    const identifiedAt = Date.now()
    updated[id] = { ...existing, detectedBy: 'user', identifiedAt }
  }
  detectionsStore.set(updated)
}

// -----------------------------
// Per-id selectors (computed)
// -----------------------------

export function detectionStoreById(id: string) {
  return computed(detectionsStore, (all) => all?.[id])
}

export function patchStoreById(id: string) {
  return computed(patchesStore, (all) => all?.[id])
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

function parsePathParts(params: { path: string }) {
  const { path } = params
  const normalized = (path ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)
  // Support both:
  // - project/deployment/night/(patches/)?file
  // - project/site/deployment/night/(patches/)?file
  if (segments.length < 4) return null
  let project = ''
  let site = ''
  let deployment = ''
  let night = ''
  let rest: string[] = []
  if (segments.length >= 5) {
    // project/site/deployment/night/...
    ;[project, site, deployment, night, ...rest] = segments
  } else {
    // project/deployment/night/...
    ;[project, deployment, night, ...rest] = segments
    site = deriveSiteFromDeploymentFolder(deployment)
  }
  const isPatchesFolder = rest[0] === 'patches'
  const fileName = isPatchesFolder ? rest[1] : rest[0]
  if (!fileName) return null
  const lower = fileName.toLowerCase()
  const isPatch = isPatchesFolder && lower.endsWith('.jpg')
  const isPhotoJpg = !isPatchesFolder && lower.endsWith('.jpg')
  const isBotJson = lower.endsWith('_botdetection.json')
  const baseName = isBotJson
    ? fileName.slice(0, -'_botdetection.json'.length)
    : fileName.endsWith('.jpg')
    ? fileName.slice(0, -'.jpg'.length)
    : fileName
  return { project, site, deployment, night, isPatch, isPhotoJpg, isBotJson, fileName, baseName }
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

function safeLabel(value: unknown) {
  return typeof value === 'string' ? value : undefined
}
function safeNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
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

// -----------------------------
// Helpers (atomic)
// -----------------------------

function findPatchFileForPatchId(params: { files: IndexedFile[]; nightDiskPath: string; patchId: string }): IndexedFile | undefined {
  const { files, nightDiskPath, patchId } = params
  if (!files?.length || !nightDiskPath || !patchId) return undefined
  const normalizedNight = nightDiskPath.replaceAll('\\', '/').replace(/^\/+/, '').toLowerCase()
  const expectedSuffix = `${normalizedNight}/patches/${patchId}`
  for (const f of files) {
    const path = (f?.path ?? '').replaceAll('\\', '/').toLowerCase()
    if (!path) continue
    if (path.endsWith(expectedSuffix)) return f
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
  // For JSON at project/(site/)?deployment/night/file.json, drop the filename
  const withoutFile = segments.slice(0, -1)
  const joined = withoutFile.join('/')
  return joined
}
