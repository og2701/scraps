'use client'

import * as React from 'react'
import { scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

export interface ScrapChoiceProps
  extends Omit<React.ComponentPropsWithoutRef<'input'>, 'children' | 'color'>, ScrapStyleProps {
  children?: React.ReactNode
  labelClassName?: string
  labelStyle?: React.CSSProperties
}

function makeChoice (kind: 'checkbox' | 'radio' | 'toggle') {
  return React.forwardRef<HTMLLabelElement, ScrapChoiceProps>(
    function ScrapChoice ({ color, edge, seed, rot, amp, boil, fx, children, labelClassName, labelStyle, ...inputProps }, fref) {
      const ref = useScrap<HTMLLabelElement>()
      React.useImperativeHandle(fref, () => ref.current as HTMLLabelElement)
      return (
        <label
          data-scrap={kind}
          {...scrapData({ color, seed })}
          className={labelClassName}
          style={labelStyle}
          ref={ref}
        >
          <input type={kind === 'radio' ? 'radio' : 'checkbox'} {...inputProps} />
          <span className="scrap-boxslot"><span className="scrap-mark" /></span>
          <span className="scrap-choice-text">{children}</span>
        </label>
      )
    }
  )
}

export const ScrapCheckbox = makeChoice('checkbox')
export const ScrapRadio = makeChoice('radio')
export const ScrapToggle = makeChoice('toggle')
