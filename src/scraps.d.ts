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

/** the paper a skin cuts; the host component keeps its own markup */
export type ScrapSkin =
  | 'button' | 'chip' | 'badge' | 'tab' | 'card' | 'panel' | 'dialog'
  | 'popover' | 'menu' | 'alert' | 'field' | 'input' | 'box' | 'checkbox'
  | 'radio' | 'switch' | 'thumb' | 'row' | 'divider' | 'separator'
  | 'progress' | 'fill' | 'avatar' | 'skeleton' | 'tape'

export interface ScrapSkinOptions extends ScrapAttachOptions {
  type?: ScrapSkin
  /** 'svg' lays paper behind the element, 'clip' tears the element itself.
   *  defaults to 'clip' for elements that take no children (input, textarea). */
  mode?: 'svg' | 'clip'
  /** false keeps the host's own background, border, shadow and overflow */
  reset?: boolean
  /** take the text colour from the paper: on by default for solid skins */
  ink?: boolean
}

/** selector -> paper. later entries win, so a state selector can override a
 *  plain one: { '[data-slot="button"]': 'button',
 *               '[data-slot="button"][data-disabled]': { type: 'button', color: 'kraft' } } */
export type ScrapAdaptMap = Record<string, ScrapSkin | ScrapSkinOptions>

export interface ScrapAdaptOptions {
  /** subtree to adapt and watch; defaults to the whole document */
  root?: ParentNode
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
  /** papers one element scraps did not build: no wrappers, no behavior, so it
   *  is safe on a component a framework owns and re-renders */
  skin(el: HTMLElement, type?: ScrapSkin, opts?: ScrapSkinOptions): ScrapRec
  /** papers everything matching a selector map, now and as it mounts. returns
   *  a disposer that un-papers every element it touched. */
  adapt(map: ScrapAdaptMap, opts?: ScrapAdaptOptions): () => void
  /** stops every active adapter */
  unadapt(): void
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
