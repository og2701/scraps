/*!
 * scraps, a UI library cut from paper.
 *
 * every component is a real HTML element backed by a procedurally torn
 * (or scissor-cut) SVG scrap. randomness is seeded: same seed, same tears,
 * on any machine. zero dependencies. MIT.
 */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else global.Scraps = factory()
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict'

  const NS = 'http://www.w3.org/2000/svg'

  /* ---------------- seeded randomness ---------------- */

  function fnv (str) {
    let h = 2166136261 >>> 0
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

  function mulberry32 (a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0
      let t = Math.imul(a ^ a >>> 15, 1 | a)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  function rng (...parts) { return mulberry32(fnv(parts.join('#'))) }

  const state = {
    seed: 'scraps',
    uid: 0,
    boil: true,
    reduced: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  }

  /* ---------------- geometry ----------------
   * a torn edge is low-frequency wobble (anchors every ~34px, smoothstep
   * interpolated) plus high-frequency fuzz sampled every 4.5px.
   * a cut edge is 1 to 3 near-straight scissor strokes with tiny drift.
   */

  function sideProfile (r, len, style, amp) {
    const pts = []
    if (style === 'cut') {
      const a = amp * 0.55
      const n = 1 + Math.floor(r() * 2)
      pts.push({ t: 0, off: (r() * 2 - 1) * a * 0.6 })
      for (let i = 1; i < n; i++) {
        pts.push({ t: (len * i) / n + (r() * 2 - 1) * len * 0.08, off: (r() * 2 - 1) * a })
      }
      pts.push({ t: len, off: (r() * 2 - 1) * a * 0.6 })
      return pts
    }
    const nA = Math.max(2, Math.round(len / 34))
    const anchors = []
    for (let i = 0; i <= nA; i++) anchors.push((r() * 2 - 1) * amp)
    for (let t = 0; t < len; t += 4.5) {
      const u = (t / len) * nA
      const i = Math.min(nA - 1, Math.floor(u))
      const f = u - i
      const s = f * f * (3 - 2 * f)
      const low = anchors[i] * (1 - s) + anchors[i + 1] * s
      pts.push({ t, off: low + (r() * 2 - 1) * amp * 0.55 })
    }
    pts.push({ t: len, off: anchors[nA] })
    return pts
  }

  // walk the rect perimeter clockwise; positive offset pushes outward
  function rectPts (w, h, r, style, amp, bias) {
    const sides = [
      { len: w, map: (t, o) => [t, -o] },
      { len: h, map: (t, o) => [w + o, t] },
      { len: w, map: (t, o) => [w - t, h + o] },
      { len: h, map: (t, o) => [-o, h - t] },
    ]
    const out = []
    sides.forEach((s, i) => {
      const st = Array.isArray(style) ? style[i] : style
      for (const p of sideProfile(r, s.len, st, amp)) out.push(s.map(p.t, p.off + bias))
    })
    return out
  }

  function blobPts (radius, r, jag, bias) {
    const n = Math.max(10, Math.round(radius * 1.7))
    const out = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const rr = radius + (r() * 2 - 1) * jag * radius + bias
      out.push([Math.cos(a) * rr, Math.sin(a) * rr])
    }
    return out
  }

  const movePts = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy])
  const rotPts = (pts, a) => {
    const c = Math.cos(a), s = Math.sin(a)
    return pts.map(([x, y]) => [x * c - y * s, x * s + y * c])
  }
  const pathFrom = pts =>
    pts.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join('') + 'Z'

  /* ---------------- component defaults ---------------- */

  const TYPES = {
    button:   { edge: 'cut',  amp: 2.8, rot: 1.6, boil: true },
    chip:     { edge: 'cut',  amp: 2.4, rot: 2.6, boil: true },
    card:     { edge: 'torn', amp: 3.8, rot: 0.7, boil: false },
    field:    { edge: 'cut',  amp: 2.4, rot: 0.5, boil: false },
    divider:  { edge: 'torn', amp: 3.4, rot: 0.4, boil: false },
    progress: { edge: 'torn', amp: 2.6, rot: 0.4, boil: false },
    box:      { edge: 'cut',  amp: 2.0, rot: 0,   boil: false },
    tape:     { edge: 'cut',  amp: 2.0, rot: 0,   boil: false },
  }

  /* ---------------- attach & paint ---------------- */

  const recs = new Set()
  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver(entries => {
        for (const e of entries) if (e.target.__scrapRec) paint(e.target.__scrapRec)
      })
    : null
  // heals scraps whose injected svg got wiped by el.textContent = '...' etc.
  const mo = typeof MutationObserver === 'function'
    ? new MutationObserver(muts => {
        for (const m of muts) {
          const rec = m.target.__scrapRec
          if (rec && rec.svg && rec.svg.parentNode !== m.target) paint(rec)
        }
      })
    : null

  function svgEl (tag, attrs) {
    const e = document.createElementNS(NS, tag)
    for (const k in attrs) e.setAttribute(k, attrs[k])
    return e
  }

  function ensureDefs () {
    if (document.getElementById('scraps-defs')) return
    const svg = svgEl('svg', { id: 'scraps-defs', width: 0, height: 0, 'aria-hidden': 'true' })
    svg.style.position = 'absolute'
    svg.innerHTML =
      '<defs><filter id="scrapsGrain" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.9 0.9 0.9 0 0" result="a"/>' +
      '<feComposite in="a" in2="SourceAlpha" operator="in"/>' +
      '</filter></defs>'
    document.body.prepend(svg)
  }

  function attach (el, type, o = {}) {
    if (el.__scrapRec) return el.__scrapRec
    const d = TYPES[type] || TYPES.card
    const ds = el.dataset
    const rec = {
      el,
      type,
      id: ds.seed || o.id || ('a' + state.uid++),
      edge: o.edge || ds.edge || d.edge,
      amp: +(ds.amp || o.amp || d.amp),
      rot: ds.rot != null ? +ds.rot : (o.rot != null ? o.rot : d.rot),
      boil: ds.boil != null ? ds.boil !== 'false' : (o.boil != null ? o.boil : d.boil),
      shape: o.shape || null,
      n: 0,
      svg: null,
    }
    el.__scrapRec = rec
    el.classList.add('scrap', 'scrap-' + type)
    const color = o.color || ds.color
    if (color) el.classList.add('scrap--' + color)
    recs.add(rec)
    paint(rec)
    if (ro) ro.observe(el)
    if (mo) mo.observe(el, { childList: true })
    if (rec.boil) hookBoil(rec)
    if (ds.fx && FX[ds.fx]) el.addEventListener('click', () => FX[ds.fx](el))
    return rec
  }

  function paint (rec) {
    const el = rec.el
    const w = el.offsetWidth, h = el.offsetHeight
    if (!w || !h) return
    const B = Math.ceil(rec.amp * 2.5 + 8)
    const base = [state.seed, rec.id, rec.type, rec.n]
    const rA = rng(...base, 'edge')
    const rB = rng(...base, 'fringe')
    const rC = rng(...base, 'misc')

    let dFace, dFringe
    if (rec.shape === 'blob') {
      const r0 = Math.min(w, h) / 2 - 1
      dFace = pathFrom(movePts(blobPts(r0, rA, 0.14, 0), w / 2, h / 2))
      dFringe = pathFrom(movePts(blobPts(r0, rB, 0.16, 1.4), w / 2, h / 2))
    } else if (rec.shape === 'x') {
      const L = Math.max(w, h) * 1.1
      const T = Math.max(5, L * 0.24)
      const strips = (r, bias) => {
        const one = ang => pathFrom(movePts(rotPts(movePts(rectPts(L, T, r, 'torn', 1.3, bias), -L / 2, -T / 2), ang), w / 2, h / 2))
        return one(Math.PI / 4) + one(-Math.PI / 4)
      }
      dFace = strips(rA, 0)
      dFringe = strips(rB, 1.1)
    } else {
      dFace = pathFrom(rectPts(w, h, rA, rec.edge, rec.amp, 0))
      dFringe = pathFrom(rectPts(w, h, rB, rec.edge, rec.amp * 1.25, 1.5))
    }

    if (!rec.svg) {
      rec.svg = svgEl('svg', { class: 'scrap-svg', 'aria-hidden': 'true' })
      rec.pFringe = svgEl('path', { class: 'scrap-fringe' })
      rec.pFace = svgEl('path', { class: 'scrap-face' })
      rec.pGrain = svgEl('path', { class: 'scrap-grain', filter: 'url(#scrapsGrain)' })
      rec.svg.append(rec.pFringe, rec.pFace, rec.pGrain)
    }
    // things like el.textContent = '...' wipe the injected svg; put it back
    if (rec.svg.parentNode !== el) el.prepend(rec.svg)
    rec.svg.setAttribute('width', w + B * 2)
    rec.svg.setAttribute('height', h + B * 2)
    rec.svg.setAttribute('viewBox', `${-B} ${-B} ${w + B * 2} ${h + B * 2}`)
    rec.svg.style.left = -B + 'px'
    rec.svg.style.top = -B + 'px'
    rec.pFringe.setAttribute('d', dFringe)
    rec.pFace.setAttribute('d', dFace)
    rec.pGrain.setAttribute('d', dFace)
    if (rec.rot) el.style.setProperty('--scrap-rot', ((rC() * 2 - 1) * rec.rot).toFixed(2) + 'deg')
  }

  // while hovered, keep re-tearing so the paper quivers like boiling ink
  function hookBoil (rec) {
    let t = null
    rec.el.addEventListener('mouseenter', () => {
      if (state.reduced || !state.boil || rec.el.disabled || t) return
      rec.n++; paint(rec)
      t = setInterval(() => { rec.n++; paint(rec) }, 150)
    })
    rec.el.addEventListener('mouseleave', () => { clearInterval(t); t = null })
  }

  /* ---------------- paper fx ----------------
   * click effects that treat the component like actual paper.
   * clones of the element, clipped along seeded jagged lines, do the
   * moving; the real element hides and comes back freshly torn.
   */

  function baseT (el) {
    const m = getComputedStyle(el).transform
    return m && m !== 'none' ? m + ' ' : ''
  }

  // a jagged vertical tear line at x, running past the top and bottom
  function fxEdge (x, h, r, P) {
    const pts = [[x + (r() * 2 - 1) * 5, -P]]
    const n = Math.max(5, Math.round(h / 6))
    for (let i = 0; i <= n; i++) {
      pts.push([x + (r() * 2 - 1) * Math.min(8, 4 + h * 0.04), (h * i) / n])
    }
    pts.push([x + (r() * 2 - 1) * 5, h + P])
    return pts
  }

  // the area between two vertical edges: down edgeA, back up edgeB
  function fxPoly (edgeA, edgeB) {
    const pts = edgeA.concat(edgeB.slice().reverse())
    return 'polygon(' + pts.map(p => p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px').join(',') + ')'
  }

  function overlayClone (el) {
    const c = el.cloneNode(true)
    const cs = getComputedStyle(el)
    c.removeAttribute('id')
    c.setAttribute('aria-hidden', 'true')
    c.style.position = 'absolute'
    c.style.left = el.offsetLeft + 'px'
    c.style.top = el.offsetTop + 'px'
    // offsetWidth rounds to integers and a hair-narrower clone re-wraps its
    // text; the computed style keeps the fractional size
    c.style.width = cs.width
    c.style.height = cs.height
    c.style.margin = '0'
    c.style.pointerEvents = 'none'
    c.style.visibility = 'visible'
    el.parentNode.insertBefore(c, el.nextSibling)
    return c
  }

  function fxGuard (el) {
    const rec = el && el.__scrapRec
    if (!rec || el.__scrapFxBusy) return null
    if (state.reduced) { tear(el); return null }
    el.__scrapFxBusy = true
    return rec
  }

  // hide the element and stand up one clipped clone per region
  function fxClones (el, clips) {
    el.style.visibility = 'hidden'
    return clips.map(clip => {
      const c = overlayClone(el)
      c.style.clipPath = clip
      return c
    })
  }

  function fxFinish (el, rec, clones, ms) {
    setTimeout(() => {
      paint(rec)
      el.style.visibility = ''
      clones.forEach(c => c.remove())
      el.__scrapFxBusy = false
    }, ms)
  }

  // the tear opens a little along a jagged line, then mends
  function fxRip (el) {
    const rec = fxGuard(el)
    if (!rec) return
    rec.n++
    const r = rng(state.seed, rec.id, 'fx', rec.n)
    const w = el.offsetWidth, h = el.offsetHeight, P = 26
    const mid = fxEdge(w / 2, h, r, P)
    const b = baseT(el)
    const clones = fxClones(el, [
      fxPoly([[-P, -P], [-P, h + P]], mid),
      fxPoly(mid, [[w + P, -P], [w + P, h + P]]),
    ])
    const D = 520
    const part = (c, dx, dy, da) => c.animate([
      { transform: b },
      { transform: `${b}translate(${dx}px, ${dy}px) rotate(${da}deg)`, offset: 0.38 },
      { transform: `${b}translate(${dx}px, ${dy}px) rotate(${da}deg)`, offset: 0.62 },
      { transform: b },
    ], { duration: D, easing: 'ease-in-out' })
    part(clones[0], -4 - r() * 3, 0, -1.2 - r())
    part(clones[1], 4 + r() * 3, 1.5, 1 + r())
    fxFinish(el, rec, clones, D)
  }

  // strips part slightly in place, then close back up
  function fxShred (el) {
    const rec = fxGuard(el)
    if (!rec) return
    rec.n++
    const r = rng(state.seed, rec.id, 'fx', rec.n)
    const w = el.offsetWidth, h = el.offsetHeight, P = 26
    const n = Math.min(6, Math.max(4, Math.round(w / 22)))
    const edges = [[[-P, -P], [-P, h + P]]]
    for (let k = 1; k < n; k++) edges.push(fxEdge((w * k) / n, h, r, P))
    edges.push([[w + P, -P], [w + P, h + P]])
    const clips = []
    for (let k = 0; k < n; k++) clips.push(fxPoly(edges[k], edges[k + 1]))
    const clones = fxClones(el, clips)
    const b = baseT(el)
    const D = 560
    clones.forEach((c, k) => {
      const dy = (k % 2 ? 1 : -1) * (2.5 + r() * 3)
      const da = (r() * 2 - 1) * 2.2
      c.animate([
        { transform: b },
        { transform: `${b}translate(0, ${dy}px) rotate(${da}deg)`, offset: 0.4 },
        { transform: `${b}translate(0, ${dy}px) rotate(${da}deg)`, offset: 0.68 },
        { transform: b },
      ], { duration: D, delay: k * 18, easing: 'ease-in-out' })
    })
    fxFinish(el, rec, clones, D + n * 18)
  }

  // the right half folds clean over the crease onto the left half, lies
  // there showing the blank back of the paper, then unfolds
  function fxFold (el) {
    const rec = fxGuard(el)
    if (!rec) return
    const w = el.offsetWidth, h = el.offsetHeight, P = 26
    const crease = [[w / 2, -P], [w / 2, h + P]]
    const clipL = fxPoly([[-P, -P], [-P, h + P]], crease)
    const clipR = fxPoly(crease, [[w + P, -P], [w + P, h + P]])
    const b = baseT(el)
    const org = (w / 2) + 'px 50%'
    const cs = getComputedStyle(el)

    const left = overlayClone(el)
    left.style.clipPath = clipL

    // the folding flap is a 3D plane with two faces: the printed front and
    // the blank back that shows once it goes past ninety degrees
    const holder = document.createElement('span')
    holder.setAttribute('aria-hidden', 'true')
    holder.style.position = 'absolute'
    holder.style.left = el.offsetLeft + 'px'
    holder.style.top = el.offsetTop + 'px'
    holder.style.width = cs.width
    holder.style.height = cs.height
    holder.style.margin = '0'
    holder.style.pointerEvents = 'none'
    holder.style.transformStyle = 'preserve-3d'
    holder.style.transformOrigin = org
    holder.style.zIndex = 5
    el.parentNode.insertBefore(holder, el.nextSibling)

    const face = backside => {
      const f = el.cloneNode(true)
      f.removeAttribute('id')
      f.setAttribute('aria-hidden', 'true')
      f.style.position = 'absolute'
      f.style.left = '0'
      f.style.top = '0'
      f.style.width = '100%'
      f.style.height = '100%'
      f.style.margin = '0'
      f.style.visibility = 'visible'
      f.style.pointerEvents = 'none'
      // the back face is the flap mirrored about the crease, so that after
      // its own 180° flip plus the holder's fold it lands on the left half
      f.style.clipPath = backside ? clipL : clipR
      f.style.backfaceVisibility = 'hidden'
      f.style.transformOrigin = org
      f.style.transform = backside ? 'rotateY(180deg)' : 'none'
      if (backside) {
        f.style.color = 'transparent'
        f.style.filter = 'brightness(0.94)'
      }
      holder.appendChild(f)
    }
    face(false)
    face(true)

    el.style.visibility = 'hidden'
    const D = 950
    holder.animate([
      { transform: `perspective(700px) ${b}rotateY(0deg)`, easing: 'cubic-bezier(.5,0,.55,1)' },
      { transform: `perspective(700px) ${b}rotateY(-178deg)`, offset: 0.44 },
      { transform: `perspective(700px) ${b}rotateY(-178deg)`, offset: 0.6, easing: 'cubic-bezier(.45,0,.55,1)' },
      { transform: `perspective(700px) ${b}rotateY(0deg)` },
    ], { duration: D })
    fxFinish(el, rec, [left, holder], D)
  }

  // one press flat, one small stuck tug, release
  function fxGlue (el) {
    const rec = fxGuard(el)
    if (!rec) return
    const b = baseT(el)
    const D = 640
    el.animate([
      { transform: b },
      { transform: `${b}translateY(1.5px) scale(.975)`, offset: 0.2 },
      { transform: `${b}translateY(1.5px) scale(.975)`, offset: 0.55 },
      { transform: `${b}translateY(0.5px) scale(.988)`, offset: 0.7 },
      { transform: `${b}translateY(1.5px) scale(.975)`, offset: 0.82 },
      { transform: b },
    ], { duration: D, easing: 'ease-in-out' })
    const from = getComputedStyle(rec.svg).filter
    if (from && from !== 'none') {
      const flat = 'drop-shadow(0px 0.5px 0.5px rgba(12, 22, 16, 0.4))'
      rec.svg.animate([
        { filter: from },
        { filter: flat, offset: 0.2 },
        { filter: flat, offset: 0.82 },
        { filter: from },
      ], { duration: D, easing: 'ease-in-out' })
    }
    setTimeout(() => { el.__scrapFxBusy = false }, D)
  }

  const FX = { rip: fxRip, fold: fxFold, glue: fxGlue, shred: fxShred }

  /* ---------------- builders ---------------- */

  function buildField (el) {
    const isRange = el.type === 'range'
    const wrap = document.createElement('span')
    wrap.className = isRange
      ? 'scrap-field-wrap scrap-range-wrap'
      : 'scrap-field-wrap' +
        (el.tagName === 'SELECT' ? ' scrap-select' : '') +
        (el.tagName === 'TEXTAREA' ? ' scrap-area' : '')
    for (const k of ['color', 'edge', 'seed', 'amp', 'rot', 'boil']) {
      if (el.dataset[k] != null) wrap.dataset[k] = el.dataset[k]
    }
    el.parentNode.insertBefore(wrap, el)
    wrap.appendChild(el)
    if (isRange) {
      // a thin torn strip as the track, real range input riding on top
      const track = document.createElement('span')
      track.className = 'scrap-range-track'
      wrap.prepend(track)
      attach(track, 'box', { edge: 'torn', amp: 2.4, color: el.dataset.color || 'kraft', id: el.dataset.seed })
    } else {
      const rec = attach(wrap, 'field')
      if (el.tagName === 'SELECT') buildSelectMenu(wrap, el, rec)
    }
  }

  // a paper dropdown for selects. the native element keeps the value and
  // the keyboard focus; the menu re-tears every time it opens.
  function buildSelectMenu (wrap, select, fieldRec) {
    let isOpen = false
    let activeI = -1
    let items = []
    const menu = document.createElement('div')
    menu.className = 'scrap-menu'
    menu.setAttribute('role', 'listbox')
    wrap.appendChild(menu)
    const menuRec = attach(menu, 'card', { edge: 'torn', amp: 3, rot: 0.6, color: 'white', id: fieldRec.id + '-menu' })
    // the highlight is a freshly cut piece of paper laid under the active row
    const hl = document.createElement('span')
    hl.className = 'scrap-option-hl'
    const hlRec = attach(hl, 'box', { edge: 'cut', amp: 2.2, rot: 1.1, color: 'marigold', id: fieldRec.id + '-hl' })
    const host = wrap.parentElement && wrap.parentElement.closest('.scrap')
    const raised = []
    select.setAttribute('aria-haspopup', 'listbox')
    select.setAttribute('aria-expanded', 'false')

    const setActive = i => {
      activeI = i
      items.forEach((it, k) => it.classList.toggle('is-active', k === i))
      const it = items[i]
      if (it) {
        hl.style.top = it.offsetTop + 'px'
        hl.style.left = it.offsetLeft + 'px'
        hl.style.width = it.offsetWidth + 'px'
        hl.style.height = it.offsetHeight + 'px'
        hlRec.n++
        paint(hlRec)
      }
    }

    const close = () => {
      if (!isOpen) return
      isOpen = false
      menu.classList.remove('is-open')
      select.setAttribute('aria-expanded', 'false')
      raised.forEach(([n, z]) => { n.style.zIndex = z })
      raised.length = 0
      document.removeEventListener('mousedown', onDocDown, true)
    }

    const onDocDown = e => { if (!wrap.contains(e.target)) close() }

    const choose = i => {
      const opt = select.options[i]
      if (opt && !opt.disabled && select.selectedIndex !== i) {
        select.selectedIndex = i
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
      close()
    }

    const openMenu = () => {
      if (isOpen) return
      isOpen = true
      menu.textContent = ''
      items = Array.from(select.options).map((opt, i) => {
        const it = document.createElement('div')
        it.className = 'scrap-option'
        it.setAttribute('role', 'option')
        it.setAttribute('aria-selected', String(i === select.selectedIndex))
        it.textContent = opt.textContent
        it.addEventListener('mouseenter', () => setActive(i))
        it.addEventListener('click', () => choose(i))
        menu.appendChild(it)
        return it
      })
      menu.appendChild(hl)
      menu.classList.add('is-open')
      menuRec.n++
      paint(menuRec)
      setActive(select.selectedIndex)
      select.setAttribute('aria-expanded', 'true')
      // every ancestor between the field and its card is a stacking context
      // (and so is the card); raise the whole chain above later siblings
      for (let n = wrap; n && n !== document.body; n = n.parentElement) {
        raised.push([n, n.style.zIndex])
        n.style.zIndex = 40
        if (n === host) break
      }
      document.addEventListener('mousedown', onDocDown, true)
    }

    // on touch the native picker is the better control (and iOS opens it
    // regardless of preventDefault), so the paper menu is pointer-only
    let lastPointerType = ''
    select.addEventListener('pointerdown', e => { lastPointerType = e.pointerType })
    select.addEventListener('mousedown', e => {
      if (lastPointerType === 'touch' || lastPointerType === 'pen') return
      e.preventDefault()
      select.focus()
      if (isOpen) close()
      else openMenu()
    })
    menu.addEventListener('mousedown', e => e.preventDefault())
    select.addEventListener('keydown', e => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          openMenu()
        }
        return
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(items.length - 1, activeI + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, activeI - 1)) }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(activeI) }
      else if (e.key === 'Escape') { e.preventDefault(); close() }
      else if (e.key === 'Tab') { close() }
    })
    select.addEventListener('blur', close)
  }

  function buildChoice (label, kind) {
    const input = label.querySelector('input')
    if (!input) return
    label.classList.add('scrap-choice', 'scrap-' + kind)
    const box = document.createElement('span')
    box.className = 'scrap-boxslot'
    input.after(box)
    const txt = document.createElement('span')
    txt.className = 'scrap-choice-text'
    while (box.nextSibling) txt.appendChild(box.nextSibling)
    label.appendChild(txt)

    const trackColor = label.dataset.color || (kind === 'toggle' ? 'kraft' : 'white')
    const boxRec = attach(box, 'box', {
      edge: kind === 'radio' ? 'torn' : 'cut',
      shape: kind === 'radio' ? 'blob' : null,
      color: trackColor,
      id: label.dataset.seed,
    })

    const mark = document.createElement('span')
    mark.className = 'scrap-mark'
    box.appendChild(mark)
    if (kind === 'toggle') {
      attach(mark, 'box', { edge: 'torn', amp: 1.8, color: 'white', id: boxRec.id + '-thumb' })
    } else if (kind === 'radio') {
      attach(mark, 'box', { shape: 'blob', color: 'ink', id: boxRec.id + '-dot' })
    } else {
      const markRec = attach(mark, 'box', { shape: 'x', color: 'ink', id: boxRec.id + '-x', rot: 13 })
      // every check lands the X a little differently
      input.addEventListener('change', () => {
        if (!input.checked) return
        markRec.n++
        const r = rng(state.seed, markRec.id, 'place', markRec.n)
        mark.style.translate =
          ((r() * 2 - 1) * 2.5).toFixed(1) + 'px ' + ((r() * 2 - 1) * 2.5).toFixed(1) + 'px'
        paint(markRec)
      })
    }
  }

  function addTape (el, rec) {
    const r = rng(state.seed, rec.id, 'tapepos')
    const tape = document.createElement('span')
    tape.className = 'scrap-tapeslot'
    tape.style.left = (14 + r() * 48) + '%'
    el.appendChild(tape)
    attach(tape, 'tape', { edge: ['cut', 'torn', 'cut', 'torn'], rot: 9, id: rec.id + '-tape' })
  }

  function setProgress (el, v) {
    v = Math.max(0, Math.min(100, +v || 0))
    el.dataset.value = v
    const fill = el.querySelector('.scrap-fill')
    if (fill) fill.style.width = v + '%'
    el.setAttribute('aria-valuenow', Math.round(v))
  }

  function buildProgress (el) {
    el.setAttribute('role', 'progressbar')
    el.setAttribute('aria-valuemin', '0')
    el.setAttribute('aria-valuemax', '100')
    const rec = attach(el, 'progress', { color: el.dataset.color || 'white' })
    const fill = document.createElement('span')
    fill.className = 'scrap-fill'
    fill.dataset.color = el.dataset.fill || 'coral'
    el.appendChild(fill)
    attach(fill, 'box', { edge: 'torn', amp: 2.2, id: rec.id + '-fill' })
    setProgress(el, el.dataset.value || 0)
  }

  const BUILDERS = {
    button: el => attach(el, 'button'),
    chip: el => attach(el, 'chip'),
    divider: el => attach(el, 'divider'),
    card: el => {
      const rec = attach(el, 'card')
      if (el.dataset.tape != null) addTape(el, rec)
    },
    field: buildField,
    input: buildField,
    checkbox: el => buildChoice(el, 'checkbox'),
    radio: el => buildChoice(el, 'radio'),
    toggle: el => buildChoice(el, 'toggle'),
    progress: buildProgress,
  }

  function enhance (el) {
    if (el.__scrapRec) return
    const type = el.dataset.scrap || 'card'
    ;(BUILDERS[type] || BUILDERS.card)(el)
  }

  /* ---------------- public api ---------------- */

  function init (root = document) {
    ensureDefs()
    root.querySelectorAll('[data-scrap]').forEach(enhance)
  }

  function reseed (seed) {
    state.seed = String(seed)
    for (const rec of recs) { rec.n = 0; paint(rec) }
  }

  function tear (el) {
    const rec = el && el.__scrapRec
    if (rec) { rec.n++; paint(rec) }
  }

  return {
    init,
    enhance,
    tear,
    reseed,
    setProgress,
    fx: FX,
    get seed () { return state.seed },
    get boil () { return state.boil },
    set boil (v) { state.boil = !!v },
  }
})
