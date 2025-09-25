import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'
import { nightSummariesStore } from '~/stores/entities/night-summaries'
import { Button } from '~/components/ui/button'
import { MorphoSpeciesDetailsDialog } from './morpho-details-dialog'
import { nightsStore } from '~/stores/entities/4.nights'
import { patchesStore } from '~/stores/entities/5.patches'
import { useObjectUrl } from '~/utils/use-object-url'
import { patchFileMapByNightStore, type IndexedFile } from '~/features/folder-processing/files.state'

export function MorphospeciesIndex() {
  const list = useMorphoIndexList()

  return (
    <div className='p-20 h-full overflow-y-auto'>
      <div className='flex items-center gap-12 mb-12'>
        <h2 className='text-lg font-semibold'>Morphospecies</h2>
      </div>

      {!list.length ? (
        <p className='text-sm text-neutral-500'>No morphospecies found. Identify detections with free text to add morphospecies.</p>
      ) : (
        <ul className='grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-12'>
          {list.map((it) => (
            <MorphoCard key={it.key} morphoKey={it.key} count={it.count} />
          ))}
        </ul>
      )}
    </div>
  )
}

type MorphoCardProps = { morphoKey: string; count: number }

function MorphoCard(props: MorphoCardProps) {
  const { morphoKey, count } = props

  const previewUrl = useMorphoPreviewUrl({ morphoKey })

  return (
    <li className='rounded-md border bg-white p-12'>
      {previewUrl ? (
        <div className='-mt-4 -mx-4 mb-8'>
          <img src={previewUrl} alt={morphoKey} className='w-full h-[200px] object-contain rounded border' />
        </div>
      ) : null}
      <div className='flex items-center gap-8'>
        <span className='font-medium text-ink-primary truncate'>{displayFromKey(morphoKey)}</span>
        <span className='ml-auto text-12 text-neutral-600'>{count}</span>
      </div>
      <div className='mt-8'>
        <MorphoSpeciesDetailsDialog morphoKey={morphoKey}>
          <Button size='xsm'>View usage</Button>
        </MorphoSpeciesDetailsDialog>
      </div>
    </li>
  )
}

async function ensureFileFromIndexed(indexed: IndexedFile): Promise<File | undefined> {
  const existing = (indexed as any)?.file as File | undefined
  if (existing) return existing
  const handle = (indexed as any)?.handle as { getFile?: () => Promise<File> } | undefined
  if (handle && typeof handle.getFile === 'function') {
    try {
      const file = await handle.getFile()
      return file
    } catch {
      return undefined
    }
  }
  return undefined
}

function displayFromKey(key: string) {
  // For now we just show the key; keys are normalized lowercase
  const res = key
  return res
}

// Hooks

function useMorphoIndexList() {
  const summaries = useStore(nightSummariesStore)

  const list = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of Object.values(summaries ?? {})) {
      const m = (s as any)?.morphoCounts as Record<string, number> | undefined
      if (!m) continue
      for (const [k, v] of Object.entries(m)) counts[k] = (counts[k] || 0) + (typeof v === 'number' ? v : 0)
    }
    const arr = Object.entries(counts)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
    return arr
  }, [summaries])

  return list
}

function useMorphoPreviewUrl(params: { morphoKey: string }) {
  const { morphoKey } = params
  const summaries = useStore(nightSummariesStore)
  const nights = useStore(nightsStore)
  const patches = useStore(patchesStore)
  const patchMapByNight = useStore(patchFileMapByNightStore)

  const previewPairs = useMemo(() => {
    const pairs: Array<{ nightId: string; patchId: string }> = []
    for (const [nightId, s] of Object.entries(summaries ?? {})) {
      const countForKey = (s as any)?.morphoCounts?.[morphoKey]
      if (!countForKey) continue
      if (!nights?.[nightId]) continue
      const pid = (s as any)?.morphoPreviewPatchIds?.[morphoKey]
      if (pid) pairs.push({ nightId, patchId: String(pid) })
    }
    return pairs
  }, [summaries, nights, morphoKey])

  const [previewFile, setPreviewFile] = useState<File | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function pickPreviewFile() {
      for (const pair of previewPairs) {
        const f = (patches?.[pair.patchId] as any)?.imageFile?.file as File | undefined
        if (f) {
          if (!cancelled) setPreviewFile(f)
          return
        }
      }
      for (const pair of previewPairs) {
        const mapForNight = patchMapByNight?.[pair.nightId]
        const indexed: IndexedFile | undefined = mapForNight?.[pair.patchId.toLowerCase()]
        if (!indexed) continue
        const file = await ensureFileFromIndexed(indexed)
        if (file) {
          if (!cancelled) setPreviewFile(file)
          return
        }
      }
      if (!cancelled) setPreviewFile(undefined)
    }
    void pickPreviewFile()
    return () => {
      cancelled = true
    }
  }, [previewPairs, patches, patchMapByNight])

  const previewUrl = useObjectUrl(previewFile)
  return previewUrl
}
