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
    avatar:   { edge: 'torn', amp: 2.6, rot: 2.0, boil: false },
    skeleton: { edge: 'torn', amp: 2.4, rot: 0.5, boil: false },
    box:      { edge: 'cut',  amp: 2.0, rot: 0,   boil: false },
    tape:     { edge: 'cut',  amp: 2.0, rot: 0,   boil: false },
  }

  // an <input> takes no children and a <textarea>'s children are its value,
  // so paper for these is cut out of the element itself instead of laid behind
  const NO_CHILDREN = /^(INPUT|TEXTAREA|SELECT|IMG|HR|BR|AREA|EMBED|IFRAME|CANVAS|VIDEO|AUDIO|OBJECT|PROGRESS|METER)$/

  const holdsPaper = el => !NO_CHILDREN.test(el.tagName)

  /* ---------------- attach & paint ---------------- */

  const recs = new Set()
  // listener lifecycles are tied to each rec's AbortController so release()
  // can tear a component down without tracking handlers individually
  const sig = rec => (rec.ac ? { signal: rec.ac.signal } : {})
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

  let defsDone = false

  function ensureDefs () {
    if (defsDone) return
    if (!document.body) return
    if (document.getElementById('scraps-defs')) { defsDone = true; return }
    const svg = svgEl('svg', { id: 'scraps-defs', width: 0, height: 0, 'aria-hidden': 'true' })
    svg.style.position = 'absolute'
    svg.innerHTML =
      '<defs><filter id="scrapsGrain" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.9 0.9 0.9 0 0" result="a"/>' +
      '<feComposite in="a" in2="SourceAlpha" operator="in"/>' +
      '</filter></defs>'
    document.body.prepend(svg)
    defsDone = true
  }

  function attach (el, type, o = {}) {
    if (el.__scrapRec) return el.__scrapRec
    ensureDefs()
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
      mode: o.mode || (holdsPaper(el) ? 'svg' : 'clip'),
      skin: !!o.skin,
      adapter: o.adapter || null,
      color: o.color || ds.color || null,
      n: 0,
      svg: null,
      ac: typeof AbortController === 'function' ? new AbortController() : null,
    }
    el.__scrapRec = rec
    // skin mode papers an element scraps did not build, so it adds none of the
    // display, color or component styling that would fight the host's own css
    if (rec.skin) {
      el.classList.add('scrap-skin', 'scrap-skin-' + type)
      // in clip mode the host's own background is the paper, so it stays
      if (o.reset !== false && rec.mode === 'svg') el.classList.add('scrap-skin-reset')
      if (o.ink && rec.mode === 'svg') el.classList.add('scrap-skin-text')
      if (rec.rot) el.classList.add('scrap-skin-rot')
    } else {
      el.classList.add('scrap', 'scrap-' + type)
    }
    if (rec.color) el.classList.add('scrap--' + rec.color)
    recs.add(rec)
    paint(rec)
    if (ro) ro.observe(el)
    // MutationObserver has no unobserve, so a skin gets its own: an adapted
    // host element outlives its paper and must not stay registered forever
    if (rec.skin && typeof MutationObserver === 'function') {
      rec.mo = new MutationObserver(() => {
        if (rec.svg && rec.svg.parentNode !== el) paint(rec)
      })
      rec.mo.observe(el, { childList: true })
    } else if (mo) mo.observe(el, { childList: true })
    if (rec.boil) hookBoil(rec)
    if (ds.fx && FX[ds.fx]) el.addEventListener('click', () => FX[ds.fx](el), sig(rec))
    return rec
  }

  // un-enhance an element and everything scrap-built inside it: aborts
  // listeners, stops observers, removes injected svgs, frees the records
  function release (root) {
    if (!root || !root.querySelectorAll) return
    const nodes = [root, ...root.querySelectorAll('*')]
    for (const n of nodes) releaseOne(n)
  }

  function releaseOne (n) {
    const rec = n.__scrapRec
    if (!rec) return
    if (rec.ac) rec.ac.abort()
    if (ro) ro.unobserve(n)
    if (rec.mo) rec.mo.disconnect()
    if (rec.svg) rec.svg.remove()
    // a skinned host element stays in the page after its paper goes, so the
    // reset classes have to come off or it keeps a transparent background
    if (rec.skin) {
      n.classList.remove(
        'scrap-skin', 'scrap-skin-' + rec.type,
        'scrap-skin-reset', 'scrap-skin-rot', 'scrap-skin-text',
      )
      n.style.removeProperty('--scrap-rot')
      n.style.removeProperty('clip-path')
      if (rec.color) n.classList.remove('scrap--' + rec.color)
    }
    recs.delete(rec)
    delete n.__scrapRec
    delete n.__scrapSel
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

    // clip mode has no paper of its own: the tear is cut out of the element,
    // so the wobble runs inward or the edge would just be clipped away
    if (rec.mode === 'clip') {
      const pts = rectPts(w, h, rA, rec.edge, rec.amp, -rec.amp)
      el.style.clipPath =
        'polygon(' + pts.map(pt => pt[0].toFixed(1) + 'px ' + pt[1].toFixed(1) + 'px').join(',') + ')'
      if (rec.rot) el.style.setProperty('--scrap-rot', ((rC() * 2 - 1) * rec.rot).toFixed(2) + 'deg')
      return
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
    if (rec.type === 'avatar') {
      const img = el.querySelector('img')
      if (img) {
        const rD = rng(...base, 'clip')
        const pts = rectPts(w, h, rD, rec.edge, rec.amp * 0.9, -1.2)
        img.style.clipPath = 'polygon(' + pts.map(pt => pt[0].toFixed(1) + 'px ' + pt[1].toFixed(1) + 'px').join(',') + ')'
      }
    }
    if (rec.rot) el.style.setProperty('--scrap-rot', ((rC() * 2 - 1) * rec.rot).toFixed(2) + 'deg')
  }

  // while hovered, keep re-tearing so the paper quivers like boiling ink
  function hookBoil (rec) {
    let t = null
    const stop = () => { clearInterval(t); t = null }
    rec.el.addEventListener('mouseenter', () => {
      if (state.reduced || !state.boil || rec.el.disabled || t) return
      rec.n++; paint(rec)
      t = setInterval(() => { rec.n++; paint(rec) }, 150)
    }, sig(rec))
    rec.el.addEventListener('mouseleave', stop, sig(rec))
    if (rec.ac) rec.ac.signal.addEventListener('abort', stop)
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


  /* ---------------- overlays: dialog, menu, tooltip, toast ---------------- */

  function buildDialog (el) {
    const rec = attach(el, 'card', { rot: 0.5 })
    el.classList.add('scrap-dialog')
    if (el.dataset.tape != null) addTape(el, rec)
    // any [data-close] inside closes the dialog
    el.addEventListener('click', e => {
      const c = e.target.closest && e.target.closest('[data-close]')
      if (c && el.contains(c) && el.close) el.close()
    }, sig(rec))
  }

  // a generic paper menu: any <button data-menu="#panel"> toggles it
  function buildMenu (el) {
    const rec = attach(el, 'card', { rot: 0.6 })
    el.classList.add('scrap-menu-panel')
    el.setAttribute('role', 'menu')
    el.querySelectorAll(':scope > button, :scope > a').forEach(b => {
      b.classList.add('scrap-option')
      b.setAttribute('role', 'menuitem')
    })
    attachRowHighlight(el, rec)
  }

  // the cut-paper highlight that tracks .scrap-option rows under the cursor
  function attachRowHighlight (panel, ownerRec) {
    const hl = document.createElement('span')
    hl.className = 'scrap-option-hl'
    hl.style.opacity = '0'
    panel.appendChild(hl)
    const hlRec = attach(hl, 'box', { edge: 'cut', amp: 2.2, rot: 1.1, color: 'marigold', id: ownerRec.id + '-hl' })
    panel.addEventListener('mouseover', e => {
      const row = e.target.closest && e.target.closest('.scrap-option')
      if (!row || !panel.contains(row)) { hl.style.opacity = '0'; return }
      hl.style.opacity = '1'
      hl.style.top = row.offsetTop + 'px'
      hl.style.left = row.offsetLeft + 'px'
      hl.style.width = row.offsetWidth + 'px'
      hl.style.height = row.offsetHeight + 'px'
      hlRec.n++
      paint(hlRec)
    }, sig(ownerRec))
    panel.addEventListener('mouseleave', () => { hl.style.opacity = '0' }, sig(ownerRec))
  }

  function wireMenus () {
    if (wireMenus.done) return
    wireMenus.done = true
    const openPanel = () => document.querySelector('.scrap-menu-panel.is-open')
    document.addEventListener('click', e => {
      const t = e.target.closest && e.target.closest('[data-menu]')
      const open = openPanel()
      if (t) {
        const panel = document.querySelector(t.dataset.menu)
        if (!panel) return
        if (open && open !== panel) open.classList.remove('is-open')
        if (panel.classList.contains('is-open')) {
          panel.classList.remove('is-open')
          t.setAttribute('aria-expanded', 'false')
          return
        }
        panel.classList.add('is-open')
        const rec = panel.__scrapRec
        if (rec) { rec.n++; paint(rec) }
        const r = t.getBoundingClientRect()
        const pr = panel.getBoundingClientRect()
        let top = r.bottom + 10
        if (top + pr.height > innerHeight - 8) top = Math.max(8, r.top - pr.height - 10)
        panel.style.top = top + 'px'
        panel.style.left = Math.max(8, Math.min(r.left, innerWidth - pr.width - 8)) + 'px'
        t.setAttribute('aria-expanded', 'true')
      } else if (open && (e.target.closest('.scrap-option') || !e.target.closest('.scrap-menu-panel'))) {
        open.classList.remove('is-open')
      }
    })
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const open = openPanel()
        if (open) open.classList.remove('is-open')
      }
    })
  }

  // tooltips: one shared scrap serves every [data-tip] element
  let tipEl = null
  let tipRec = null
  let tipTarget = null
  function showTip (target) {
    if (!tipEl) {
      tipEl = document.createElement('span')
      tipEl.setAttribute('role', 'tooltip')
      document.body.appendChild(tipEl)
      tipRec = attach(tipEl, 'chip', { color: 'kraft', rot: 2, boil: false })
      tipEl.classList.add('scrap-tip')
    }
    tipTarget = target
    tipEl.textContent = target.dataset.tip
    tipRec.n++
    paint(tipRec)
    tipEl.classList.add('is-on')
    const r = target.getBoundingClientRect()
    const tr = tipEl.getBoundingClientRect()
    let top = r.top - tr.height - 10
    if (top < 8) top = r.bottom + 10
    tipEl.style.top = top + 'px'
    tipEl.style.left = Math.max(8, Math.min(r.left + r.width / 2 - tr.width / 2, innerWidth - tr.width - 8)) + 'px'
  }
  function hideTip () {
    if (tipEl) tipEl.classList.remove('is-on')
    tipTarget = null
  }
  function wireTips () {
    if (wireTips.done) return
    wireTips.done = true
    document.addEventListener('mouseover', e => {
      const t = e.target.closest && e.target.closest('[data-tip]')
      if (t) showTip(t)
      else if (tipTarget) hideTip()
    })
    document.addEventListener('focusin', e => {
      const t = e.target.closest && e.target.closest('[data-tip]')
      if (t) showTip(t)
    })
    document.addEventListener('focusout', hideTip)
    addEventListener('scroll', hideTip, true)
  }

  let toastBox = null
  // Scraps.toast('saved', { color: 'kraft', duration: 4000 }) -> close()
  function toast (msg, o = {}) {
    if (!toastBox) {
      toastBox = document.createElement('div')
      toastBox.className = 'scrap-toasts'
      toastBox.setAttribute('aria-live', 'polite')
      document.body.appendChild(toastBox)
    }
    const t = document.createElement('div')
    t.className = 'scrap-toast'
    t.textContent = String(msg)
    toastBox.appendChild(t)
    const rec = attach(t, 'card', { color: o.color || 'white', rot: 2 })
    addTape(t, rec)
    if (!state.reduced) {
      t.animate(
        [{ transform: 'translateY(14px) rotate(2deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 240, easing: 'ease-out' }
      )
    }
    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      const done = () => { release(t); t.remove() }
      if (state.reduced) return done()
      // fill forwards, or the toast pops back for a frame before removal;
      // the margin collapse slides the rest of the stack up smoothly
      t.animate([
        { transform: 'none', opacity: 1, marginBottom: '0px' },
        { transform: 'translateY(-10px) rotate(-6deg)', opacity: 0, marginBottom: '0px', offset: 0.65 },
        { transform: 'translateY(-10px) rotate(-6deg)', opacity: 0, marginBottom: (-t.offsetHeight - 16) + 'px' },
      ], { duration: 430, easing: 'ease-in', fill: 'forwards' })
      setTimeout(done, 450)
    }
    if (o.duration !== 0) setTimeout(close, o.duration || 4000)
    t.addEventListener('click', close, sig(rec))
    return close
  }

  /* ---------------- disclosure and data: tabs, accordion, table ----------- */

  function buildTabs (el) {
    el.classList.add('scrap-tabs')
    const base = el.dataset.seed || ('tabs' + state.uid++)
    const tabs = [...el.querySelectorAll('[data-tab]')]
    const panels = [...el.querySelectorAll('[data-panel]')]
    const row = el.querySelector(':scope > .scrap-tabs-row')
    if (row) row.setAttribute('role', 'tablist')
    tabs.forEach((b, i) => {
      b.classList.add('scrap-tab')
      b.setAttribute('role', 'tab')
      attach(b, 'chip', { color: 'kraft', rot: 1.5, id: base + '-t' + i })
    })
    panels.forEach((pn, i) => {
      pn.setAttribute('role', 'tabpanel')
      attach(pn, 'card', { id: base + '-p' + i })
    })
    const activate = i => {
      tabs.forEach((b, k) => {
        b.classList.toggle('is-active', k === i)
        b.setAttribute('aria-selected', String(k === i))
      })
      panels.forEach((pn, k) => { pn.hidden = k !== i })
      const rec = tabs[i] && tabs[i].__scrapRec
      if (rec) { rec.n++; paint(rec) }
    }
    tabs.forEach((b, i) => b.addEventListener('click', () => activate(i), sig(b.__scrapRec)))
    activate(Math.max(0, tabs.findIndex(b => b.dataset.tab === el.dataset.active)))
  }

  function buildAccordion (el) {
    // closed <details> hides every non-summary child, the svg included,
    // so the paper lives on a wrapper
    let wrap = el.parentElement && el.parentElement.classList.contains('scrap-accordion')
      ? el.parentElement
      : null
    if (!wrap) {
      wrap = document.createElement('div')
      wrap.className = 'scrap-accordion'
      el.parentNode.insertBefore(wrap, el)
      wrap.appendChild(el)
    }
    for (const k of ['color', 'edge', 'seed', 'amp', 'rot']) {
      if (el.dataset[k] != null) wrap.dataset[k] = el.dataset[k]
    }
    attach(wrap, 'card', { rot: 0.5 })
    wrap.classList.add('scrap-accordion')
  }

  function buildTable (el) {
    // paper on the outer wrap, horizontal scrolling on an inner div: overflow
    // on the paper itself would clip the torn edges
    let wrap = el.closest('.scrap-table-wrap')
    if (!wrap) {
      wrap = document.createElement('div')
      wrap.className = 'scrap-table-wrap'
      el.parentNode.insertBefore(wrap, el)
      wrap.appendChild(el)
    }
    let scroller = wrap.querySelector(':scope > .scrap-table-scroll')
    if (!scroller) {
      scroller = document.createElement('div')
      scroller.className = 'scrap-table-scroll'
      wrap.appendChild(scroller)
      scroller.appendChild(el)
    }
    for (const k of ['color', 'edge', 'seed', 'amp', 'rot']) {
      if (el.dataset[k] != null) wrap.dataset[k] = el.dataset[k]
    }
    attach(wrap, 'card', { rot: 0.5 })
    wrap.classList.add('scrap-table-wrap')
  }

  function buildAvatar (el) {
    let wrap = el.parentElement && el.parentElement.classList.contains('scrap-avatar-wrap')
      ? el.parentElement
      : null
    if (!wrap) {
      wrap = document.createElement('span')
      wrap.className = 'scrap-avatar-wrap'
      el.parentNode.insertBefore(wrap, el)
      wrap.appendChild(el)
    }
    for (const k of ['color', 'edge', 'seed', 'amp', 'rot']) {
      if (el.dataset[k] != null) wrap.dataset[k] = el.dataset[k]
    }
    attach(wrap, 'avatar', {})
    wrap.classList.add('scrap-avatar-wrap')
  }

  // loading paper never settles: a slow permanent boil
  function slowBoil (rec) {
    if (state.reduced) return
    const iv = setInterval(() => {
      if (!rec.el.isConnected) return clearInterval(iv)
      rec.n++
      paint(rec)
    }, 1100)
    if (rec.ac) rec.ac.signal.addEventListener('abort', () => clearInterval(iv))
  }

  function buildSkeleton (el) {
    slowBoil(attach(el, 'skeleton', { color: el.dataset.color || 'kraft' }))
  }

  function buildAlert (el) {
    const rec = attach(el, 'card', { color: el.dataset.color || 'kraft', rot: 0.8 })
    el.classList.add('scrap-alert')
    if (!el.getAttribute('role')) el.setAttribute('role', 'alert')
    addTape(el, rec)
  }

  /* ---------------- builders ---------------- */

  function buildField (el) {
    const isRange = el.type === 'range'
    // a pre-rendered wrapper (React, server HTML) is adopted instead of
    // re-wrapping, since frameworks break when their nodes get reparented
    let wrap = el.parentElement && el.parentElement.classList.contains('scrap-field-wrap')
      ? el.parentElement
      : null
    if (!wrap) {
      wrap = document.createElement('span')
      wrap.className = 'scrap-field-wrap'
      el.parentNode.insertBefore(wrap, el)
      wrap.appendChild(el)
    }
    wrap.classList.add('scrap-field-wrap')
    if (isRange) wrap.classList.add('scrap-range-wrap')
    if (el.tagName === 'SELECT') wrap.classList.add('scrap-select')
    if (el.tagName === 'TEXTAREA') wrap.classList.add('scrap-area')
    for (const k of ['color', 'edge', 'seed', 'amp', 'rot', 'boil']) {
      if (el.dataset[k] != null) wrap.dataset[k] = el.dataset[k]
    }
    if (isRange) {
      // a thin torn strip as the track, real range input riding on top
      let track = wrap.querySelector(':scope > .scrap-range-track')
      if (!track) {
        track = document.createElement('span')
        track.className = 'scrap-range-track'
        wrap.prepend(track)
      }
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
    // a stale menu from a previous enhancement has dead listeners; rebuild
    wrap.querySelectorAll(':scope > .scrap-menu').forEach(m => m.remove())
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
    select.addEventListener('pointerdown', e => { lastPointerType = e.pointerType }, sig(menuRec))
    select.addEventListener('mousedown', e => {
      if (lastPointerType === 'touch' || lastPointerType === 'pen') return
      e.preventDefault()
      select.focus()
      if (isOpen) close()
      else openMenu()
    }, sig(menuRec))
    menu.addEventListener('mousedown', e => e.preventDefault(), sig(menuRec))
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
    }, sig(menuRec))
    select.addEventListener('blur', close, sig(menuRec))
  }

  function buildChoice (label, kind) {
    const input = label.querySelector('input')
    if (!input) return
    label.classList.add('scrap-choice', 'scrap-' + kind)

    // adopt a pre-rendered structure when present (React renders it itself)
    let box = label.querySelector(':scope > .scrap-boxslot')
    if (!box) {
      box = document.createElement('span')
      box.className = 'scrap-boxslot'
      input.after(box)
      const txt = document.createElement('span')
      txt.className = 'scrap-choice-text'
      while (box.nextSibling) txt.appendChild(box.nextSibling)
      label.appendChild(txt)
    }
    let mark = box.querySelector('.scrap-mark')
    if (!mark) {
      mark = document.createElement('span')
      mark.className = 'scrap-mark'
      box.appendChild(mark)
    }

    const trackColor = label.dataset.color || (kind === 'toggle' ? 'kraft' : 'white')
    const boxRec = attach(box, 'box', {
      edge: kind === 'radio' ? 'torn' : 'cut',
      shape: kind === 'radio' ? 'blob' : null,
      color: trackColor,
      id: label.dataset.seed,
    })

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
      }, sig(markRec))
    }
  }

  function addTape (el, rec) {
    let tape = el.querySelector(':scope > .scrap-tapeslot')
    if (!tape) {
      const r = rng(state.seed, rec.id, 'tapepos')
      tape = document.createElement('span')
      tape.className = 'scrap-tapeslot'
      tape.style.left = (14 + r() * 48) + '%'
      el.appendChild(tape)
    }
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
    let fill = el.querySelector(':scope > .scrap-fill')
    if (!fill) {
      fill = document.createElement('span')
      fill.className = 'scrap-fill'
      fill.dataset.color = el.dataset.fill || 'coral'
      el.appendChild(fill)
    }
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
    dialog: buildDialog,
    menu: buildMenu,
    tabs: buildTabs,
    accordion: buildAccordion,
    table: buildTable,
    avatar: buildAvatar,
    skeleton: buildSkeleton,
    alert: buildAlert,
  }

  function enhance (el) {
    if (el.__scrapRec) return
    const type = el.dataset.scrap || 'card'
    if (el.dataset.skin != null) return void skin(el, type)
    ;(BUILDERS[type] || BUILDERS.card)(el)
  }

  /* ---------------- custom palettes ---------------- */

  const OK_NAME = /^[a-z][a-z0-9-]*$/i
  const OK_COLOR = /^[#a-z0-9(),.%\s-]+$/i

  // Scraps.registerColors({ brand: '#7A4FBF', night: { fill: '#101418', text: '#F6F1E4' } })
  // registered names become valid data-color values
  function registerColors (map) {
    let sheet = document.getElementById('scraps-colors')
    if (!sheet) {
      sheet = document.createElement('style')
      sheet.id = 'scraps-colors'
      document.head.appendChild(sheet)
    }
    let css = sheet.textContent
    for (const name in map) {
      if (!OK_NAME.test(name)) continue
      const v = typeof map[name] === 'string' ? { fill: map[name] } : (map[name] || {})
      if (v.fill && OK_COLOR.test(v.fill)) {
        css += '\n.scrap--' + name + ' > .scrap-svg .scrap-face{fill:' + v.fill + '}'
      }
      if (v.text && OK_COLOR.test(v.text)) {
        css += '\n.scrap--' + name + '{color:' + v.text + '}'
        css += '\n.scrap-skin-text.scrap--' + name + '{color:' + v.text + ' !important}'
        css += '\n.scrap--' + name + ' > .scrap-svg .scrap-grain{fill:#fff}'
      }
    }
    sheet.textContent = css
  }

  /* ---------------- skins ----------------
   * paper for elements scraps did not build. a skin is attach() and nothing
   * more: no wrapper nodes, no adopted children, no behavior. that makes it
   * safe on components a framework owns and re-renders, and it leaves the
   * host's own accessibility, keyboard handling and layout alone.
   */

  const SKINS = {
    button:    { type: 'button', ink: true },
    chip:      { type: 'chip', ink: true },
    badge:     { type: 'chip', ink: true },
    tab:       { type: 'chip', color: 'kraft', rot: 1.5, ink: true },
    card:      { type: 'card' },
    panel:     { type: 'card', rot: 0.4 },
    dialog:    { type: 'card', rot: 0.5 },
    popover:   { type: 'card', rot: 0.5 },
    menu:      { type: 'card', rot: 0.6 },
    alert:     { type: 'card', color: 'kraft', rot: 0.8, ink: true },
    field:     { type: 'field' },
    input:     { type: 'field' },
    box:       { type: 'box', ink: true },
    checkbox:  { type: 'box', edge: 'cut', ink: true },
    radio:     { type: 'box', edge: 'torn', shape: 'blob' },
    switch:    { type: 'box', edge: 'cut', color: 'kraft' },
    thumb:     { type: 'box', edge: 'torn', amp: 1.8, color: 'white' },
    row:       { type: 'box', edge: 'torn', rot: 0, ink: true },
    divider:   { type: 'divider' },
    separator: { type: 'divider' },
    progress:  { type: 'progress' },
    fill:      { type: 'box', edge: 'torn', amp: 2.2, color: 'coral' },
    avatar:    { type: 'avatar' },
    skeleton:  { type: 'skeleton', pulse: true },
    tape:      { type: 'tape' },
  }

  function skin (el, name, o) {
    const s = SKINS[name] || SKINS.card
    const opts = Object.assign({}, s, o, { skin: true })
    delete opts.type
    delete opts.pulse
    const rec = attach(el, s.type, opts)
    if (s.pulse) slowBoil(rec)
    return rec
  }

  /* ---------------- adapter ----------------
   * Scraps.adapt({ '[data-slot="button"]': 'button' }) papers a design system
   * scraps knows nothing about. one observer watches the document, so paper
   * reaches portalled dialogs and popovers the moment they mount, and comes
   * off cleanly when they unmount or when the theme is switched away.
   */

  const adapters = new Set()
  const task = typeof queueMicrotask === 'function' ? queueMicrotask : f => setTimeout(f, 0)
  const ATTR_RE = /\[\s*([A-Za-z_:][-\w:.]*)/g

  // only the attributes the map's own selectors read, so state flips like
  // data-open or data-disabled are seen without watching every attribute
  function watchedAttrs (sels) {
    const out = new Set()
    for (const sel of sels) {
      let m
      ATTR_RE.lastIndex = 0
      while ((m = ATTR_RE.exec(sel))) out.add(m[1])
      if (sel.indexOf('.') !== -1) out.add('class')
    }
    return [...out]
  }

  function adapt (map, o = {}) {
    const entries = []
    for (const sel in map) {
      if (!map[sel]) continue
      try { document.querySelector(sel) } catch (e) {
        throw new Error('Scraps.adapt: not a valid selector: ' + sel)
      }
      entries.push({ sel, spec: typeof map[sel] === 'string' ? { type: map[sel] } : map[sel] })
    }
    if (!entries.length) return function noop () {}

    const all = entries.map(e => e.sel).join(',')
    const root = o.root || document
    const pending = new Set()
    const gone = new Set()
    let queued = false

    // later entries win, so '[data-slot=button][data-disabled]' can override
    // the plain '[data-slot=button]' listed above it
    const match = el => {
      let hit = null
      for (const e of entries) if (el.matches(e.sel)) hit = e
      return hit
    }

    const apply = el => {
      // an element papered by a builder or another adapter is not ours to move
      if (el.__scrapRec && el.__scrapRec.adapter !== stop) return
      const hit = match(el)
      if (!hit) return void (el.__scrapSel && releaseOne(el))
      if (el.__scrapSel === hit.sel) return
      if (el.__scrapRec) releaseOne(el)
      el.__scrapSel = hit.sel
      skin(el, hit.spec.type || 'card', Object.assign({ adapter: stop }, hit.spec))
    }

    const collect = node => {
      if (node.nodeType !== 1) return
      if (node.matches(all)) pending.add(node)
      const found = node.querySelectorAll(all)
      for (let i = 0; i < found.length; i++) pending.add(found[i])
    }

    const flush = () => {
      queued = false
      // a moved node is reported as removed and added in the same batch, so
      // only the ones still out of the document are really gone
      for (const n of gone) if (!n.isConnected) release(n)
      gone.clear()
      for (const n of pending) if (n.isConnected) apply(n)
      pending.clear()
    }

    const queue = () => {
      if (queued) return
      queued = true
      task(flush)
    }

    const obs = typeof MutationObserver === 'function'
      ? new MutationObserver(muts => {
          for (const m of muts) {
            if (m.type === 'attributes') { pending.add(m.target); continue }
            for (const n of m.addedNodes) collect(n)
            for (const n of m.removedNodes) if (n.nodeType === 1) gone.add(n)
          }
          queue()
        })
      : null

    function stop () {
      if (!adapters.has(stop)) return
      adapters.delete(stop)
      if (obs) obs.disconnect()
      pending.clear()
      gone.clear()
      for (const rec of [...recs]) if (rec.adapter === stop) releaseOne(rec.el)
    }

    adapters.add(stop)
    ensureDefs()
    collect(root.documentElement || root)
    flush()

    if (obs) {
      const init = { childList: true, subtree: true }
      const attrs = watchedAttrs(entries.map(e => e.sel))
      if (attrs.length) {
        init.attributes = true
        init.attributeFilter = attrs
      }
      obs.observe(root.documentElement || root, init)
    }
    return stop
  }

  function unadapt () {
    for (const stop of [...adapters]) stop()
  }

  /* ---------------- public api ---------------- */

  function init (root = document) {
    ensureDefs()
    wireTips()
    wireMenus()
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
    attach,
    skin,
    adapt,
    unadapt,
    release,
    tear,
    reseed,
    setProgress,
    registerColors,
    toast,
    fx: FX,
    get seed () { return state.seed },
    get boil () { return state.boil },
    set boil (v) { state.boil = !!v },
  }
})
