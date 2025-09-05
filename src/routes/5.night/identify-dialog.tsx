import { useMemo, useState } from 'react'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command'

export type IdentifyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestions?: string[]
  onSubmit: (label: string) => void
}

export function IdentifyDialog(props: IdentifyDialogProps) {
  const { open, onOpenChange, suggestions, onSubmit } = props
  const [query, setQuery] = useState('')

  const options = useMemo(() => {
    const list = suggestions ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list.slice(0, 20)
    return list.filter((s) => s.toLowerCase().includes(q)).slice(0, 20)
  }, [suggestions, query])

  function handleSelect(label: string) {
    const value = (label ?? '').trim()
    if (!value) return
    onSubmit(value)
    onOpenChange(false)
  }

  function handleSubmitFreeText() {
    const value = query.trim()
    if (!value) return
    onSubmit(value)
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} className='max-w-[520px]'>
      <Command>
        <CommandInput
          placeholder='Type a label (species, genus, family, ...)'
          value={query}
          onValueChange={setQuery as any}
          withSearchIcon
          onKeyDown={(e: any) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmitFreeText()
            }
          }}
        >
          {query ? (
            <button className='text-12 px-8 text-primary' onClick={handleSubmitFreeText}>
              Use "{query}"
            </button>
          ) : null}
        </CommandInput>
        <CommandList>
          <CommandEmpty>No matches. Press Enter to use your text.</CommandEmpty>
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
