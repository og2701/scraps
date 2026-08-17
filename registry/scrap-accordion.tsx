'use client'

import * as React from 'react'
import { scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

export interface ScrapAccordionProps
  extends Omit<React.ComponentPropsWithoutRef<'details'>, 'color'>, ScrapStyleProps {
  summary?: React.ReactNode
}

export const ScrapAccordion = React.forwardRef<HTMLDetailsElement, ScrapAccordionProps>(
  function ScrapAccordion ({ color, edge, seed, rot, amp, summary, children, ...props }, fref) {
    const ref = useScrap<HTMLDetailsElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLDetailsElement)
    return (
      <div className="scrap-accordion">
        <details
          data-scrap="accordion"
          {...scrapData({ color, edge, seed, rot, amp })}
          {...props}
          ref={ref}
        >
          <summary>{summary}</summary>
          {children}
        </details>
      </div>
    )
  }
)
