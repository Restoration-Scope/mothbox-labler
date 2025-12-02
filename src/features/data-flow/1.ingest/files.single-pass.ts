import { applyIndexedFilesState } from './files.initialize'
import { validateProjectRootSelection } from './files.validation'
import { ingestFilesToStores } from '~/features/data-flow/1.ingest/ingest'

export async function singlePassIngest(params: {
  files: Array<{ file?: File; handle?: unknown; path: string; name: string; size: number }>
}) {
  const { files } = params
  const tStart = performance.now()
  console.log('🌀 singlePassIngest: start', { totalFiles: files.length })
  if (!Array.isArray(files) || files.length === 0) return { ok: false as const, message: 'No files' }

  const validationMeasured = await measureStep({ label: 'validated folder structure', fn: () => validateProjectRootSelection({ files }) })
  const validation = validationMeasured.result
  const validationMs = validationMeasured.ms
  if (!validation.ok) return validation

  const { ms: indexApplyMs } = await measureStep({ label: 'applied indexed files', fn: () => applyIndexedFilesState({ indexed: files }) })

  const datasetUpdateMs = 0

  // Do not parse bot detection JSON at app load; only set up entities and file refs.
  // Per-night JSON parsing happens in the Night route via useNightIngest.
  const { ms: ingestMs } = await measureStep({
    label: 'ingested files',
    fn: () => ingestFilesToStores({ files: files as any, parseDetectionsForNightId: null }),
  })

  const totalMs = Math.round(performance.now() - tStart)
  console.log('🌀 singlePassIngest: total', { totalMs })

  console.log('🌀 singlePassIngest: timings', { validationMs, indexApplyMs, datasetUpdateMs, ingestMs, totalMs })
  console.log('✅ singlePassIngest: complete', { totalFiles: files.length, totalMs })

  return { ok: true as const }
}

type MeasureStepResult<T> = { result: T; ms: number }

async function measureStep<T>(params: { label: string; fn: () => T | Promise<T> }): Promise<MeasureStepResult<T>> {
  const { label, fn } = params

  const t = performance.now()

  const result = await fn()
  const ms = Math.round(performance.now() - t)

  console.log('🌀 singlePassIngest: ' + label, { ms })

  const out: MeasureStepResult<T> = { result, ms }
  return out
}
