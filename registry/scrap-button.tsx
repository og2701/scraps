'use client'

import * as React from 'react'
import { scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

export interface ScrapButtonProps
  extends Omit<React.ComponentPropsWithoutRef<'button'>, 'color'>, ScrapStyleProps {}

export const ScrapButton = React.forwardRef<HTMLButtonElement, ScrapButtonProps>(
  function ScrapButton ({ color, edge, seed, rot, amp, boil, fx, children, ...props }, fref) {
    const ref = useScrap<HTMLButtonElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLButtonElement)
    return (
      <button
        data-scrap="button"
        {...scrapData({ color, edge, seed, rot, amp, boil, fx })}
        {...props}
        ref={ref}
      >
        {children}
      </button>
    )
  }
)
