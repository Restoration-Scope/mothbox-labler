export type FileSystemDirectoryHandleLike = {
  getDirectoryHandle?: (name: string, options?: { create?: boolean }) => Promise<FileSystemDirectoryHandleLike>
  getFileHandle?: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandleLike>
}

export type FileSystemFileHandleLike = {
  createWritable?: () => Promise<{ write: (data: any) => Promise<void>; close: () => Promise<void> }>
}

export async function fsaaWriteText(root: FileSystemDirectoryHandleLike, path: string[], content: string) {
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

  await writable.write(content)
  await writable.close()
}
