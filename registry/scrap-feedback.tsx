'use client'

import * as React from 'react'
import { Scraps, scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

/** glues a paper toast into the corner; returns a close function */
export const toast = (msg: string, opts?: { color?: string; duration?: number }) =>
  Scraps.toast(msg, opts)

export interface ScrapAlertProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'color'>, ScrapStyleProps {}

export const ScrapAlert = React.forwardRef<HTMLDivElement, ScrapAlertProps>(
  function ScrapAlert ({ color, edge, seed, rot, amp, children, ...props }, fref) {
    const ref = useScrap<HTMLDivElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLDivElement)
    return (
      <div data-scrap="alert" {...scrapData({ color, edge, seed, rot, amp })} {...props} ref={ref}>
        {children}
      </div>
    )
  }
)

export const ScrapSkeleton = React.forwardRef<HTMLDivElement, ScrapAlertProps>(
  function ScrapSkeleton ({ color, edge, seed, rot, amp, ...props }, fref) {
    const ref = useScrap<HTMLDivElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLDivElement)
    return (
      <div data-scrap="skeleton" {...scrapData({ color, edge, seed, rot, amp })} {...props} ref={ref} />
    )
  }
)
