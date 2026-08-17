'use client'

import * as React from 'react'
import { scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

export interface ScrapTableProps
  extends Omit<React.ComponentPropsWithoutRef<'table'>, 'color'>, ScrapStyleProps {
  wrapClassName?: string
  wrapStyle?: React.CSSProperties
}

export const ScrapTable = React.forwardRef<HTMLTableElement, ScrapTableProps>(
  function ScrapTable ({ color, edge, seed, rot, amp, wrapClassName, wrapStyle, children, ...props }, fref) {
    const ref = useScrap<HTMLTableElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLTableElement)
    return (
      <div
        className={['scrap-table-wrap', wrapClassName].filter(Boolean).join(' ')}
        style={wrapStyle}
      >
        <table
          data-scrap="table"
          {...scrapData({ color, edge, seed, rot, amp })}
          {...props}
          ref={ref}
        >
          {children}
        </table>
      </div>
    )
  }
)
