import { datasetStore, updateDatasetFromFiles } from '~/stores/dataset'
import { ingestFilesToStores, resetAllEntityStores } from '~/stores/entities/ingest'
import { pickerErrorStore } from '~/stores/ui'
import { directoryFilesStore, indexedFilesStore, selectedFilesStore } from './files.state'
import { collectFilesWithPathsRecursively, pickDirectoryFilesWithPaths } from './files.fs'
import { validateProjectRootSelection } from './files.validation'
import { ensureReadPermission, forgetSavedDirectory, loadSavedDirectory } from './files.persistence'
import { ingestSpeciesListsFromFiles, loadProjectSpeciesSelection } from '~/stores/species-lists'

export async function openDirectory() {
  console.log('🏁 openDirectory: start picking projects folder')
  const tStart = performance.now()

  const indexed = await pickDirectoryFilesWithPaths()
  const totalPicked = indexed?.length ?? 0
  console.log('📂 openDirectory: collected files', { totalPicked })
  if (!indexed?.length) return

  console.log('🌀 openDirectory: validating folder structure')
  const validation = validateProjectRootSelection({ files: indexed })
  if (!validation.ok) {
    console.log('🚨 openDirectory: validation failed', { message: validation.message })
    pickerErrorStore.set(validation.message)
    await forgetSavedDirectory()
    return
  }

  directoryFilesStore.set(indexed.map((i) => i.file))
  indexedFilesStore.set(indexed)

  // Species lists ingestion (non-blocking)
  void ingestSpeciesListsFromFiles({ files: indexed })
  void loadProjectSpeciesSelection()

  const tDatasetStart = performance.now()
  updateDatasetFromFiles({ files: indexed })
  const dataset = datasetStore.get()
  const projectsCount = dataset?.projects?.length ?? 0
  console.log('🧮 openDirectory: dataset built', { projectsCount, ms: Math.round(performance.now() - tDatasetStart) })

  const tIngestStart = performance.now()
  await ingestFilesToStores({ files: indexed, parseDetectionsForNightId: null })
  console.log('✅ openDirectory: ingestion complete', {
    totalFiles: totalPicked,
    ingestMs: Math.round(performance.now() - tIngestStart),
    totalMs: Math.round(performance.now() - tStart),
  })
  pickerErrorStore.set(null)
}

export function clearSelections() {
  selectedFilesStore.set([])
  directoryFilesStore.set([])
  datasetStore.set(null)
  resetAllEntityStores()
  void forgetSavedDirectory()
}

export async function tryRestoreFromSavedDirectory() {
  try {
    console.log('🏁 restoreDirectory: attempting to restore previously picked folder')

    const handle = await loadSavedDirectory()
    if (!handle) return false

    const granted = await ensureReadPermission(handle as any)
    if (!granted) return false

    const items: Array<{ file: File; path: string; name: string; size: number }> = []
    const tCollect = performance.now()

    await collectFilesWithPathsRecursively({ directoryHandle: handle as any, pathParts: [], items })
    console.log('📂 restoreDirectory: collected files', { total: items.length, ms: Math.round(performance.now() - tCollect) })

    const validation = validateProjectRootSelection({ files: items })
    if (!validation.ok) {
      console.log('🚨 restoreDirectory: validation failed', { message: validation.message })
      pickerErrorStore.set(validation.message)
      return false
    }

    directoryFilesStore.set(items.map((i) => i.file))
    indexedFilesStore.set(items)
    // Species lists ingestion (non-blocking)
    void ingestSpeciesListsFromFiles({ files: items })
    void loadProjectSpeciesSelection()
    const tDataset = performance.now()
    updateDatasetFromFiles({ files: items })

    const dataset = datasetStore.get()

    console.log('🧮 restoreDirectory: dataset built', {
      projectsCount: dataset?.projects?.length ?? 0,
      ms: Math.round(performance.now() - tDataset),
    })
    const tIngest = performance.now()

    // Avoid triggering multiple concurrent restores by ensuring this call is awaited once per app start.
    await ingestFilesToStores({ files: items, parseDetectionsForNightId: null })
    console.log('✅ restoreDirectory: ingestion complete', { totalFiles: items.length, ingestMs: Math.round(performance.now() - tIngest) })
    pickerErrorStore.set(null)
    return true
  } catch {
    return false
  }
}
