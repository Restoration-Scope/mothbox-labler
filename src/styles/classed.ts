import React from 'react'

import type { ElementType, ForwardRefExoticComponent, PropsWithoutRef, RefAttributes, ComponentPropsWithRef } from 'react'
import clsx, { ClassValue } from 'clsx'

import { twMerge } from 'tailwind-merge'
import { createTwc } from 'react-twc'

function classed<T extends ElementType>(
  type: T,
  ...className: string[]
): ForwardRefExoticComponent<PropsWithoutRef<ComponentPropsWithRef<T>> & RefAttributes<T>> {
  return React.forwardRef(function Classed(props: PropsWithoutRef<ComponentPropsWithRef<T>>, ref: React.Ref<T>) {
    return React.createElement(type, {
      ...props,
      ref,
      className: clsx(props?.className, ...className),
    })
  })
}

export default classed

// Using `clsx` + `twMerge` for a complete flexibility (taken from shadcn/ui)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// We named it `twx` to have better autocompletion
export const styled = createTwc({ compose: cn })
