import { persistPickedDirectory, ensureReadWritePermission } from './files.persistence'

type FileSystemFileHandleLike = {
  getFile: () => Promise<File>
  name?: string
}

type FileSystemDirectoryHandleLike = {
  values: () => AsyncIterable<FileSystemFileHandleLike | FileSystemDirectoryHandleLike>
  name?: string
}

function isFileHandle(entry: unknown): entry is FileSystemFileHandleLike {
  const handle = entry as FileSystemFileHandleLike | undefined
  const hasGetFile = typeof handle?.getFile === 'function'
  return hasGetFile
}

export async function collectFilesWithPathsRecursively(params: {
  directoryHandle: FileSystemDirectoryHandleLike
  pathParts: string[]
  items: Array<{ file?: File; handle?: unknown; path: string; name: string; size: number }>
}) {
  const { directoryHandle, pathParts, items } = params
  const dirName = (directoryHandle as unknown as { name?: string })?.name ?? ''
  const baseParts = pathParts.length === 0 ? [] : pathParts
  const currentParts = [...baseParts, dirName].filter(Boolean)

  for await (const entry of directoryHandle.values()) {
    const entryName = (entry as unknown as { name?: string })?.name ?? ''
    if (isFileHandle(entry)) {
      const shouldHydrate = shouldHydrateImmediately(entryName)
      const file = shouldHydrate ? await entry.getFile() : undefined
      const relFromRoot = [...currentParts.slice(1), entryName || file?.name || ''].filter(Boolean).join('/')
      items.push({ file, handle: entry as unknown, path: relFromRoot, name: entryName || file?.name || '', size: file?.size ?? 0 })
      continue
    }
    const subdir = entry as FileSystemDirectoryHandleLike
    const hasValues = typeof subdir?.values === 'function'
    if (hasValues) {
      await collectFilesWithPathsRecursively({ directoryHandle: subdir, pathParts: currentParts, items })
    }
  }
}

export async function pickDirectoryFilesWithPaths(): Promise<
  Array<{ file?: File; handle?: unknown; path: string; name: string; size: number }>
> {
  const canUsePicker = typeof (window as unknown as { showDirectoryPicker?: unknown })?.showDirectoryPicker === 'function'
  if (!canUsePicker) {
    const files = await fallbackPickDirectoryFiles()
    const indexed = indexFilesWithPath({ files })
    return indexed
  }
  // @ts-expect-error: showDirectoryPicker is not in all TS lib versions
  const dirHandle: FileSystemDirectoryHandleLike | null = await window.showDirectoryPicker?.().catch(() => null)
  if (!dirHandle) return []

  await persistPickedDirectory(dirHandle)
  // Try to proactively request RW so we can save later without prompting again
  void ensureReadWritePermission(dirHandle as any)

  const items: Array<{ file?: File; handle?: unknown; path: string; name: string; size: number }> = []
  await collectFilesWithPathsRecursively({ directoryHandle: dirHandle, pathParts: [], items })
  return items
}

export async function fallbackPickDirectoryFiles(): Promise<File[]> {
  const input = document.createElement('input')
  input.type = 'file'
  input.setAttribute('webkitdirectory', '')
  input.style.position = 'fixed'
  input.style.left = '-9999px'

  const files = await new Promise<File[]>((resolve) => {
    input.onchange = () => {
      const list = Array.from(input.files ?? [])
      resolve(list)
      input.remove()
    }
    document.body.appendChild(input)
    input.click()
  })

  return files
}

export function indexFilesWithPath(params: { files: File[] }) {
  const { files } = params
  const indexed = files.map((file) => {
    const path = getFileWebkitRelativePath(file) || file?.name || ''
    const entry = { file, handle: undefined as unknown, path, name: file?.name ?? '', size: file?.size ?? 0 }
    return entry
  })
  return indexed
}

export function getFileWebkitRelativePath(file: File) {
  const anyFile = file as File & { webkitRelativePath?: string }
  const rel = anyFile?.webkitRelativePath ?? ''
  return rel
}

function shouldHydrateImmediately(name: string) {
  const lower = (name ?? '').toLowerCase()
  if (!lower) return false
  if (lower.endsWith('.json')) return true
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) return true
  if (lower === 'night_summary.json') return true
  return false
}
