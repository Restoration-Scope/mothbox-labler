import { PropsWithChildren, ReactNode, useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '~/components/ui/dialog'
import { nightSummariesStore } from '~/stores/entities/night-summaries'
import { nightsStore } from '~/stores/entities/4.nights'
import { patchesStore } from '~/stores/entities/5.patches'
import { detectionsStore, type DetectionEntity } from '~/stores/entities/detections'
import { useObjectUrl } from '~/utils/use-object-url'
import { patchFileMapByNightStore, type IndexedFile } from '~/features/folder-processing/files.state'
import { morphoCoversStore, normalizeMorphoKey } from '~/stores/morphospecies/covers'
import { Button } from '~/components/ui/button'
import { aggregateTaxonomyFromDetections, getTaxonomyFieldLabel } from '~/models/taxonomy'
import { ImageWithDownloadName } from '~/components/atomic/image-with-download-name'

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
  const covers = useStore(morphoCoversStore)
  const allDetections = useStore(detectionsStore)

  const usage = useMemo(() => {
    const nightIds: string[] = []
    const projectIds = new Set<string>()
    const previewPairs: Array<{ nightId: string; patchId: string }> = []

    const override = covers?.[normalizeMorphoKey(morphoKey)]
    if (override?.nightId && override?.patchId) previewPairs.push({ nightId: override.nightId, patchId: override.patchId })

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
  }, [summaries, nights, morphoKey, covers])

  const taxonomy = useMemo(() => {
    const morphoDetections = Object.values(allDetections ?? {}).filter((d) => {
      const morpho = typeof d?.morphospecies === 'string' ? d.morphospecies : ''
      return normalizeMorphoKey(morpho) === normalizeMorphoKey(morphoKey) && d?.detectedBy === 'user'
    })

    if (!morphoDetections.length) return null

    const aggregatedTaxonomy = aggregateTaxonomyFromDetections({ detections: morphoDetections })
    return aggregatedTaxonomy
  }, [allDetections, morphoKey])

  const [previewFile, setPreviewFile] = useState<File | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function pickPreviewFile() {
      for (const pair of usage.previewPairs) {
        const f = (patches?.[pair.patchId] as any)?.imageFile?.file as File | undefined
        if (f) {
          if (!cancelled) setPreviewFile(f)
          return
        }
      }

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

        <div className='mt-8'>
          <ImageWithDownloadName src={previewUrl} alt={morphoKey} downloadName={morphoKey} className='max-h-[240px] rounded border' />
        </div>

        <div className='mt-12 text-13 text-neutral-700'>
          <span className='mr-12'>Projects: {usage.projectIds.length}</span>
          <span>Nights: {usage.nightIds.length}</span>
        </div>

        {taxonomy ? (
          <section className='mt-12'>
            <h3 className='mb-6 text-14 font-semibold'>Taxonomy</h3>
            <div className='space-y-2 text-13'>
              {Object.entries(taxonomy)
                .filter(([, value]) => value != null)
                .map(([key, value]) => (
                  <div key={key}>
                    <span className='font-medium'>{getTaxonomyFieldLabel(key)}:</span> {value}
                  </div>
                ))}
            </div>
          </section>
        ) : null}

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
            <ul className='space-y-6 text-13'>
              {usage.nightIds.map((n) => {
                const parts = (n || '').split('/')
                const projectId = parts?.[0]
                const siteId = parts?.[1]
                const deploymentId = parts?.[2]
                const nightId = parts?.[3]

                const hasAll = !!(projectId && siteId && deploymentId && nightId)

                const href = hasAll
                  ? `/projects/${encodeURIComponent(projectId)}/sites/${encodeURIComponent(siteId)}/deployments/${encodeURIComponent(
                      deploymentId,
                    )}/nights/${encodeURIComponent(nightId)}`
                  : undefined

                return (
                  <li key={n} className='flex items-center gap-8'>
                    <span className='truncate'>{n}</span>
                    {hasAll ? (
                      <Button size='xsm' to={href}>
                        View
                      </Button>
                    ) : null}
                  </li>
                )
              })}
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
