import { useEffect, useMemo, useState } from 'react'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command'
import { searchSpecies, speciesListsStore, type TaxonRecord } from '~/stores/species/species-lists'
import { projectSpeciesSelectionStore } from '~/stores/species/project-species-list'

import { detectionsStore } from '~/stores/entities/detections'
import { useStore } from '@nanostores/react'
import { TaxonRankBadge, TaxonRankLetterBadge } from '~/components/taxon-rank-badge'
import { Row } from '~/styles'
import { DialogTitle } from '@radix-ui/react-dialog'

export type IdentifyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (label: string, taxon?: TaxonRecord) => void
  projectId?: string
}

export function IdentifyDialog(props: IdentifyDialogProps) {
  const { open, onOpenChange, onSubmit, projectId } = props
  const [query, setQuery] = useState('')
  const selection = useStore(projectSpeciesSelectionStore)
  useStore(speciesListsStore)

  useEffect(() => {
    if (open) setQuery('')
  }, [open])
  const detections = useStore(detectionsStore)

  const speciesOptions = useMemo(() => {
    const listId = projectId ? selection?.[projectId] : undefined
    if (!listId) {
      if (query.trim()) console.log('🌀 identify: no species list selected for project', { projectId, query })
      return [] as TaxonRecord[]
    }
    const res = searchSpecies({ speciesListId: listId, query, limit: 20 })
    if (query.trim())
      console.log('✅ identify: species results', {
        projectId,
        listId,
        q: query,
        count: res.length,
        sample: res.slice(0, 10).map((t) => ({
          name: t?.scientificName,
          rank: t?.taxonRank,
          genus: t?.genus,
          family: t?.family,
          order: t?.order,
        })),
      })
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
      <DialogTitle className='hidden'>Identitfy</DialogTitle>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder='Type a label (species, genus, family, ...)'
          value={query}
          onValueChange={setQuery as any}
          withSearchIcon
          onKeyDown={(e: any) => {
            const hasAnyResults = (speciesOptions?.length ?? 0) > 0
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
                      <span className='text-11 text-neutral-500 flex items-center gap-4'>
                        <RankLettersInline taxon={r.taxon} />
                        {r.taxon.vernacularName || [r.taxon.genus, r.taxon.family, r.taxon.order].filter(Boolean).join(' • ')}
                      </span>
                    ) : null}
                  </div>
                  {r.taxon?.taxonRank ? (
                    <div className='ml-auto'>
                      <TaxonRankBadge rank={r.taxon.taxonRank} />
                    </div>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {speciesOptions?.length ? (
            <CommandGroup heading='Species'>
              {speciesOptions.map((t) => (
                <CommandItem key={(t.taxonID as any) ?? t.scientificName} onSelect={() => handleSelectTaxon(t)}>
                  <Row className='gap-12'>
                    <span className='text-13'>{t.scientificName}</span>
                    <span className='text-11 text-ink-secondary flex items-center gap-4'>
                      <RankLettersInline taxon={t} />
                      {t.vernacularName || [t.genus, t.family, t.order].filter(Boolean).join(' • ')}
                    </span>
                  </Row>

                  {t.taxonRank ? (
                    <div className='ml-auto'>
                      <TaxonRankBadge rank={t.taxonRank} />
                    </div>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {/* {query && (
            <CommandGroup>
              <CommandItem key='morphospecies' onSelect={() => handleSubmitFreeText()} className='aria-selected:bg-brand/20 '>
                <span className='text-brand font-medium'>Add morpho species: "{query}"</span>
              </CommandItem>

              <CommandItem key='genus' onSelect={() => handleSubmitFreeText()} className='aria-selected:bg-brand/20 '>
                <span className='text-brand font-medium'>Add Genus"{query}"</span>
              </CommandItem>

              <CommandItem key='tribe' onSelect={() => handleSubmitFreeText()} className='aria-selected:bg-brand/20 '>
                <span className='text-brand font-medium'>Add Tribe"{query}"</span>
              </CommandItem>

              <CommandItem key='subfamily' onSelect={() => handleSubmitFreeText()} className='aria-selected:bg-brand/20 '>
                <span className='text-brand font-medium'>Add Subfamily"{query}"</span>
              </CommandItem>

              <CommandItem key='family' onSelect={() => handleSubmitFreeText()} className='aria-selected:bg-brand/20 '>
                <span className='text-brand font-medium'>Add Family"{query}"</span>
              </CommandItem>

              <CommandItem key='suborder' onSelect={() => handleSubmitFreeText()} className='aria-selected:bg-brand/20 '>
                <span className='text-brand font-medium'>Add Suborder"{query}"</span>
              </CommandItem>
            </CommandGroup>
          )} */}

          {/* No legacy suggestions rendered */}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

type RankLettersInlineProps = {
  taxon?: TaxonRecord
}

function RankLettersInline(props: RankLettersInlineProps) {
  const { taxon } = props

  const ranks: string[] = []

  if (taxon?.genus) ranks.push('genus')
  if (taxon?.family) ranks.push('family')
  if (taxon?.order) ranks.push('order')

  if (!ranks.length) return null

  return (
    <span className='flex items-center gap-4'>
      {ranks.map((r) => (
        <TaxonRankLetterBadge key={r} rank={r} size='sm' />
      ))}
    </span>
  )
}
