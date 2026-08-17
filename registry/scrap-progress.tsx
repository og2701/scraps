'use client'

import * as React from 'react'
import { Scraps, scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

export interface ScrapProgressProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'color'>, ScrapStyleProps {
  /** 0 to 100 */
  value?: number
  /** fill colour; the track uses `color` */
  fill?: string
}

export const ScrapProgress = React.forwardRef<HTMLDivElement, ScrapProgressProps>(
  function ScrapProgress ({ color, edge, seed, rot, amp, value = 0, fill, ...props }, fref) {
    const ref = useScrap<HTMLDivElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLDivElement)
    React.useLayoutEffect(() => {
      if (ref.current) Scraps.setProgress(ref.current, value)
    }, [value])
    return (
      <div
        data-scrap="progress"
        data-value={value}
        data-fill={fill}
        {...scrapData({ color, edge, seed, rot, amp })}
        {...props}
        ref={ref}
      />
    )
  }
)
