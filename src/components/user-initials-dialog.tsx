import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { appReadyStore, loadUserSession, saveUserSession, userSessionLoadedStore, userSessionStore } from '~/stores/ui'

export function UserInitialsDialog() {
  const session = useStore(userSessionStore)
  const ready = useStore(appReadyStore)
  const shouldAsk = useMemo(() => ready && !session?.initials, [ready, session?.initials])
  const [open, setOpen] = useState<boolean>(false)
  const [initials, setInitials] = useState('')

  useEffect(() => {
    // Kick off load once
    if (!userSessionLoadedStore.get()) void loadUserSession()
  }, [])

  useEffect(() => {
    setOpen(!!shouldAsk)
    if (!shouldAsk) setInitials('')
  }, [shouldAsk])

  function onSave() {
    const trimmed = (initials || '').trim()
    if (!trimmed) return
    void saveUserSession({ initials: trimmed })
    setOpen(false)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onSave()
  }

  return (
    <Dialog open={open}>
      <DialogContent onClose={() => setOpen(false)}>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Set your initials</DialogTitle>
          </DialogHeader>
          <div className='px-4'>
            <input
              className='w-full rounded border px-8 py-8 text-14'
              placeholder='e.g. BL'
              value={initials}
              onChange={(e) => setInitials(e.target.value)}
              autoFocus
              autoComplete='off'
              autoCorrect='off'
              data-1p-ignore
            />
          </div>
          <DialogFooter>
            <Button type='submit' disabled={!initials.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
