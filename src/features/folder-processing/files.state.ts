import { atom } from 'nanostores'

export const selectedFilesStore = atom<File[]>([])
export const directoryFilesStore = atom<File[]>([])
export const indexedFilesStore = atom<Array<{ file: File; path: string; name: string; size: number }>>([])
