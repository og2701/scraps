const puppeteer = require('puppeteer-core')
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder')

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main () {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'],
    defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
  })
  const page = await browser.newPage()

  // visible cursor + click pulse on every page
  await page.evaluateOnNewDocument(() => {
    addEventListener('DOMContentLoaded', () => {
      const c = document.createElement('div')
      c.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M2 2 L2 24 L8 19 L12 28 L16 26 L12 17 L20 17 Z" fill="#1E1A14" stroke="#FFFDF4" stroke-width="2"/></svg>'
      c.setAttribute('popover', 'manual')
      document.body.appendChild(c)
      Object.assign(c.style, { position: 'fixed', inset: 'auto', margin: '0', border: '0', padding: '0', background: 'transparent', overflow: 'visible', zIndex: 99999, pointerEvents: 'none', left: '-60px', top: '-60px' })
      try { c.showPopover() } catch (e) {}
      setInterval(() => { try { c.hidePopover(); c.showPopover() } catch (e) {} }, 300)
      addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
      addEventListener('mousedown', e => {
        const p = document.createElement('div')
        Object.assign(p.style, {
          position: 'fixed', zIndex: 99998, pointerEvents: 'none',
          left: e.clientX + 'px', top: e.clientY + 'px',
          width: '10px', height: '10px', margin: '-5px 0 0 -5px',
          borderRadius: '50%', border: '2.5px solid rgba(30,26,20,.6)',
          transition: 'all .45s ease-out',
        })
        p.setAttribute('popover', 'manual')
        document.body.appendChild(p)
        Object.assign(p.style, { inset: 'auto', background: 'transparent' })
        try { p.showPopover() } catch (e) {}
        requestAnimationFrame(() => {
          p.style.width = '46px'; p.style.height = '46px'
          p.style.margin = '-23px 0 0 -23px'; p.style.opacity = '0'
        })
        setTimeout(() => p.remove(), 500)
      }, true)
    })
  })

  const glide = async (x, y, ms = 500) => {
    await page.mouse.move(x, y, { steps: Math.max(8, Math.round(ms / 16)) })
  }
  const center = async sel => {
    const el = await page.$(sel)
    const b = await el.boundingBox()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }
  }
  const glideTo = async (sel, ms = 500, dx = 0, dy = 0) => {
    const { x, y } = await center(sel)
    await glide(x + dx, y + dy, ms)
    return { x: x + dx, y: y + dy }
  }
  const press = async (x, y) => {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await sleep(130)
    await page.mouse.up()
  }
  const clickAt = async (sel, ms = 500, dx = 0, dy = 0) => {
    const p = await glideTo(sel, ms, dx, dy)
    await sleep(120)
    await press(p.x, p.y)
  }
  const scrollToSel = async (sel, block = 'center') => {
    const visible = await page.$eval(sel, el => {
      const r = el.getBoundingClientRect()
      return r.top >= 90 && r.bottom <= innerHeight - 60
    })
    if (visible) return
    await page.$eval(sel, (el, block) => el.scrollIntoView({ behavior: 'smooth', block }), block)
    await sleep(950)
  }

  await page.goto('http://localhost:8657/demo/', { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await sleep(400)

  const recorder = new PuppeteerScreenRecorder(page, {
    fps: 30,
    ffmpeg_Path: '/opt/homebrew/bin/ffmpeg',
    videoFrame: { width: 2560, height: 1440 },
    videoCrf: 17,
    videoCodec: 'libx264',
    videoPreset: 'veryfast',
    aspectRatio: '16:9',
  })
  await recorder.start('raw.mp4')

  // 1. hero: sweep the wordmark so the letters boil
  await sleep(1300)
  const wm = (await (await page.$('#wordmark')).boundingBox())
  await glide(wm.x - 30, wm.y + wm.height * 0.55, 300)
  await glide(wm.x + wm.width + 20, wm.y + wm.height * 0.5, 2600)
  await sleep(500)
  await glide(wm.x + wm.width * 0.5, wm.y + wm.height + 80, 500)
  await sleep(400)

  // 2. seed lab: type a seed, then shuffle
  await scrollToSel('#lab')
  const si = await center('#seedInput')
  await glide(si.x, si.y, 700)
  await sleep(150)
  await press(si.x, si.y)
  await page.$eval('#seedInput', el => el.select())
  await sleep(400)
  await page.keyboard.type('zine-04', { delay: 150 })
  await sleep(900)
  const sb = await center('#shuffleBtn')
  await glide(sb.x, sb.y, 600)
  await sleep(150)
  for (let i = 0; i < 4; i++) {
    await page.mouse.down(); await sleep(70); await page.mouse.up()
    await sleep(230)
  }
  await sleep(1200)

  // 3. fx buttons
  await scrollToSel('#components .demo')
  await clickAt('[data-fx="rip"]', 600); await sleep(1300)

  // 4. checkbox X landings + toggle
  const cbs = await page.$$('.scrap-checkbox .scrap-boxslot')
  const cb = await cbs[0].boundingBox()
  const cbx = cb.x + cb.width * 0.45, cby = cb.y + cb.height * 0.55
  await glide(cbx, cby, 600)
  for (let i = 0; i < 3; i++) { await press(cbx, cby); await sleep(620) }
  const tg = await (await page.$('.scrap-toggle .scrap-boxslot')).boundingBox()
  await glide(tg.x + tg.width * 0.5, tg.y + tg.height * 0.5, 500)
  await press(tg.x + tg.width * 0.5, tg.y + tg.height * 0.5)
  await sleep(700)

  // 5. the paper dropdown
  await scrollToSel('.scrap-select select')
  await clickAt('.scrap-select select', 700)
  await sleep(500)
  const opts = await page.$$('.scrap-option')
  for (const i of [1, 2, 3]) {
    const b = await opts[i].boundingBox()
    await glide(b.x + b.width / 2, b.y + b.height / 2, 320)
    await sleep(230)
  }
  const pick = await opts[1].boundingBox()
  await glide(pick.x + pick.width / 2, pick.y + pick.height / 2, 300)
  await press(pick.x + pick.width / 2, pick.y + pick.height / 2)
  await sleep(700)

  // 6. drag the range
  await scrollToSel('.scrap-range-wrap input')
  const rr = await (await page.$('.scrap-range-wrap input')).boundingBox()
  await glide(rr.x + rr.width * 0.3, rr.y + rr.height / 2, 500)
  await page.mouse.down()
  await glide(rr.x + rr.width * 0.85, rr.y + rr.height / 2, 900)
  await page.mouse.up()
  await sleep(600)

  // 7. overlays: dialog, menu, tooltip
  await scrollToSel('#dlgBtn')
  await clickAt('#dlgBtn', 600)
  await sleep(1000)
  await clickAt('#homeDialog [data-close]', 500)
  await sleep(500)
  await clickAt('[data-menu]', 500)
  await sleep(450)
  const items = await page.$$('#homeMenu .scrap-option')
  for (const i of [0, 1, 2]) {
    const b = await items[i].boundingBox()
    await glide(b.x + b.width / 2, b.y + b.height / 2, 260)
    await sleep(210)
  }
  const mi = await items[1].boundingBox()
  await glide(mi.x + mi.width / 2, mi.y + mi.height / 2, 220)
  await press(mi.x + mi.width / 2, mi.y + mi.height / 2)
  await sleep(400)
  const tipChip = await center('[data-tip]')
  await glide(tipChip.x, tipChip.y, 550)
  await sleep(1200)

  // 8. toasts glue in, one gets dismissed by hand
  const tb = await center('#homeToast')
  await glide(tb.x, tb.y, 500)
  await press(tb.x, tb.y)
  await sleep(550)
  await press(tb.x, tb.y)
  await sleep(900)
  const toastEl = await page.$('.scrap-toast')
  if (toastEl) {
    const b = await toastEl.boundingBox()
    await glide(b.x + b.width / 2, b.y + b.height / 2, 450)
    await press(b.x + b.width / 2, b.y + b.height / 2)
    await sleep(650)
  }

  // 9. into the swatch book
  await scrollToSel('.swatch-link')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    clickAt('.swatch-link a', 600),
  ])
  await page.evaluate(() => document.fonts.ready)
  await sleep(1100)

  // long scroll through the permutations
  await page.evaluate(async () => {
    const total = document.body.scrollHeight - innerHeight
    const dur = 8000
    const t0 = performance.now()
    await new Promise(res => {
      const step = now => {
        const t = Math.min(1, (now - t0) / dur)
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        scrollTo(0, total * e)
        t < 1 ? requestAnimationFrame(step) : res()
      }
      requestAnimationFrame(step)
    })
  })
  await sleep(600)

  // 8. back to the mat, end on the hero + install card
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    clickAt('footer a', 700),
  ])
  await page.evaluate(() => document.fonts.ready)
  await sleep(2600)

  await recorder.stop()
  await browser.close()
  console.log('done')
}

main().catch(e => { console.error(e); process.exit(1) })
