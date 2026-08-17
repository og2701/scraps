'use client'

import * as React from 'react'
import { scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

interface WrapProps {
  wrapClassName?: string
  wrapStyle?: React.CSSProperties
}

function makeField<E extends HTMLElement, P extends object> (
  Tag: 'input' | 'textarea' | 'select',
  wrapClass: string,
  forced?: Record<string, unknown>
) {
  return React.forwardRef<E, P & ScrapStyleProps & WrapProps & { children?: React.ReactNode }>(
    function ScrapField (allProps, fref) {
      const { color, edge, seed, rot, amp, boil, fx, wrapClassName, wrapStyle, children, ...props } =
        allProps as ScrapStyleProps & WrapProps & { children?: React.ReactNode }
      const ref = useScrap<E>()
      React.useImperativeHandle(fref, () => ref.current as E)
      return (
        <span
          className={['scrap-field-wrap', wrapClass, wrapClassName].filter(Boolean).join(' ')}
          style={wrapStyle}
        >
          {React.createElement(
            Tag,
            {
              'data-scrap': 'field',
              ...scrapData({ color, edge, seed, rot, amp, boil, fx }),
              ...forced,
              ...props,
              ref,
            },
            children
          )}
        </span>
      )
    }
  )
}

export const ScrapInput = makeField<HTMLInputElement, React.ComponentPropsWithoutRef<'input'>>('input', '')
export const ScrapTextarea = makeField<HTMLTextAreaElement, React.ComponentPropsWithoutRef<'textarea'>>('textarea', '')
export const ScrapSelect = makeField<HTMLSelectElement, React.ComponentPropsWithoutRef<'select'>>('select', 'scrap-select')
export const ScrapRange = makeField<HTMLInputElement, Omit<React.ComponentPropsWithoutRef<'input'>, 'type'>>('input', 'scrap-range-wrap', { type: 'range' })
