'use client'

import * as React from 'react'
import { scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

export interface ScrapMenuPanelProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'color'>, ScrapStyleProps {
  /** required: the id a trigger points at via data-menu="#id" */
  id: string
}

/**
 * A floating paper menu. Pair with any trigger:
 *   <ScrapButton data-menu="#file-menu">file</ScrapButton>
 *   <ScrapMenuPanel id="file-menu"><button>new</button>...</ScrapMenuPanel>
 */
export const ScrapMenuPanel = React.forwardRef<HTMLDivElement, ScrapMenuPanelProps>(
  function ScrapMenuPanel ({ color, edge, seed, rot, amp, children, ...props }, fref) {
    const ref = useScrap<HTMLDivElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLDivElement)
    return (
      <div data-scrap="menu" {...scrapData({ color, edge, seed, rot, amp })} {...props} ref={ref}>
        {children}
      </div>
    )
  }
)
