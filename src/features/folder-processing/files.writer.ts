import { detectionsStore, type DetectionEntity } from '~/stores/entities/detections'
import { photosStore, type PhotoEntity } from '~/stores/entities/photos'
import { idbGet } from '~/utils/index-db'
import { ensureReadWritePermission, persistenceConstants } from './files.persistence'

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

  for (const [photoId, items] of Object.entries(byPhoto)) {
    const baseName = getPhotoBaseFromPhotoId(photoId)
    if (!baseName) continue
    const nightDiskPath = nightDiskPathByPhotoId[photoId]
    if (!nightDiskPath) continue

    const fileName = `${baseName}_detection.json`
    const pathParts = nightDiskPath.split('/').filter(Boolean)
    tasks.push(writeJson(root, [...pathParts, fileName], buildUserDetectionJson({ baseName, detections: items })))
  }

  await Promise.all(tasks)
}

function buildUserDetectionJson(params: { baseName: string; detections: DetectionEntity[] }) {
  const { baseName, detections } = params
  const json = {
    version: '1',
    photoBase: baseName,
    detections: detections.map((d) => ({
      id: d.id,
      patchId: d.patchId,
      label: d.label,
      detectedBy: 'user' as const,
      identifiedAt: d.identifiedAt ?? Date.now(),
    })),
  }
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

function getNightDiskPathFromPhoto(photo: PhotoEntity): string {
  const path = (photo as any)?.imageFile?.path || (photo as any)?.botDetectionFile?.path
  if (!path) return ''
  const norm = String(path).replaceAll('\\', '/').replace(/^\/+/, '')
  const segments = norm.split('/').filter(Boolean)
  if (segments.length < 2) return ''
  const withoutFile = segments.slice(0, -1)
  const joined = withoutFile.join('/')
  return joined
}

function getPhotoBaseFromPhotoId(photoId: string): string {
  const id = photoId || ''
  if (!id.toLowerCase().endsWith('.jpg')) return id
  const base = id.slice(0, -'.jpg'.length)
  return base
}
