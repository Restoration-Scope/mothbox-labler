import { directoryFilesStore, indexedFilesStore } from './files.state'
import { buildNightIndexes } from './files.index'
import { ingestSpeciesListsFromFiles } from '~/features/species-identification/species.ingest'
import { loadProjectSpeciesSelection } from '~/stores/species/project-species-list'
import { nightSummariesStore } from '~/stores/entities/night-summaries'

export function applyIndexedFilesState(params: {
  indexed: Array<{ file?: File; handle?: unknown; path: string; name: string; size: number }>
}) {
  const { indexed } = params
  if (!Array.isArray(indexed) || indexed.length === 0) return

  directoryFilesStore.set(indexed.map((i) => i.file).filter((f): f is File => !!f))
  indexedFilesStore.set(indexed)

  buildNightIndexes({ files: indexed })

  preloadNightSummariesFromIndexed(indexed)

  // Ingest species lists from either File or Handle entries
  void ingestSpeciesListsFromFiles({ files: indexed })
  void loadProjectSpeciesSelection()
}

export function preloadNightSummariesFromIndexed(
  indexed: Array<{ file?: File; handle?: unknown; path: string; name: string; size: number }>,
) {
  try {
    const summaries: Record<
      string,
      {
        nightId: string
        totalDetections: number
        totalIdentified: number
        updatedAt?: number
        morphoCounts?: Record<string, number>
        morphoPreviewPatchIds?: Record<string, string>
      }
    > = {}
    for (const it of indexed) {
      const lower = (it?.name ?? '').toLowerCase()
      if (lower !== 'night_summary.json') continue
      const pathNorm = (it?.path ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
      const parts = pathNorm.split('/').filter(Boolean)
      if (parts.length < 2) continue
      const baseParts = parts.slice(0, -1)
      let nightId = ''
      if (baseParts.length >= 4) {
        nightId = baseParts.slice(0, 4).join('/')
      } else if (baseParts.length === 3) {
        const [project, deployment, night] = baseParts
        const site = deriveSiteFromDeploymentFolder(deployment)
        nightId = [project, site, deployment, night].join('/')
      } else {
        continue
      }
      summaries[nightId] = { nightId, totalDetections: 0, totalIdentified: 0 }
      void ensureTextFromIndexedEntry(it as any)
        .then((txt) => JSON.parse(txt))
        .then((json) => {
          const s = {
            nightId,
            totalDetections: Number(json?.totalDetections) || 0,
            totalIdentified: Number(json?.totalIdentified) || 0,
            updatedAt: typeof json?.updatedAt === 'number' ? json.updatedAt : undefined,
            morphoCounts:
              typeof json?.morphoCounts === 'object' && json?.morphoCounts ? (json.morphoCounts as Record<string, number>) : undefined,
            morphoPreviewPatchIds:
              typeof json?.morphoPreviewPatchIds === 'object' && json?.morphoPreviewPatchIds
                ? (json.morphoPreviewPatchIds as Record<string, string>)
                : undefined,
          }
          const current = nightSummariesStore.get() || {}
          nightSummariesStore.set({ ...current, [nightId]: s })
        })
        .catch(() => {})
    }
    if (Object.keys(summaries).length) {
      const current = nightSummariesStore.get() || {}
      nightSummariesStore.set({ ...current, ...summaries })
    }
  } catch {
    return
  }
}

function deriveSiteFromDeploymentFolder(deploymentFolderName: string) {
  const name = deploymentFolderName ?? ''
  if (!name) return ''
  const parts = name.split('_').filter(Boolean)
  if (parts.length >= 2) return parts[1]
  return name
}

async function ensureTextFromIndexedEntry(entry: { file?: File; handle?: { getFile?: () => Promise<File> } }) {
  if (entry?.file) {
    const text = await entry.file.text()
    return text
  }

  const file = await entry?.handle?.getFile?.()
  if (!file) return ''

  const text = await file.text()
  return text
}
