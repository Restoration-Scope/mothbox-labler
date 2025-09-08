'use client'

import * as React from 'react'
import { DialogProps } from '@radix-ui/react-dialog'
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'

import { cn } from '~/utils/cn'
import { Dialog, DialogContent } from '~/components/ui/dialog'

const Command = React.forwardRef<React.ElementRef<typeof CommandPrimitive>, React.ComponentPropsWithoutRef<typeof CommandPrimitive>>(
  ({ className, ...props }, ref) => (
    <CommandPrimitive
      ref={ref}
      className={cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', className)}
      {...props}
    />
  ),
)
Command.displayName = CommandPrimitive.displayName

interface CommandDialogProps extends DialogProps {
  className?: string
}

const CommandDialog = ({ children, className, ...props }: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className={cn('overflow-hidden p-0 shadow-lg', className)}>
        <Command
          className={cn(
            '[&_[cmdk-group-heading]]:px-8 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-8 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-20 [&_[cmdk-input]]:h-[48px] [&_[cmdk-item]]:px-8 [&_[cmdk-item]]:py-12 [&_[cmdk-item]_svg]:h-20 [&_[cmdk-item]_svg]:w-20',
          )}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

interface CommandInputProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> {
  withSearchIcon?: boolean
  containerClassName?: string
}

const CommandInput = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Input>, CommandInputProps>(
  ({ className, children, withSearchIcon, containerClassName, ...props }, ref) => (
    <div className={cn('flex items-center border-b', containerClassName)} cmdk-input-wrapper=''>
      {withSearchIcon && <Search className='h-16 w-16 shrink-0 opacity-50' />}
      <CommandPrimitive.Input
        ref={ref}
        className={cn(
          'flex h-[36px] w-full rounded-md bg-transparent py-12 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          'border-transparent focus:border-transparent focus:ring-0',
          className,
        )}
        {...props}
      />
      {children}
    </div>
  ),
)

CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List ref={ref} className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', className)} {...props} />
))

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => <CommandPrimitive.Empty ref={ref} className={cn('py-24 text-center text-sm', className)} {...props} />)

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'p-4 text-foreground [&_[cmdk-group-heading]]:px-8 [&_[cmdk-group-heading]]:py-6 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
      className,
    )}
    {...props}
  />
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => <CommandPrimitive.Separator ref={ref} className={cn('-mx-16 h-px bg-border', className)} {...props} />)
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'group relative flex cursor-pointer select-none items-center rounded-md px-8 py-6 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50',
      className,
    )}
    {...props}
  />
))

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...props} />
}
CommandShortcut.displayName = 'CommandShortcut'

export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator }
