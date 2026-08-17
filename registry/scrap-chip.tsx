'use client'

import * as React from 'react'
import { scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

export interface ScrapChipProps
  extends Omit<React.ComponentPropsWithoutRef<'span'>, 'color'>, ScrapStyleProps {}

export const ScrapChip = React.forwardRef<HTMLSpanElement, ScrapChipProps>(
  function ScrapChip ({ color, edge, seed, rot, amp, boil, fx, children, ...props }, fref) {
    const ref = useScrap<HTMLSpanElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLSpanElement)
    return (
      <span
        data-scrap="chip"
        {...scrapData({ color, edge, seed, rot, amp, boil, fx })}
        {...props}
        ref={ref}
      >
        {children}
      </span>
    )
  }
)
