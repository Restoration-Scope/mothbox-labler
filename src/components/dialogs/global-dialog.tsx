'use client'

import { useStore } from '@nanostores/react'
import { atom } from 'nanostores'
import React from 'react'
import { Dialog, DialogContent } from '~/components/ui/dialog'

export type GlobalDialogComponent<Props = any> = (props: Props) => React.ReactNode

export type GlobalDialogData<Props = any> = {
  component: GlobalDialogComponent<Props>
  props?: Props
  onClose?: () => void
  align?: 'center' | 'top' | 'max' | 'full'
  className?: string
}

export const $globalDialogData = atom<GlobalDialogData | null>(null)

export function openGlobalDialog(params: GlobalDialogData) {
  $globalDialogData.set(params)
}

export function closeGlobalDialog() {
  $globalDialogData.set(null)
}

export function GlobalDialog() {
  const dialogData = useStore($globalDialogData)

  function onOpenChange(open: boolean) {
    if (!open) {
      dialogData?.onClose?.()
      closeGlobalDialog()
    }
  }

  if (!dialogData) return null

  const Component = dialogData.component
  const align = dialogData.align || 'center'

  return (
    <Dialog open={!!dialogData} onOpenChange={onOpenChange}>
      <DialogContent align={align} onClose={closeGlobalDialog} variant='bare' className={dialogData.className}>
        <Component {...(dialogData.props as any)} />
      </DialogContent>
    </Dialog>
  )
}
