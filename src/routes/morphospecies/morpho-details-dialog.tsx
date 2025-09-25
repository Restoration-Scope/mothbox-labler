import { PropsWithChildren, ReactNode, useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '~/components/ui/dialog'
import { nightSummariesStore } from '~/stores/entities/night-summaries'
import { nightsStore } from '~/stores/entities/4.nights'
import { patchesStore } from '~/stores/entities/5.patches'
import { useObjectUrl } from '~/utils/use-object-url'
import { patchFileMapByNightStore, type IndexedFile } from '~/features/folder-processing/files.state'

export type MorphoSpeciesDetailsDialogProps = PropsWithChildren<{
  morphoKey: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}> & { trigger?: ReactNode }

export function MorphoSpeciesDetailsDialog(props: MorphoSpeciesDetailsDialogProps) {
  const { morphoKey, children, open, onOpenChange } = props
  const summaries = useStore(nightSummariesStore)
  const nights = useStore(nightsStore)
  const patches = useStore(patchesStore)
  const patchMapByNight = useStore(patchFileMapByNightStore)

  const usage = useMemo(() => {
    const nightIds: string[] = []
    const projectIds = new Set<string>()
    const previewPairs: Array<{ nightId: string; patchId: string }> = []
    for (const [nightId, s] of Object.entries(summaries ?? {})) {
      const count = (s as any)?.morphoCounts?.[morphoKey]
      if (!count) continue
      nightIds.push(nightId)
      const projectId = (nights?.[nightId] as any)?.projectId
      if (projectId) projectIds.add(projectId)
      const previewId = (s as any)?.morphoPreviewPatchIds?.[morphoKey]
      if (previewId) previewPairs.push({ nightId, patchId: String(previewId) })
    }
    return { nightIds, projectIds: Array.from(projectIds), previewPairs }
  }, [summaries, nights, morphoKey])

  const [previewFile, setPreviewFile] = useState<File | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function pickPreviewFile() {
      // Try from patches store first (if that night was ingested already)
      for (const pair of usage.previewPairs) {
        const f = (patches?.[pair.patchId] as any)?.imageFile?.file as File | undefined
        if (f) {
          if (!cancelled) setPreviewFile(f)
          return
        }
      }

      // Fallback: use patchFileMapByNightStore (available after indexing) and hydrate via handle
      for (const pair of usage.previewPairs) {
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
  }, [usage.previewPairs, patches, patchMapByNight])

  const previewUrl = useObjectUrl(previewFile)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent align='max'>
        <DialogTitle>Morphospecies: {morphoKey}</DialogTitle>

        {previewUrl ? (
          <div className='mt-8'>
            <img src={previewUrl} alt={morphoKey} className='max-h-[240px] rounded border' />
          </div>
        ) : null}

        <div className='mt-12 text-13 text-neutral-700'>
          <span className='mr-12'>Projects: {usage.projectIds.length}</span>
          <span>Nights: {usage.nightIds.length}</span>
        </div>

        {usage.projectIds.length ? (
          <section className='mt-12'>
            <h3 className='mb-6 text-14 font-semibold'>Projects</h3>
            <ul className='list-disc pl-16 text-13'>
              {usage.projectIds.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {usage.nightIds.length ? (
          <section className='mt-12'>
            <h3 className='mb-6 text-14 font-semibold'>Nights</h3>
            <ul className='list-disc pl-16 text-13'>
              {usage.nightIds.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
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

export {}
