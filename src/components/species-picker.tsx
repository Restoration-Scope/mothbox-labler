import { useMemo } from 'react'
import { useStore } from '@nanostores/react'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command'
import { SpeciesList, speciesListsStore } from '~/stores/species/species-lists'
import { projectSpeciesSelectionStore, saveProjectSpeciesSelection } from '~/stores/species/project-species-list'
import { Column } from '~/styles'
import { CheckCircleIcon } from 'lucide-react'
import { Icon } from '~/components/atomic/Icon'

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
            <ListItem key={opt.id} list={opt} isSelected={selection?.[projectId] === opt.id} onSelect={handleSelect} />
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

function ListItem(props: { list: SpeciesList; isSelected?: boolean; onSelect: (id: string) => void }) {
  const { list, isSelected, onSelect } = props

  return (
    <CommandItem onSelect={() => onSelect(list.id)} className='text-ellipsis'>
      <Column className='gap-4 flex-1'>
        <span className='flex-1'>{list.name}</span>
        <span className='flex-1 text-11 font-mono text-ink-secondary'>{list.doi}</span>
      </Column>
      {isSelected ? <Icon icon={CheckCircleIcon} className='text-brand mr-12' /> : null}
    </CommandItem>
  )
}
