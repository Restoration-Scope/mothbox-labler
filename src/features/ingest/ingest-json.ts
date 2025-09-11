import type { IndexedFile } from '~/stores/entities/photos'

export type BotDetectionJson = {
  version?: string
  shapes: Array<{
    label?: unknown
    score?: unknown
    direction?: unknown
    shape_type?: unknown
    points?: number[][]
    patch_path?: string
    kingdom?: unknown
    phylum?: unknown
    class?: unknown
    order?: unknown
    family?: unknown
    genus?: unknown
    species?: unknown
    human_identifier?: unknown
    human_identified_at?: unknown
  }>
}

export type UserDetectionJson = {
  version?: string
  photoBase?: string
  shapes?: BotDetectionJson['shapes']
}

export async function parseBotDetectionJsonSafely(params: { file: IndexedFile }): Promise<BotDetectionJson | null> {
  try {
    const text = await ensureTextFromIndexedFile(params.file)
    const json = JSON.parse(text) as BotDetectionJson
    if (!json || !Array.isArray(json.shapes)) return null
    return json
  } catch {
    return null
  }
}

export async function parseUserDetectionJsonSafely(params: { file: IndexedFile }): Promise<UserDetectionJson | null> {
  try {
    const text = await ensureTextFromIndexedFile(params.file)
    const json = JSON.parse(text) as UserDetectionJson
    if (!json) return null
    if (!Array.isArray((json as any).shapes)) return null
    return json
  } catch {
    return null
  }
}

export function extractPatchFilename(params: { patchPath: string }) {
  const { patchPath } = params
  if (!patchPath) return ''
  const normalized = patchPath.replaceAll('\\', '/').trim()
  const segments = normalized.split('/')
  const name = segments[segments.length - 1]
  return name ?? ''
}

async function ensureTextFromIndexedFile(f: IndexedFile): Promise<string> {
  const hasFile = !!(f as any)?.file
  if (hasFile) return await (f as any).file.text()
  const handle = (f as any)?.handle as { getFile?: () => Promise<File> } | undefined
  if (handle && typeof handle.getFile === 'function') {
    const file = await handle.getFile()
    const text = await file.text()
    return text
  }
  throw new Error('No file or handle available for reading')
}
