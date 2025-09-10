import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { loadUserSession, saveUserSession, userSessionStore } from '~/stores/ui'

export function UserInitialsDialog() {
  const session = useStore(userSessionStore)
  const shouldAsk = useMemo(() => !session?.initials, [session?.initials])
  const [open, setOpen] = useState<boolean>(false)
  const [initials, setInitials] = useState('')

  useEffect(() => {
    void loadUserSession()
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

  return (
    <Dialog open={open}>
      <DialogContent onClose={() => setOpen(false)}>
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
          />
        </div>
        <DialogFooter>
          <Button onClick={onSave} disabled={!initials.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
