# scraps

![scraps, a UI library cut from paper](https://scraps.ogme01.com/og.png)

**Demo: [scraps.ogme01.com](https://scraps.ogme01.com)**

A UI library where everything is cut and torn paper.

Every component is a real HTML element backed by a procedurally generated SVG
scrap. Torn edges get a fibrous white fringe, scissor-cut edges get straight
strokes with a little drift, and everything sits at a slightly crooked angle
with a paper-grain texture and a drop shadow. Randomness is seeded
(mulberry32): the same seed produces pixel-identical tears on any machine.
Hover a scrap and it re-tears itself, quivering like a 90s cartoon.

Real HTML inputs underneath. Zero dependencies. Two files.

## Install

```html
<link rel="stylesheet" href="scraps.css">
<script src="scraps.js"></script>
```

## Use

```html
<button data-scrap="button" data-color="coral">rip it</button>
<label data-scrap="toggle"><input type="checkbox"> deckle edges</label>
<div data-scrap="card" data-color="kraft" data-tape>a note, taped to the mat</div>

<script>
  Scraps.init()               // tear everything with [data-scrap]
  Scraps.reseed('zine-04')    // re-tear the whole page from a new seed
  Scraps.tear(el)             // re-tear one element
  Scraps.setProgress(el, 64)  // move a progress bar
  Scraps.boil = false         // disable hover re-tearing globally
</script>
```

## Components (`data-scrap`)

| type | element | edges |
| --- | --- | --- |
| `button` | `<button>` | cut |
| `chip` | any inline element | cut |
| `card` | any block element | torn |
| `field` | `<input>`, `<textarea>`, `<select>`, `<input type=range>` | cut |
| `checkbox` / `radio` / `toggle` | `<label>` wrapping an `<input>` | cut / torn |
| `progress` | `<div data-value="40" data-fill="coral">` | torn |
| `divider` | `<div>` | torn |
| `dialog` | native `<dialog>` (also sheets via `data-side="right"`) | torn |
| `menu` | a panel of buttons, opened by any `data-menu="#id"` trigger | torn |
| `tabs` | `[data-tab]` buttons + `[data-panel]` panels | cut / torn |
| `accordion` | native `<details>`/`<summary>` | torn |
| `table` | a real `<table>` on ruled paper | torn |
| `avatar` | `<img>` torn out along a seeded edge | torn |
| `skeleton` | `<div>` that slowly re-tears while loading | torn |
| `alert` | kraft paper, tape, and `role="alert"` | torn |

Selects open a paper dropdown instead of the native popup; the real
`<select>` keeps the value, the change events, and the keyboard focus.
Checkbox X marks land at a slightly different angle and position on every
check. Tooltips need no component: any element with `data-tip="text"` grows
a small scrap on hover and focus. Toasts are a call:
`Scraps.toast('glued.', { color: 'ink', duration: 4000 })`. Breadcrumbs and
pagination compose from chips; see the swatch book.

## Attributes

- `data-color`: `white · kraft · coral · marigold · blue · ink`
- `data-edge`: `torn | cut`, overrides the type's default
- `data-seed`: pin one element's tear so reseeds don't change it
- `data-rot`: max crookedness in degrees
- `data-amp`: tear amplitude in px
- `data-tape`: (cards) adds a strip of translucent tape
- `data-boil`: `"false"` keeps a scrap still under the cursor
- `data-fx`: `rip · fold · glue · shred`, a paper effect played on click; also
  callable directly as `Scraps.fx.rip(el)` etc. Skipped under reduced motion.
- `data-tip`: tooltip text, on any element
- `data-menu`: on a trigger, the selector of a `data-scrap="menu"` panel
- `data-side`: (dialogs) `left | right` turns the dialog into a sheet
- `data-active`: (tabs) which `data-tab` starts selected

## React

`scraps-ui/react` ships thin components over the same core (React is an
optional peer dependency; vanilla users never load it):

```jsx
import { ScrapButton, ScrapToggle, ScrapCard, reseed } from 'scraps-ui/react'
import 'scraps-ui/scraps.css'

<ScrapCard color="kraft" tape>
  <ScrapButton color="coral" fx="rip" onClick={save}>rip it</ScrapButton>
  <ScrapToggle defaultChecked>deckle edges</ScrapToggle>
</ScrapCard>
```

Every component renders its real HTML element and cleans up after itself on
unmount. The full set: `ScrapButton`, `ScrapChip`, `ScrapCard`,
`ScrapDivider`, `ScrapInput`, `ScrapTextarea`, `ScrapSelect`, `ScrapRange`,
`ScrapCheckbox`, `ScrapRadio`, `ScrapToggle`, `ScrapProgress`,
`ScrapDialog` (controlled via an `open` prop), `ScrapTabs`,
`ScrapAccordion`, `ScrapTable`, `ScrapAvatar`, `ScrapSkeleton`,
`ScrapAlert`, `ScrapMenuPanel`, plus a `toast` export and a `tip` prop on
everything.

## Tailwind

In a Tailwind v4 project, import the bridge instead of the plain stylesheet:

```css
@import "tailwindcss";
@import "scraps-ui/tailwind.css";
```

The paper palette becomes Tailwind color tokens (`bg-scrap-coral`,
`text-scrap-ink`, ...) and scraps reads the same tokens back, so overriding
`--color-scrap-*` in your `@theme` recolors both your utilities and the
paper.

## shadcn

scraps hosts a [shadcn](https://ui.shadcn.com) registry, so you can copy the
typed React components straight into your project and own the source:

```sh
npx shadcn@latest add https://scraps.ogme01.com/r/scraps.json
```

That installs the whole drawer (components in `components/ui/`, the shared
hook in `lib/scraps-core.ts`, `scraps-ui` as the engine dependency). Single
components work too: `.../r/scrap-button.json`, `scrap-card`, `scrap-chip`,
`scrap-field`, `scrap-choice`, `scrap-progress`.

## Theming

Override the CSS custom properties on `:root` (`--sc-white`, `--sc-kraft`,
`--sc-coral`, `--sc-marigold`, `--sc-blue`, `--sc-ink`, `--sc-fringe`,
`--sc-shadow`, `--sc-text`, `--sc-text-light`) to recolor the stock palette,
or register entirely new paper colors:

```js
Scraps.registerColors({
  brand: '#7A4FBF',
  night: { fill: '#101418', text: '#F6F1E4' },
})
```

Registered names become valid `data-color` values (and `color` props in
React).

## License

MIT
