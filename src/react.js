/*!
 * scraps-ui/react — React bindings for scraps.
 *
 * thin components over the same core: they render the exact structure the
 * vanilla builders would create, then let the core attach paper, listeners,
 * and observers. cleanup on unmount goes through Scraps.release, so scraps
 * survive strict mode and re-renders without leaking.
 *
 * needs a bundler (the core is UMD; every React setup has one anyway).
 */
import * as React from 'react'
import Scraps from './scraps.js'

const { createElement: h, useRef, useLayoutEffect, forwardRef, useImperativeHandle } = React

export default Scraps
export const init = Scraps.init
export const reseed = Scraps.reseed
export const tear = Scraps.tear
export const setProgress = Scraps.setProgress
export const registerColors = Scraps.registerColors
export const fx = Scraps.fx

function useEnhance () {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    Scraps.enhance(el)
    return () => Scraps.release(el.closest('.scrap-field-wrap') || el)
  }, [])
  return ref
}

const dataProps = ({ color, edge, seed, rot, amp, boil, fx: fxName, tape }) => ({
  'data-color': color,
  'data-edge': edge,
  'data-seed': seed,
  'data-rot': rot,
  'data-amp': amp,
  'data-boil': boil == null ? undefined : String(boil),
  'data-fx': fxName,
  'data-tape': tape ? '' : undefined,
})

function simple (type, Tag) {
  const C = forwardRef(function ScrapEl (props, fref) {
    const { color, edge, seed, rot, amp, boil, fx: fxName, tape, children, ...rest } = props
    const ref = useEnhance()
    useImperativeHandle(fref, () => ref.current)
    return h(Tag, {
      'data-scrap': type,
      ...dataProps(props),
      ...rest,
      ref,
    }, children)
  })
  C.displayName = 'Scrap' + type[0].toUpperCase() + type.slice(1)
  return C
}

export const ScrapButton = simple('button', 'button')
export const ScrapChip = simple('chip', 'span')
export const ScrapCard = simple('card', 'div')
export const ScrapDivider = simple('divider', 'div')

export const ScrapProgress = forwardRef(function ScrapProgress (props, fref) {
  const { value = 0, fill, color, seed, ...rest } = props
  const ref = useEnhance()
  useImperativeHandle(fref, () => ref.current)
  useLayoutEffect(() => {
    if (ref.current) Scraps.setProgress(ref.current, value)
  }, [value])
  return h('div', {
    'data-scrap': 'progress',
    'data-value': value,
    'data-fill': fill,
    'data-color': color,
    'data-seed': seed,
    ...rest,
    ref,
  })
})

function choice (kind) {
  const C = forwardRef(function ScrapChoice (props, fref) {
    const { color, seed, children, className, style, ...inputProps } = props
    const ref = useEnhance()
    useImperativeHandle(fref, () => ref.current)
    return h('label', {
      'data-scrap': kind,
      'data-color': color,
      'data-seed': seed,
      className,
      style,
      ref,
    },
      h('input', { type: kind === 'radio' ? 'radio' : 'checkbox', ...inputProps }),
      h('span', { className: 'scrap-boxslot' }, h('span', { className: 'scrap-mark' })),
      h('span', { className: 'scrap-choice-text' }, children))
  })
  C.displayName = 'Scrap' + kind[0].toUpperCase() + kind.slice(1)
  return C
}

export const ScrapCheckbox = choice('checkbox')
export const ScrapRadio = choice('radio')
export const ScrapToggle = choice('toggle')

function field (Tag, wrapClass, forced) {
  const C = forwardRef(function ScrapField (props, fref) {
    const { color, edge, seed, children, wrapClassName, wrapStyle, ...rest } = props
    const ref = useEnhance()
    useImperativeHandle(fref, () => ref.current)
    return h('span', {
      className: 'scrap-field-wrap' + (wrapClass ? ' ' + wrapClass : '') +
        (wrapClassName ? ' ' + wrapClassName : ''),
      style: wrapStyle,
    },
      h(Tag, {
        'data-scrap': 'field',
        'data-color': color,
        'data-edge': edge,
        'data-seed': seed,
        ...forced,
        ...rest,
        ref,
      }, children))
  })
  C.displayName = 'ScrapField'
  return C
}

export const ScrapInput = field('input')
export const ScrapTextarea = field('textarea')
export const ScrapSelect = field('select', 'scrap-select')
export const ScrapRange = field('input', 'scrap-range-wrap', { type: 'range' })
