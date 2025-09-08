import { useMemo } from 'react'
import { useStore } from '@nanostores/react'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command'
import { speciesListsStore, projectSpeciesSelectionStore, saveProjectSpeciesSelection } from '~/stores/species-lists'

export type SpeciesPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  recommendedListId?: string
}

export function SpeciesPicker(props: SpeciesPickerProps) {
  const { open, onOpenChange, projectId, recommendedListId } = props
  const lists = useStore(speciesListsStore)
  const selection = useStore(projectSpeciesSelectionStore)

  const options = useMemo(() => Object.values(lists ?? {}), [lists])

  function handleSelect(listId: string) {
    if (!listId || !projectId) return
    void saveProjectSpeciesSelection({ projectId, speciesListId: listId })
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} className='max-w-[520px] !p-0'>
      <CommandInput placeholder='Search species lists…' withSearchIcon />
      <CommandList>
        <CommandEmpty>No species lists found.</CommandEmpty>
        {recommendedListId ? (
          <CommandGroup heading='Recommended'>
            <ListItem
              id={recommendedListId}
              name={lists?.[recommendedListId]?.name || recommendedListId}
              isSelected={selection?.[projectId] === recommendedListId}
              onSelect={handleSelect}
            />
          </CommandGroup>
        ) : null}
        <CommandGroup heading='All lists'>
          {options.map((opt) => (
            <ListItem key={opt.id} id={opt.id} name={opt.name} isSelected={selection?.[projectId] === opt.id} onSelect={handleSelect} />
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

type ListItemProps = { id: string; name: string; isSelected?: boolean; onSelect: (id: string) => void }
function ListItem(props: ListItemProps) {
  const { id, name, isSelected, onSelect } = props
  return (
    <CommandItem onSelect={() => onSelect(id)}>
      <span className='flex-1'>{name}</span>
      {isSelected ? <span className='text-11 text-primary'>Selected</span> : null}
    </CommandItem>
  )
}
