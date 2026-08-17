'use client'

import * as React from 'react'
import { useScrap } from '@/lib/scraps-core'

export interface ScrapTabsProps extends React.ComponentPropsWithoutRef<'div'> {
  seed?: string
  /** the data-tab value that starts active */
  active?: string
}

/**
 * Render a .scrap-tabs-row of <button data-tab="..."> plus sibling
 * <div data-panel="..."> panels as children; the core wires activation.
 */
export const ScrapTabs = React.forwardRef<HTMLDivElement, ScrapTabsProps>(
  function ScrapTabs ({ seed, active, children, ...props }, fref) {
    const ref = useScrap<HTMLDivElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLDivElement)
    return (
      <div data-scrap="tabs" data-seed={seed} data-active={active} {...props} ref={ref}>
        {children}
      </div>
    )
  }
)
