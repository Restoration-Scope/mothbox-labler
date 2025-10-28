import { useEffect, useMemo, useState } from 'react'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command'
import { projectSpeciesSelectionStore } from '~/stores/species/project-species-list'
import { searchSpecies } from '~/features/species-identification/species-search'
import { TaxonRecord } from './species-list.store'

import { useStore } from '@nanostores/react'
import { DialogTitle } from '@radix-ui/react-dialog'
import { TaxonRankBadge, TaxonRankLetterBadge } from '~/components/taxon-rank-badge'
import { detectionsStore, type DetectionEntity } from '~/stores/entities/detections'
import { Column } from '~/styles'

const MAX_SPECIES_UI_RESULTS = 50

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
  const detections = useStore(detectionsStore)

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const speciesOptions = useMemo(() => {
    const res = getSpeciesOptions({ selection, projectId, query })
    return res
  }, [selection, projectId, query])

  const speciesOptionsLimited = useMemo(() => {
    const list = speciesOptions || []
    const res = list.slice(0, MAX_SPECIES_UI_RESULTS)
    return res
  }, [speciesOptions])

  const recentOptions = useMemo(() => {
    const res = getRecentOptions({ detections })
    return res
  }, [detections])

  const filteredRecentOptions = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase()
    if (!q) return recentOptions
    const filtered = (recentOptions || []).filter((r) => (r?.label || '').toLowerCase().includes(q))
    return filtered
  }, [recentOptions, query])

  function handleSelect(label: string) {
    const value = (label ?? '').trim()
    if (!value) return
    onSubmit(value)
    onOpenChange(false)
  }

  function handleSelectTaxon(t: TaxonRecord) {
    if (!t) return
    const preferred = (t?.scientificName ?? '').trim()
    const label = preferred || getDisplayLabelForTaxon(t)
    if (!label) return
    onSubmit(label, t)
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

          {(!query.trim() && recentOptions.length > 0) || (query.trim() && filteredRecentOptions.length > 0) ? (
            <CommandGroup heading='Recent'>
              {(query.trim() ? filteredRecentOptions : recentOptions).map((r) => (
                <SpeciesOptionRow
                  key={r.label}
                  label={r.label}
                  taxon={r.taxon}
                  onSelect={() => (r.taxon ? handleSelectTaxon(r.taxon) : handleSelect(r.label))}
                  subtitleClassName='text-11 text-neutral-500 flex items-center gap-4'
                />
              ))}
            </CommandGroup>
          ) : null}

          {speciesOptionsLimited?.length ? (
            <CommandGroup heading='Species'>
              {speciesOptionsLimited.map((t) => (
                <SpeciesOptionRow
                  key={(t.taxonID as any) ?? t.scientificName}
                  label={getDisplayLabelForTaxon(t)}
                  taxon={t}
                  onSelect={() => handleSelectTaxon(t)}
                  itemClassName='row gap-x-8 !py-8'
                />
              ))}
            </CommandGroup>
          ) : null}

          {query && (
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
          )}

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
        <TaxonRankLetterBadge key={r} rank={r} size='xsm' />
      ))}
    </span>
  )
}

type SpeciesOptionRowProps = {
  label: string
  taxon?: TaxonRecord
  onSelect: () => void
  itemClassName?: string
  subtitleClassName?: string
}

function SpeciesOptionRow(props: SpeciesOptionRowProps) {
  const { label, taxon, onSelect, itemClassName, subtitleClassName } = props

  return (
    <CommandItem onSelect={onSelect} className={itemClassName}>
      <Column className='gap-0 flex-1'>
        <span className='text-14 line-clamp-1'>{label}</span>
        {taxon && (
          <span className={subtitleClassName ?? 'text-11 text-ink-secondary flex items-center gap-4'}>
            <RankLettersInline taxon={taxon} />
            {taxon.vernacularName || [taxon.genus, taxon.family, taxon.order].filter(Boolean).join(' • ')}
          </span>
        )}
      </Column>

      {taxon?.taxonRank && <TaxonRankBadge rank={taxon.taxonRank} />}
    </CommandItem>
  )
}

function getDisplayLabelForTaxon(t: TaxonRecord) {
  const rank = (t?.taxonRank ?? '').toLowerCase()
  if (rank === 'species') return t.species || t.scientificName
  if (rank === 'genus') return t.genus || t.scientificName
  if (rank === 'family') return t.family || t.scientificName
  if (rank === 'order') return t.order || t.scientificName
  if (rank === 'class') return (t as any)?.class || t.scientificName
  if (rank === 'phylum') return t.phylum || t.scientificName
  if (rank === 'kingdom') return t.kingdom || t.scientificName
  return t.scientificName || t.species || t.genus || t.family || t.order || t.phylum || t.kingdom || ''
}

// Helpers (atomic) — keep at bottom

type GetSpeciesOptionsParams = {
  selection?: Record<string, string>
  projectId?: string
  query: string
}

function getSpeciesOptions(params: GetSpeciesOptionsParams) {
  const { selection, projectId, query } = params

  const listId = projectId ? selection?.[projectId] : undefined
  if (!listId) {
    if (query.trim()) console.log('🌀 identify: no species list selected for project', { projectId, query })
    const empty: TaxonRecord[] = []
    return empty
  }

  const result = searchSpecies({ speciesListId: listId, query, limit: 20 })

  if (query.trim())
    console.log('✅ identify: species results', {
      projectId,
      listId,
      q: query,
      count: result.length,
      sample: result.slice(0, 10).map((t) => ({
        name: t?.scientificName,
        rank: t?.taxonRank,
        genus: t?.genus,
        family: t?.family,
        order: t?.order,
      })),
    })

  const res = result
  return res
}

type GetRecentOptionsParams = {
  detections?: Record<string, DetectionEntity>
}

function getRecentOptions(params: GetRecentOptionsParams) {
  const { detections } = params

  const all = Object.values(detections ?? {})
    .filter((d: DetectionEntity | undefined) => d?.detectedBy === 'user' && (!!d?.taxon?.scientificName || !!d?.label))
    .sort((a, b) => ((b?.identifiedAt ?? 0) as number) - ((a?.identifiedAt ?? 0) as number))

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

  const res = unique
  return res
}
