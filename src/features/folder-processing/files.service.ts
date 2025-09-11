import { datasetStore } from '~/stores/dataset'
import { pickerErrorStore } from '~/stores/ui'
import { directoryFilesStore, selectedFilesStore } from './files.state'
import { collectFilesWithPathsRecursively, pickDirectoryFilesWithPaths } from './files.fs'
import { validateProjectRootSelection } from './files.validation'
import { ensureReadPermission, forgetSavedDirectory, loadSavedDirectory } from './files.persistence'
import { applyIndexedFilesState } from './files.initialize'
import { singlePassIngest } from './files.single-pass'
import { resetAllEntityStores } from '~/stores/entities'

export async function openDirectory() {
  console.log('🏁 openDirectory: start picking projects folder')
  const tStart = performance.now()

  const tPick = performance.now()
  const indexed = await pickDirectoryFilesWithPaths()
  const pickMs = Math.round(performance.now() - tPick)
  const totalPicked = indexed?.length ?? 0
  console.log('📂 openDirectory: collected files', { totalPicked, pickMs })
  if (!indexed?.length) return

  console.log('🌀 openDirectory: validating folder structure')
  const tValidate = performance.now()
  const validation = validateProjectRootSelection({ files: indexed })
  const validateMs = Math.round(performance.now() - tValidate)
  if (!validation.ok) {
    console.log('🚨 openDirectory: validation failed', { message: validation.message })
    pickerErrorStore.set(validation.message)
    await forgetSavedDirectory()
    return
  }

  const tIndexApply = performance.now()
  applyIndexedFilesState({ indexed })
  const indexApplyMs = Math.round(performance.now() - tIndexApply)

  const tSingle = performance.now()
  await singlePassIngest({ files: indexed as any })
  const singleMs = Math.round(performance.now() - tSingle)
  const totalMs = Math.round(performance.now() - tStart)
  console.log('✅ openDirectory: ingestion complete', { totalFiles: totalPicked, totalMs })
  console.log('⏱️ openDirectory: timings', { pickMs, validateMs, indexApplyMs, singleMs, totalMs })
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

    await collectFilesWithPathsRecursively({ directoryHandle: handle as any, pathParts: [], items: items as any })
    console.log('📂 restoreDirectory: collected files', { total: items.length, ms: Math.round(performance.now() - tCollect) })

    const tValidate = performance.now()
    const validation = validateProjectRootSelection({ files: items as any })
    const validateMs = Math.round(performance.now() - tValidate)
    console.log('🌀 restoreDirectory: validated folder structure', { validateMs })
    if (!validation.ok) {
      console.log('🚨 restoreDirectory: validation failed', { message: validation.message })
      pickerErrorStore.set(validation.message)
      return false
    }

    const tIndexApply = performance.now()
    applyIndexedFilesState({ indexed: items as any })
    const indexApplyMs = Math.round(performance.now() - tIndexApply)
    console.log('🌀 restoreDirectory: applied indexed files', { indexApplyMs })

    const tSingle = performance.now()
    await singlePassIngest({ files: items as any })
    const singleMs = Math.round(performance.now() - tSingle)
    console.log('🌀 restoreDirectory: single pass ingestion', { singleMs })
    const totalMs = Math.round(performance.now() - tCollect)
    console.log('✅ restoreDirectory: ingestion complete', { totalFiles: items.length, totalMs })
    console.log('⏱️ restoreDirectory: timings', { validateMs, indexApplyMs, singleMs, totalMs })
    pickerErrorStore.set(null)
    return true
  } catch {
    return false
  }
}

// moved to files.initialize
