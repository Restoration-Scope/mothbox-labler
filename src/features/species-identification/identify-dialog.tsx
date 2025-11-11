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
import { deriveTaxonName } from '~/models/taxonomy'

const MAX_SPECIES_UI_RESULTS = 50

export type IdentifyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (label: string, taxon?: TaxonRecord) => void
  projectId?: string
  detectionIds?: string[]
}

export function IdentifyDialog(props: IdentifyDialogProps) {
  const { open, onOpenChange, onSubmit, projectId, detectionIds } = props

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

  useEffect(() => {
    if (query.trim().toLowerCase() === 'diptera' && speciesOptions?.length) {
      console.log('🔍 Diptera search results:', {
        count: speciesOptions.length,
        results: speciesOptions.map((r) => {
          const parts: string[] = []
          const kingdom = String(r?.kingdom ?? '')
            .trim()
            .toLowerCase()
          if (!kingdom) return { ...r, stableKey: '' }
          parts.push(kingdom)

          const rank = String(r?.taxonRank ?? '')
            .trim()
            .toLowerCase()
          if (rank === 'kingdom') {
            return { ...r, stableKey: parts.join(':') }
          }

          const phylum = String(r?.phylum ?? '')
            .trim()
            .toLowerCase()
          if (phylum) parts.push(phylum)
          if (rank === 'phylum') {
            return { ...r, stableKey: parts.join(':') }
          }

          const className = String(r?.class ?? '')
            .trim()
            .toLowerCase()
          if (className) parts.push(className)
          if (rank === 'class') {
            return { ...r, stableKey: parts.join(':') }
          }

          const order = String(r?.order ?? '')
            .trim()
            .toLowerCase()
          if (order) parts.push(order)
          if (rank === 'order') {
            return { ...r, stableKey: parts.join(':') }
          }

          const family = String(r?.family ?? '')
            .trim()
            .toLowerCase()
          if (family) parts.push(family)
          if (rank === 'family') {
            return { ...r, stableKey: parts.join(':') }
          }

          const genus = String(r?.genus ?? '')
            .trim()
            .toLowerCase()
          if (genus) parts.push(genus)
          if (rank === 'genus') {
            return { ...r, stableKey: parts.join(':') }
          }

          const species = String(r?.species ?? '')
            .trim()
            .toLowerCase()
          if (species) parts.push(species)
          if (rank === 'species') {
            return { ...r, stableKey: parts.join(':') }
          }

          return {
            taxonID: r.taxonID,
            scientificName: r.scientificName,
            taxonRank: r.taxonRank,
            order: r.order,
            family: r.family,
            genus: r.genus,
            species: r.species,
            taxonomicStatus: r.taxonomicStatus,
            stableKey: parts.join(':'),
          }
        }),
      })
    }
  }, [query, speciesOptions])

  const speciesOptionsLimited = useMemo(() => {
    const list = speciesOptions || []
    const res = list.slice(0, MAX_SPECIES_UI_RESULTS)
    console.log('🔍 identify: species options', {
      query: query.trim() || '(empty)',
      count: res.length,
      items: res.map((t) => ({
        label: getDisplayLabelForTaxon(t),
        scientificName: t.scientificName,
        taxonRank: t.taxonRank,
        order: t.order,
        family: t.family,
        genus: t.genus,
        species: t.species,
      })),
    })
    return res
  }, [speciesOptions, query])

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

  const morphoOptions = useMemo(() => {
    const res = getMorphoOptions({ detections, projectId, query })
    return res
  }, [detections, projectId, query])

  const morphoOptionsLimited = useMemo(() => {
    const list = morphoOptions || []
    const res = list.slice(0, MAX_SPECIES_UI_RESULTS)
    return res
  }, [morphoOptions])

  function handleSelect(label: string) {
    const value = (label ?? '').trim()
    if (!value) return
    onSubmit(value)
    logIdentificationResult({ detectionIds })
    onOpenChange(false)
  }

  function handleSelectTaxon(t: TaxonRecord) {
    if (!t) return
    const preferred = (t?.scientificName ?? '').trim()
    const label = preferred || getDisplayLabelForTaxon(t)
    if (!label) return
    onSubmit(label, t)
    logIdentificationResult({ detectionIds })
    onOpenChange(false)
  }

  function handleSubmitFreeText() {
    const value = query.trim()
    if (!value) return
    onSubmit(value)
    logIdentificationResult({ detectionIds })
    onOpenChange(false)
  }

  function handleSubmitClass() {
    const value = (query ?? '').trim()
    if (!value) return
    const t: TaxonRecord = { scientificName: value, taxonRank: 'class', class: value }
    handleSelectTaxon(t)
  }

  function handleSubmitOrder() {
    const value = (query ?? '').trim()
    if (!value) return
    const t: TaxonRecord = { scientificName: value, taxonRank: 'order', order: value }
    handleSelectTaxon(t)
  }

  function handleSubmitGenus() {
    const value = (query ?? '').trim()
    if (!value) return
    const t: TaxonRecord = { scientificName: value, taxonRank: 'genus', genus: value }
    handleSelectTaxon(t)
  }

  function handleSubmitFamily() {
    const value = (query ?? '').trim()
    if (!value) return
    const t: TaxonRecord = { scientificName: value, taxonRank: 'family', family: value }
    handleSelectTaxon(t)
  }

  function handleSubmitTribe() {
    const value = (query ?? '').trim()
    if (!value) return
    const t: TaxonRecord = { scientificName: value, taxonRank: 'tribe' }
    handleSelectTaxon(t)
  }

  function handleSubmitSubfamily() {
    const value = (query ?? '').trim()
    if (!value) return
    const t: TaxonRecord = { scientificName: value, taxonRank: 'subfamily' }
    handleSelectTaxon(t)
  }

  function handleSubmitSuborder() {
    const value = (query ?? '').trim()
    if (!value) return
    const t: TaxonRecord = { scientificName: value, taxonRank: 'suborder' }
    handleSelectTaxon(t)
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
                  isMorphospecies={r.isMorphospecies}
                  onSelect={() => (r.taxon ? handleSelectTaxon(r.taxon) : handleSelect(r.label))}
                  subtitleClassName='text-11 text-neutral-500 flex items-center gap-4'
                />
              ))}
            </CommandGroup>
          ) : null}

          {morphoOptionsLimited?.length ? (
            <CommandGroup heading='Morphospecies'>
              {morphoOptionsLimited.map((r) => (
                <SpeciesOptionRow
                  key={'morpho:' + r.label}
                  label={r.label}
                  taxon={r.taxon}
                  onSelect={() => handleSelect(r.label)}
                  itemClassName='row gap-x-8 !py-8'
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
                <span className={`${rankToTextClass('morphospecies')} font-medium flex items-center gap-8`}>
                  <TaxonRankLetterBadge rank='morphospecies' size='xsm' />
                  Add morpho species: "{query}"
                </span>
              </CommandItem>

              <CommandItem key='genus' onSelect={() => handleSubmitGenus()} className='aria-selected:bg-brand/20 '>
                <span className={`${rankToTextClass('genus')} font-medium flex items-center gap-8`}>
                  <TaxonRankLetterBadge rank='genus' size='xsm' />
                  Add Genus "{query}"
                </span>
              </CommandItem>

              <CommandItem key='tribe' onSelect={() => handleSubmitTribe()} className='aria-selected:bg-brand/20 '>
                <span className={`${rankToTextClass('tribe')} font-medium flex items-center gap-8`}>
                  <TaxonRankLetterBadge rank='tribe' size='xsm' />
                  Add Tribe "{query}"
                </span>
              </CommandItem>

              <CommandItem key='subfamily' onSelect={() => handleSubmitSubfamily()} className='aria-selected:bg-brand/20 '>
                <span className={`${rankToTextClass('subfamily')} font-medium flex items-center gap-8`}>
                  <TaxonRankLetterBadge rank='subfamily' size='xsm' />
                  Add Subfamily "{query}"
                </span>
              </CommandItem>

              <CommandItem key='family' onSelect={() => handleSubmitFamily()} className='aria-selected:bg-brand/20 '>
                <span className={`${rankToTextClass('family')} font-medium flex items-center gap-8`}>
                  <TaxonRankLetterBadge rank='family' size='xsm' />
                  Add Family "{query}"
                </span>
              </CommandItem>

              <CommandItem key='order' onSelect={() => handleSubmitOrder()} className='aria-selected:bg-brand/20 '>
                <span className={`${rankToTextClass('order')} font-medium flex items-center gap-8`}>
                  <TaxonRankLetterBadge rank='order' size='xsm' />
                  Add Order "{query}"
                </span>
              </CommandItem>

              <CommandItem key='class' onSelect={() => handleSubmitClass()} className='aria-selected:bg-brand/20 '>
                <span className={`${rankToTextClass('class')} font-medium flex items-center gap-8`}>
                  <TaxonRankLetterBadge rank='class' size='xsm' />
                  Add Class "{query}"
                </span>
              </CommandItem>

              <CommandItem key='suborder' onSelect={() => handleSubmitSuborder()} className='aria-selected:bg-brand/20 '>
                <span className={`${rankToTextClass('suborder')} font-medium flex items-center gap-8`}>
                  <TaxonRankLetterBadge rank='suborder' size='xsm' />
                  Add Suborder "{query}"
                </span>
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
  isMorphospecies?: boolean
  onSelect: () => void
  itemClassName?: string
  subtitleClassName?: string
}

function SpeciesOptionRow(props: SpeciesOptionRowProps) {
  const { label, taxon, isMorphospecies, onSelect, itemClassName, subtitleClassName } = props

  const rankToShow = isMorphospecies ? 'morphospecies' : taxon?.taxonRank

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

      {rankToShow && <TaxonRankBadge rank={rankToShow} />}
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

type LogIdentificationResultParams = {
  detectionIds?: string[]
}

function logIdentificationResult(params: LogIdentificationResultParams) {
  const { detectionIds } = params
  if (!detectionIds || detectionIds.length === 0) return

  // Use setTimeout to ensure store has been updated after onSubmit callback
  setTimeout(() => {
    const updated = detectionsStore.get() || {}
    const entities = detectionIds.map((id) => updated?.[id]).filter(Boolean) as DetectionEntity[]

    if (entities.length > 0) {
      console.log('✅ identify: stored entities', {
        count: entities.length,
        entities: entities.map((e) => ({
          id: e.id,
          patchId: e.patchId,
          label: e.label,
          taxon: e.taxon
            ? {
                scientificName: e.taxon.scientificName,
                taxonRank: e.taxon.taxonRank,
                order: e.taxon.order,
                family: e.taxon.family,
                genus: e.taxon.genus,
                species: e.taxon.species,
              }
            : undefined,
          detectedBy: e.detectedBy,
          identifiedAt: e.identifiedAt,
          isError: e.isError,
          morphospecies: e.morphospecies,
        })),
      })
    }
  }, 0)
}

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

  const res = result
  return res
}

type GetRecentOptionsParams = {
  detections?: Record<string, DetectionEntity>
}

function getRecentOptions(params: GetRecentOptionsParams) {
  const { detections } = params

  const all = Object.values(detections ?? {})
    .filter(
      (d: DetectionEntity | undefined) => d?.detectedBy === 'user' && (!!d?.taxon?.scientificName || !!d?.label || !!d?.morphospecies),
    )
    .sort((a, b) => ((b?.identifiedAt ?? 0) as number) - ((a?.identifiedAt ?? 0) as number))

  const unique: Array<{ label: string; taxon?: TaxonRecord; isMorphospecies?: boolean }> = []
  const seen = new Set<string>()
  for (const d of all) {
    if (!d) continue
    const text = deriveTaxonName({ detection: d }).trim()
    const key = text.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    const isMorphospecies = !!d?.morphospecies
    unique.push({ label: text, taxon: d?.taxon, isMorphospecies })
    if (unique.length >= 5) break
  }

  const res = unique
  return res
}

function rankToTextClass(rank?: string | null) {
  const value = (rank ?? '').toString().trim().toLowerCase()
  if (value === 'morphospecies') return 'text-indigo-700'
  if (value === 'species') return 'text-blue-700'
  if (value === 'genus') return 'text-teal-700'
  if (value === 'tribe') return 'text-teal-700'
  if (value === 'subfamily') return 'text-green-700'
  if (value === 'family') return 'text-green-700'
  if (value === 'suborder') return 'text-yellow-700'
  if (value === 'order') return 'text-yellow-700'
  if (value === 'class') return 'text-orange-700'
  if (value === 'phylum') return 'text-ink-primary'
  if (value === 'kingdom') return 'text-ink-primary'
  return 'text-brand'
}

type GetMorphoOptionsParams = {
  detections?: Record<string, DetectionEntity>
  projectId?: string
  query: string
}

function getMorphoOptions(params: GetMorphoOptionsParams) {
  const { detections, projectId, query } = params

  const q = (query ?? '').trim().toLowerCase()
  const map = new Map<string, { label: string; taxon?: TaxonRecord; count: number; last: number }>()

  for (const d of Object.values(detections ?? {})) {
    const det = d as DetectionEntity | undefined
    if (!det) continue
    if (det.detectedBy !== 'user') continue
    const nightId = (det.nightId ?? '').trim()
    if (projectId && nightId && !nightId.startsWith(projectId + '/')) continue
    const raw = typeof det.morphospecies === 'string' ? det.morphospecies : ''
    const label = (raw ?? '').trim()
    if (!label) continue
    if (q && !label.toLowerCase().includes(q)) continue
    const key = label.toLowerCase()
    const prev = map.get(key)
    const count = (prev?.count ?? 0) + 1
    const last = Math.max(prev?.last ?? 0, det.identifiedAt ?? 0)
    const taxon = prev?.taxon || det.taxon
    map.set(key, { label, taxon, count, last })
  }

  const arr = Array.from(map.values())
    .sort((a, b) => b.last - a.last || b.count - a.count || a.label.localeCompare(b.label))
    .map((it) => ({ label: it.label, taxon: it.taxon }))

  const res = arr
  return res
}
