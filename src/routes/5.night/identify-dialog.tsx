import { useEffect, useMemo, useState } from 'react'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command'
import { projectSpeciesSelectionStore, searchSpecies, speciesListsStore, type TaxonRecord } from '~/stores/species-lists'
import { detectionsStore } from '~/stores/entities/detections'
import { useStore } from '@nanostores/react'

export type IdentifyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestions?: string[] // legacy plain-text labels
  onSubmit: (label: string, taxon?: TaxonRecord) => void
  projectId?: string
}

export function IdentifyDialog(props: IdentifyDialogProps) {
  const { open, onOpenChange, suggestions, onSubmit, projectId } = props
  const [query, setQuery] = useState('')
  const selection = useStore(projectSpeciesSelectionStore)
  useStore(speciesListsStore)

  useEffect(() => {
    if (open) setQuery('')
  }, [open])
  const detections = useStore(detectionsStore)

  const options = useMemo(() => {
    const list = suggestions ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list.slice(0, 20)
    return list.filter((s) => s.toLowerCase().includes(q)).slice(0, 20)
  }, [suggestions, query])

  const speciesOptions = useMemo(() => {
    const listId = projectId ? selection?.[projectId] : undefined
    if (!listId) return [] as TaxonRecord[]
    const res = searchSpecies({ speciesListId: listId, query, limit: 20 })
    return res
  }, [selection, projectId, query])

  const recentOptions = useMemo(() => {
    const all = Object.values(detections ?? {})
      .filter((d: any) => d?.detectedBy === 'user' && (!!d?.taxon?.scientificName || !!d?.label))
      .sort((a: any, b: any) => (b?.identifiedAt ?? 0) - (a?.identifiedAt ?? 0))

    const unique: Array<{ label: string; taxon?: TaxonRecord }> = []
    const seen = new Set<string>()
    for (const d of all) {
      const text = (d?.taxon?.scientificName ?? d?.label ?? '').trim()
      const key = text.toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      unique.push({ label: text, taxon: d?.taxon })
      if (unique.length >= 5) break
    }
    return unique
  }, [detections])

  function handleSelect(label: string) {
    const value = (label ?? '').trim()
    if (!value) return
    onSubmit(value)
    onOpenChange(false)
  }

  function handleSelectTaxon(t: TaxonRecord) {
    if (!t?.scientificName) return
    onSubmit(t.scientificName, t)
    onOpenChange(false)
  }

  function handleSubmitFreeText() {
    const value = query.trim()
    if (!value) return
    onSubmit(value)
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} className='max-w-[520px] !p-0'>
      <Command>
        <CommandInput
          placeholder='Type a label (species, genus, family, ...)'
          value={query}
          containerClassName='px-12'
          className='px-12'
          onValueChange={setQuery as any}
          withSearchIcon
          onKeyDown={(e: any) => {
            const hasAnyResults = (speciesOptions?.length ?? 0) > 0 || (options?.length ?? 0) > 0
            if (e.key === 'Enter' && query.trim() && !hasAnyResults) {
              e.preventDefault()
              handleSubmitFreeText()
            }
          }}
        ></CommandInput>
        <CommandList>
          <CommandEmpty>No matches. Press Enter to use your text.</CommandEmpty>
          {query.trim().toUpperCase() === 'ERROR' ? (
            <CommandGroup heading='Actions'>
              <CommandItem onSelect={() => handleSelect('ERROR')}>
                <div className='flex items-center justify-between w-full'>
                  <span className='text-13 text-red-700'>ERROR</span>
                  <span className='text-11 text-neutral-500'>Mark as error</span>
                </div>
              </CommandItem>
            </CommandGroup>
          ) : null}
          {recentOptions.length && (!query.trim() || speciesOptions.length === 0) ? (
            <CommandGroup heading='Recent'>
              {recentOptions.map((r) => (
                <CommandItem key={r.label} onSelect={() => (r.taxon ? handleSelectTaxon(r.taxon) : handleSelect(r.label))}>
                  <div className='flex flex-col'>
                    <span className='text-13'>{r.label}</span>
                    {r.taxon ? (
                      <span className='text-11 text-neutral-500'>
                        {r.taxon.vernacularName || [r.taxon.genus, r.taxon.family, r.taxon.order].filter(Boolean).join(' • ')}
                      </span>
                    ) : null}
                  </div>
                  {r.taxon?.taxonRank ? <span className='ml-auto text-11 text-neutral-600'>{r.taxon.taxonRank}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {speciesOptions.length ? (
            <CommandGroup heading='Species'>
              {speciesOptions.map((t) => (
                <CommandItem key={(t.taxonID as any) ?? t.scientificName} onSelect={() => handleSelectTaxon(t)}>
                  <div className='flex flex-col'>
                    <span className='text-13'>{t.scientificName}</span>
                    <span className='text-11 text-ink-secondary'>
                      {t.vernacularName || [t.genus, t.family, t.order].filter(Boolean).join(' • ')}
                    </span>
                  </div>
                  {t.taxonRank ? <span className='ml-auto text-11 text-neutral-600'>{t.taxonRank}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {query ? <CommandItem onSelect={() => handleSubmitFreeText()}>Use "{query}"</CommandItem> : null}

          <CommandGroup heading='Suggestions'>
            {options.map((opt) => (
              <CommandItem key={opt} onSelect={() => handleSelect(opt)}>
                {opt}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
