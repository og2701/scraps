'use client'

import * as React from 'react'
import { scrapData, useScrap, type ScrapStyleProps } from '@/lib/scraps-core'

export interface ScrapAvatarProps
  extends Omit<React.ComponentPropsWithoutRef<'img'>, 'color'>, ScrapStyleProps {
  wrapClassName?: string
  wrapStyle?: React.CSSProperties
}

export const ScrapAvatar = React.forwardRef<HTMLImageElement, ScrapAvatarProps>(
  function ScrapAvatar ({ color, edge, seed, rot, amp, wrapClassName, wrapStyle, ...props }, fref) {
    const ref = useScrap<HTMLImageElement>()
    React.useImperativeHandle(fref, () => ref.current as HTMLImageElement)
    return (
      <span
        className={['scrap-avatar-wrap', wrapClassName].filter(Boolean).join(' ')}
        style={wrapStyle}
      >
        <img
          data-scrap="avatar"
          {...scrapData({ color, edge, seed, rot, amp })}
          {...props}
          ref={ref}
        />
      </span>
    )
  }
)
