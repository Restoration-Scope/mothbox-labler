import { useStore } from '@nanostores/react'
import { CheckCircleIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Icon } from '~/components/atomic/Icon'
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from '~/components/ui/command'
import { projectSpeciesSelectionStore, saveProjectSpeciesSelection } from '~/stores/species/project-species-list'
import { SpeciesList, speciesListsStore } from '~/features/data-flow/2.identify/species-list.store'
import { Column } from '~/styles'
import { $isSpeciesPickerOpen, $speciesPickerProjectId } from './species-picker.state'

// state is in species-picker.state.ts to satisfy fast refresh rules

export function SpeciesPicker() {
  const isOpen = useStore($isSpeciesPickerOpen)
  const projectId = useStore($speciesPickerProjectId) || ''
  const lists = useStore(speciesListsStore)
  const selection = useStore(projectSpeciesSelectionStore)

  // #region agent log
  if (typeof window !== 'undefined') fetch('http://127.0.0.1:7242/ingest/19e6da83-9b8f-40fa-8c5e-2bf062370d64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'species-picker.tsx:16',message:'SpeciesPicker reading from store',data:{listCount:Object.keys(lists||{}).length,listIds:Object.keys(lists||{}),isOpen,projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

  const options = useMemo(() => Object.values(lists ?? {}), [lists])

  function handleSelect(listId: string) {
    if (!listId || !projectId) return
    void saveProjectSpeciesSelection({ projectId, speciesListId: listId })
    $isSpeciesPickerOpen.set(false)
  }

  function handleOpenChange(next: boolean) {
    $isSpeciesPickerOpen.set(next)
  }

  return (
    <CommandDialog open={isOpen} onOpenChange={handleOpenChange} className='max-w-[520px] !p-0'>
      <CommandInput placeholder='Search species lists…' withSearchIcon />
      <CommandList className='p-8'>
        <CommandEmpty>No species lists found.</CommandEmpty>

        {options.map((opt) => (
          <ListItem key={opt.id} list={opt} isSelected={selection?.[projectId] === opt.id} onSelect={handleSelect} />
        ))}
      </CommandList>
    </CommandDialog>
  )
}

function ListItem(props: { list: SpeciesList; isSelected?: boolean; onSelect: (id: string) => void }) {
  const { list, isSelected, onSelect } = props

  return (
    <CommandItem onSelect={() => onSelect(list.id)} className='text-ellipsis !py-4'>
      <Column className='gap-2 flex-1'>
        <span className='flex-1'>{list.name}</span>
        <span className='flex-1 text-11 font-mono text-ink-secondary'>{list.doi}</span>
      </Column>
      {isSelected ? <Icon icon={CheckCircleIcon} className='text-brand mr-6' /> : null}
    </CommandItem>
  )
}
