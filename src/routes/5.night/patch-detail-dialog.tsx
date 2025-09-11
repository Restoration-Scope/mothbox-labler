import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { detectionStoreById, labelDetections } from '~/stores/entities/detections'
import { patchStoreById } from '~/stores/entities/patch-selectors'
import { photosStore } from '~/stores/entities/photos'
import { IdentifyDialog } from './identify-dialog'
import { SpeciesPicker } from '~/components/species-picker'
import { projectSpeciesSelectionStore, speciesListsStore } from '~/stores/species-lists'
import type { TaxonRecord } from '~/stores/species-lists'
import { TaxonRankBadge } from '~/components/taxon-rank-badge'

export type PatchDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  patchId?: string | null
}

export function PatchDetailDialog(props: PatchDetailDialogProps) {
  const { open, onOpenChange, patchId } = props

  const patch = useStore(patchStoreById(patchId || ''))
  const detection = useStore(detectionStoreById(patchId || ''))
  const photos = useStore(photosStore)
  const photo = patch?.photoId ? photos?.[patch.photoId] : undefined

  const patchUrl = useMemo(() => {
    const file = patch?.imageFile?.file
    if (!file) return ''
    const url = URL.createObjectURL(file)
    return url
  }, [patch?.imageFile?.file])

  const photoUrl = useMemo(() => {
    const file = photo?.imageFile?.file
    if (!file) return ''
    const url = URL.createObjectURL(file)
    return url
  }, [photo?.imageFile?.file])

  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false)
  const [identifyPending, setIdentifyPending] = useState(false)
  const projectId = useMemo(() => getProjectIdFromNightId(patch?.nightId), [patch?.nightId])

  useEffect(() => {
    return () => {
      if (patchUrl) URL.revokeObjectURL(patchUrl)
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    }
  }, [patchUrl, photoUrl])

  function onCopy(text?: string) {
    const value = (text ?? '').trim()
    if (!value) return
    void navigator?.clipboard?.writeText?.(value)
  }

  function onIdentifySubmit(label: string, taxon?: TaxonRecord) {
    const detectionId = patch?.id
    const trimmed = (label ?? '').trim()
    if (!detectionId || !trimmed) return

    labelDetections({ detectionIds: [detectionId], label: trimmed, taxon })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent align='max'>
        <DialogHeader>
          <DialogTitle>Patch details</DialogTitle>
          <DialogDescription>Preview the patch and its source photo. Open assets or copy their paths.</DialogDescription>
        </DialogHeader>

        <div className='grid grid-cols-1 gap-12 md:grid-cols-2'>
          <div className='space-y-8'>
            <h4 className='text-14 font-semibold'>Patch</h4>
            {patchUrl ? (
              <img
                src={patchUrl}
                alt={patch?.name ?? 'patch'}
                className='w-full max-h-[60vh] object-contain rounded-md border border-black/10'
              />
            ) : (
              <div className='w-full h-[200px] rounded-md border border-black/10 bg-neutral-50' />
            )}
            <div className='flex flex-wrap gap-8'>
              {patchUrl ? (
                <a href={patchUrl} target='_blank' rel='noreferrer'>
                  <Button size='xsm' variant='outline'>
                    Open patch
                  </Button>
                </a>
              ) : null}
              <Button size='xsm' variant='outline' onClick={() => onCopy(patch?.imageFile?.path)}>
                Copy patch path
              </Button>
            </div>

            <div className='text-12 text-neutral-700 break-all'>
              <span className='font-medium'>File path:</span> {patch?.imageFile?.path ?? '—'}
            </div>

            <div className='text-12 text-neutral-700 break-all mt-12'>
              <span className='font-medium'>Patch ID:</span> {patch?.id}
            </div>
          </div>

          <div className='space-y-8'>
            <h4 className='text-14 font-semibold'>Source photo</h4>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={photo?.name ?? 'photo'}
                className='w-full max-h-[60vh] object-contain rounded-md border border-black/10'
              />
            ) : (
              <div className='w-full h-[200px] rounded-md border border-black/10 bg-neutral-50' />
            )}
            <div className='flex flex-wrap gap-8'>
              {photoUrl ? (
                <a href={photoUrl} target='_blank' rel='noreferrer'>
                  <Button size='xsm' variant='outline'>
                    Open photo
                  </Button>
                </a>
              ) : null}
              <Button size='xsm' variant='outline' onClick={() => onCopy(photo?.imageFile?.path)}>
                Copy photo path
              </Button>
            </div>
            <div className='text-12 text-neutral-700 break-all'>
              <div>
                <span className='font-medium'>Photo ID:</span> {photo?.id}
              </div>
              <div>
                <span className='font-medium'>File path:</span> {photo?.imageFile?.path ?? '—'}
              </div>
            </div>
          </div>
        </div>

        <div className='mt-12 grid grid-cols-1 md:grid-cols-2 gap-12 text-12 text-neutral-700'>
          <div className='space-y-4'>
            <h4 className='text-14 font-semibold text-neutral-800'>Detection</h4>
            <div>
              <span className='font-medium'>Label:</span> {detection?.label ?? 'Unlabeled'}
            </div>
            <div>
              <span className='font-medium'>Detected by:</span> {detection?.detectedBy ?? 'auto'}
            </div>
            <div>
              <span className='font-medium'>Score:</span> {detection?.score ?? '—'}
            </div>
            <div>
              <span className='font-medium'>Shape:</span> {detection?.shapeType ?? '—'}
            </div>
            <div>
              <span className='font-medium'>Points:</span> {Array.isArray(detection?.points) ? detection!.points!.length : 0}
            </div>
            <div className='pt-8'>
              <Button
                size='sm'
                onClick={() => {
                  setIdentifyPending(true)
                  const selectionByProject = projectSpeciesSelectionStore.get() || {}
                  const hasSelection = !!selectionByProject?.[projectId || '']
                  const anySpeciesLists = Object.keys(speciesListsStore.get() || {}).length > 0
                  if (!hasSelection && anySpeciesLists) {
                    setSpeciesPickerOpen(true)
                    return
                  }
                  setIdentifyOpen(true)
                  setIdentifyPending(false)
                }}
              >
                Identify
              </Button>
            </div>

            <div className='pt-8 space-y-2'>
              <h5 className='text-13 font-semibold text-neutral-800'>Taxonomy</h5>
              <div>
                <span className='font-medium'>Scientific name:</span> {detection?.taxon?.scientificName ?? '—'}
              </div>
              <div className='flex items-center gap-8'>
                <span className='font-medium'>Rank:</span>
                {detection?.taxon?.taxonRank ? <TaxonRankBadge rank={detection?.taxon?.taxonRank} /> : '—'}
              </div>
              <div>
                <span className='font-medium'>Kingdom:</span> {detection?.taxon?.kingdom ?? '—'}
              </div>
              <div>
                <span className='font-medium'>Phylum:</span> {detection?.taxon?.phylum ?? '—'}
              </div>
              <div>
                <span className='font-medium'>Class:</span> {detection?.taxon?.class ?? '—'}
              </div>
              <div>
                <span className='font-medium'>Order:</span> {detection?.taxon?.order ?? '—'}
              </div>
              <div>
                <span className='font-medium'>Family:</span> {detection?.taxon?.family ?? '—'}
              </div>
              <div>
                <span className='font-medium'>Genus:</span> {detection?.taxon?.genus ?? '—'}
              </div>
              <div>
                <span className='font-medium'>Species:</span> {detection?.taxon?.species ?? '—'}
              </div>
            </div>
          </div>
          <div className='space-y-4'>
            <h4 className='text-14 font-semibold text-neutral-800'>Links</h4>
            <div>
              <span className='font-medium'>Night:</span> {patch?.nightId ?? '—'}
            </div>
            <div>
              <span className='font-medium'>Photo:</span> {patch?.photoId ?? '—'}
            </div>
            <div>
              <span className='font-medium'>Patch:</span> {patch?.name ?? '—'}
            </div>
          </div>
        </div>
        <SpeciesPicker
          open={speciesPickerOpen}
          onOpenChange={(open) => {
            setSpeciesPickerOpen(open)
            if (!open && identifyPending) {
              const selectionByProject = projectSpeciesSelectionStore.get() || {}
              const hasSelection = !!selectionByProject?.[projectId || '']
              if (hasSelection) setIdentifyOpen(true)
              setIdentifyPending(false)
            }
          }}
          projectId={projectId || ''}
        />
        <IdentifyDialog open={identifyOpen} onOpenChange={setIdentifyOpen} onSubmit={onIdentifySubmit} projectId={projectId} />
      </DialogContent>
    </Dialog>
  )
}

function getProjectIdFromNightId(nightId?: string | null) {
  const id = (nightId ?? '').trim()
  if (!id) return undefined
  const parts = id.split('/').filter(Boolean)
  if (!parts.length) return undefined
  const projectId = parts[0]
  return projectId
}
