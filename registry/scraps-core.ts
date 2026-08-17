'use client'

// shared scrap plumbing: the enhance/release lifecycle and the data-attribute
// bridge into the scraps-ui core. everything visual comes from the engine.
import { useLayoutEffect, useRef } from 'react'
import Scraps from 'scraps-ui'
import 'scraps-ui/scraps.css'

export type ScrapColor =
  | 'white' | 'kraft' | 'coral' | 'marigold' | 'blue' | 'ink'
  | (string & {})

export interface ScrapStyleProps {
  /** paper colour: a built-in name or one minted via Scraps.registerColors */
  color?: ScrapColor
  /** torn or scissor-cut edges; each component has an opinionated default */
  edge?: 'torn' | 'cut'
  /** pin this element's tear so page reseeds don't change it */
  seed?: string
  /** max crookedness in degrees */
  rot?: number
  /** tear amplitude in px */
  amp?: number
  /** false keeps the scrap still under the cursor */
  boil?: boolean
  /** paper gesture played on click */
  fx?: 'rip' | 'fold' | 'glue' | 'shred'
  /** tooltip text shown on hover and focus */
  tip?: string
}

export function scrapData (p: ScrapStyleProps) {
  return {
    'data-color': p.color,
    'data-edge': p.edge,
    'data-seed': p.seed,
    'data-rot': p.rot,
    'data-amp': p.amp,
    'data-boil': p.boil == null ? undefined : String(p.boil),
    'data-fx': p.fx,
    'data-tip': p.tip,
  }
}

export function useScrap<T extends HTMLElement> () {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    Scraps.enhance(el)
    return () => {
      Scraps.release(
        (el.closest('.scrap-field-wrap, .scrap-table-wrap, .scrap-avatar-wrap, .scrap-accordion') as HTMLElement) ?? el
      )
    }
  }, [])
  return ref
}

export { Scraps }
