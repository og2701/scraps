'use client'

import * as React from 'react'
import { scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

export interface ScrapCardProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'color'>, ScrapStyleProps {
  /** slap a strip of translucent tape on the top edge */
  tape?: boolean
}

export const ScrapCard = React.forwardRef<HTMLDivElement, ScrapCardProps>(
  function ScrapCard ({ color, edge, seed, rot, amp, boil, fx, tape, children, ...props }, fref) {
    const ref = useScrap<HTMLDivElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLDivElement)
    return (
      <div
        data-scrap="card"
        data-tape={tape ? '' : undefined}
        {...scrapData({ color, edge, seed, rot, amp, boil, fx })}
        {...props}
        ref={ref}
      >
        {children}
      </div>
    )
  }
)

export const ScrapDivider = React.forwardRef<HTMLDivElement, ScrapCardProps>(
  function ScrapDivider ({ color, edge, seed, rot, amp, children, ...props }, fref) {
    const ref = useScrap<HTMLDivElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLDivElement)
    return (
      <div
        data-scrap="divider"
        role="separator"
        {...scrapData({ color, edge, seed, rot, amp })}
        {...props}
        ref={ref}
      />
    )
  }
)
