import * as React from 'react'
import type { ScrapsApi } from './scraps'

export interface ScrapStyleProps {
  color?: string
  edge?: 'torn' | 'cut'
  seed?: string
  rot?: number
  amp?: number
  boil?: boolean
  fx?: 'rip' | 'fold' | 'glue' | 'shred'
}

type ScrapComponent<T, E> = React.ForwardRefExoticComponent<
  T & ScrapStyleProps & React.RefAttributes<E>
>

export const ScrapButton: ScrapComponent<React.ComponentPropsWithoutRef<'button'>, HTMLButtonElement>
export const ScrapChip: ScrapComponent<React.ComponentPropsWithoutRef<'span'>, HTMLSpanElement>
export const ScrapCard: ScrapComponent<React.ComponentPropsWithoutRef<'div'> & { tape?: boolean }, HTMLDivElement>
export const ScrapDivider: ScrapComponent<React.ComponentPropsWithoutRef<'div'>, HTMLDivElement>
export const ScrapProgress: ScrapComponent<React.ComponentPropsWithoutRef<'div'> & { value?: number; fill?: string }, HTMLDivElement>
export const ScrapCheckbox: ScrapComponent<React.ComponentPropsWithoutRef<'input'>, HTMLLabelElement>
export const ScrapRadio: ScrapComponent<React.ComponentPropsWithoutRef<'input'>, HTMLLabelElement>
export const ScrapToggle: ScrapComponent<React.ComponentPropsWithoutRef<'input'>, HTMLLabelElement>
export const ScrapInput: ScrapComponent<React.ComponentPropsWithoutRef<'input'> & { wrapClassName?: string; wrapStyle?: React.CSSProperties }, HTMLInputElement>
export const ScrapTextarea: ScrapComponent<React.ComponentPropsWithoutRef<'textarea'> & { wrapClassName?: string; wrapStyle?: React.CSSProperties }, HTMLTextAreaElement>
export const ScrapSelect: ScrapComponent<React.ComponentPropsWithoutRef<'select'> & { wrapClassName?: string; wrapStyle?: React.CSSProperties }, HTMLSelectElement>
export const ScrapRange: ScrapComponent<React.ComponentPropsWithoutRef<'input'> & { wrapClassName?: string; wrapStyle?: React.CSSProperties }, HTMLInputElement>

export const init: ScrapsApi['init']
export const reseed: ScrapsApi['reseed']
export const tear: ScrapsApi['tear']
export const setProgress: ScrapsApi['setProgress']
export const registerColors: ScrapsApi['registerColors']
export const fx: ScrapsApi['fx']

declare const Scraps: ScrapsApi
export default Scraps
