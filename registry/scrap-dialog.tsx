'use client'

import * as React from 'react'
import { scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

export interface ScrapDialogProps
  extends Omit<React.ComponentPropsWithoutRef<'dialog'>, 'color' | 'open'>, ScrapStyleProps {
  /** controlled: true calls showModal(), false calls close() */
  open?: boolean
  /** dock the dialog to an edge as a sheet */
  side?: 'left' | 'right'
  tape?: boolean
}

export const ScrapDialog = React.forwardRef<HTMLDialogElement, ScrapDialogProps>(
  function ScrapDialog ({ color, edge, seed, rot, amp, tape, side, open, children, ...props }, fref) {
    const ref = useScrap<HTMLDialogElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLDialogElement)
    React.useLayoutEffect(() => {
      const d = ref.current
      if (!d) return
      if (open && !d.open) d.showModal()
      else if (!open && d.open) d.close()
    }, [open])
    return (
      <dialog
        data-scrap="dialog"
        data-side={side}
        data-tape={tape ? '' : undefined}
        {...scrapData({ color, edge, seed, rot, amp })}
        {...props}
        ref={ref}
      >
        {children}
      </dialog>
    )
  }
)
