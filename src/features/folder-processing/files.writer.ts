import { detectionsStore, type DetectionEntity } from '~/stores/entities/detections'
import { photosStore, type PhotoEntity } from '~/stores/entities/photos'
import { idbGet } from '~/utils/index-db'
import { nightSummariesStore, type NightSummaryEntity } from '~/stores/entities/night-summaries'
import { ensureReadWritePermission, persistenceConstants } from './files.persistence'
import { userSessionStore } from '~/stores/ui'
import { morphoLinksStore } from '~/stores/morphospecies/links'
import { getPhotoBaseFromPhotoId, getNightDiskPathFromPhoto } from '~/utils/paths'
import { normalizeMorphoKey } from '~/stores/morphospecies/covers'
import { buildIdentifiedJsonShapeFromDetection } from '~/models/detection-shapes'

type FileSystemDirectoryHandleLike = {
  getDirectoryHandle?: (name: string, options?: { create?: boolean }) => Promise<FileSystemDirectoryHandleLike>
  getFileHandle?: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandleLike>
}

type FileSystemFileHandleLike = {
  createWritable?: () => Promise<{ write: (data: any) => Promise<void>; close: () => Promise<void> }>
}

const pendingTimers: Record<string, number> = {}

export function scheduleSaveUserDetections(params: { nightId: string; delayMs?: number }) {
  const { nightId } = params

  const delayMs = typeof params?.delayMs === 'number' ? params.delayMs : 400

  if (!nightId) return

  const prev = pendingTimers[nightId]
  if (prev) window.clearTimeout(prev)

  const t = window.setTimeout(() => {
    void exportUserDetectionsForNight({ nightId })
  }, delayMs)

  pendingTimers[nightId] = t
}

export async function exportUserDetectionsForNight(params: { nightId: string }) {
  const { nightId } = params
  const root = (await idbGet(
    persistenceConstants.IDB_NAME,
    persistenceConstants.IDB_STORE,
    'projectsRoot',
  )) as FileSystemDirectoryHandleLike | null

  if (!root) return

  const granted = await ensureReadWritePermission(root as any)
  if (!granted) return

  const allDetections = detectionsStore.get() || {}
  const allPhotos = photosStore.get() || {}

  const detectionsForNight = Object.values(allDetections).filter((d) => (d as any)?.nightId === nightId)
  const byPhoto: Record<string, DetectionEntity[]> = {}

  for (const d of detectionsForNight) {
    if ((d as any)?.detectedBy !== 'user') continue
    const photoId = (d as any)?.photoId
    if (!photoId) continue
    if (!byPhoto[photoId]) byPhoto[photoId] = []
    byPhoto[photoId].push(d)
  }

  const photosForNight = Object.values(allPhotos).filter((p) => (p as any)?.nightId === nightId)
  const nightDiskPathByPhotoId: Record<string, string> = {}

  for (const p of photosForNight) {
    const diskPath = getNightDiskPathFromPhoto(p)
    if (diskPath) nightDiskPathByPhotoId[p.id] = diskPath
  }

  const tasks: Array<Promise<void>> = []

  // Write identified JSON for every photo in the night.
  // When a photo has no user detections, write an empty shapes array to clear any stale file.
  for (const p of photosForNight) {
    const photoId = (p as any)?.id as string
    if (!photoId) continue
    const baseName = getPhotoBaseFromPhotoId(photoId)
    if (!baseName) continue
    const nightDiskPath = nightDiskPathByPhotoId[photoId]
    if (!nightDiskPath) continue
    const items = byPhoto[photoId] || []
    const fileName = `${baseName}_identified.json`
    const pathParts = nightDiskPath.split('/').filter(Boolean)
    const json = buildUserIdentifiedJson({ baseName, detections: items })
    tasks.push(writeJson(root, [...pathParts, fileName], json))
  }

  await Promise.all(tasks)

  // Update + persist night summary
  const totalDetections = detectionsForNight.length
  const totalIdentified = detectionsForNight.filter((d) => (d as any)?.detectedBy === 'user').length
  const morphoCounts: Record<string, number> = {}
  const morphoPreviewPatchIds: Record<string, string> = {}
  for (const d of detectionsForNight) {
    const isUser = (d as any)?.detectedBy === 'user'
    const morpho = typeof (d as any)?.morphospecies === 'string' ? ((d as any)?.morphospecies as string) : ''
    const key = isUser && morpho ? normalizeMorphoKey(morpho) : ''
    if (!key) continue
    morphoCounts[key] = (morphoCounts[key] || 0) + 1
    if (!morphoPreviewPatchIds[key] && (d as any)?.patchId) morphoPreviewPatchIds[key] = String((d as any)?.patchId)
  }
  const summary: NightSummaryEntity = {
    nightId,
    totalDetections,
    totalIdentified,
    updatedAt: Date.now(),
    morphoCounts,
    morphoPreviewPatchIds,
  }
  const currentSummaries = nightSummariesStore.get() || {}
  nightSummariesStore.set({ ...currentSummaries, [nightId]: summary })

  const anyPhoto = photosForNight[0]
  if (anyPhoto) {
    const nightDiskPath = getNightDiskPathFromPhoto(anyPhoto)
    if (nightDiskPath) {
      const pathParts = nightDiskPath.split('/').filter(Boolean)
      await writeJson(root, [...pathParts, 'night_summary.json'], summary)
    }
  }
}

export async function writeMorphoLinksToDisk() {
  try {
    const root = (await idbGet(
      persistenceConstants.IDB_NAME,
      persistenceConstants.IDB_STORE,
      'projectsRoot',
    )) as FileSystemDirectoryHandleLike | null

    if (!root) return

    const granted = await ensureReadWritePermission(root as any)
    if (!granted) return

    const links = morphoLinksStore.get() || {}

    // Persist a single file under the projects root
    await writeJson(root, ['morpho_links.json'], links)
  } catch {
    // ignore write errors
  }
}

function buildUserIdentifiedJson(params: { baseName: string; detections: DetectionEntity[] }) {
  const { baseName, detections } = params
  const user = userSessionStore.get()
  const human = (user?.initials || 'user').trim()
  const shapes = detections.map((d) => buildIdentifiedJsonShapeFromDetection({ detection: d, identifierHuman: human }))
  const json = { version: '1', photoBase: baseName, shapes }
  return json
}

async function writeJson(root: FileSystemDirectoryHandleLike, path: string[], data: unknown) {
  if (!root?.getDirectoryHandle || !root?.getFileHandle) return
  const fileName = path[path.length - 1]
  const dirParts = path.slice(0, -1)
  let dir = root
  for (const part of dirParts) {
    dir = (await dir.getDirectoryHandle?.(part, { create: true })) as any
    if (!dir) return
  }
  const fh = (await dir.getFileHandle?.(fileName, { create: true })) as FileSystemFileHandleLike
  const writable = await fh?.createWritable?.()
  if (!writable) return
  await writable.write(JSON.stringify(data, null, 2))
  await writable.close()
}
