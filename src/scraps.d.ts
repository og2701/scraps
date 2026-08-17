export type ScrapType =
  | 'button' | 'chip' | 'card' | 'field' | 'checkbox' | 'radio'
  | 'toggle' | 'progress' | 'divider' | 'box' | 'tape'

export interface ScrapAttachOptions {
  color?: string
  edge?: 'torn' | 'cut' | Array<'torn' | 'cut'>
  amp?: number
  rot?: number
  boil?: boolean
  shape?: 'blob' | 'x' | null
  id?: string
}

export interface ScrapRec {
  el: HTMLElement
  type: ScrapType
  id: string
  n: number
}

export interface ScrapsApi {
  /** tears everything with a data-scrap attribute */
  init(root?: ParentNode): void
  /** tears one element (reads its data-* attributes) */
  enhance(el: HTMLElement): void
  /** low-level: paper an element with no builder logic */
  attach(el: HTMLElement, type: ScrapType, opts?: ScrapAttachOptions): ScrapRec
  /** un-tears an element and everything scrap-built inside it */
  release(el: HTMLElement): void
  /** re-tears one scrap in place */
  tear(el: HTMLElement): void
  /** re-tears the whole page; the same seed is pixel-identical anywhere */
  reseed(seed: string): void
  setProgress(el: HTMLElement, pct: number): void
  /** mints new paper colours at runtime */
  registerColors(map: Record<string, string | { fill: string; text?: string }>): void
  /** glues a paper toast into the corner; returns a close function */
  toast(msg: string, opts?: { color?: string; duration?: number }): () => void
  fx: {
    rip(el: HTMLElement): void
    fold(el: HTMLElement): void
    glue(el: HTMLElement): void
    shred(el: HTMLElement): void
  }
  seed: string
  boil: boolean
}

declare const Scraps: ScrapsApi
export default Scraps
