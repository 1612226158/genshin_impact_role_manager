#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { BASE, OUT_DIR, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'
const server = startVite()
let browser, failed = 0
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
try {
  if (!await waitServer(BASE)) throw new Error('server not ready')
  browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', e => { console.log(e.message); failed++ })
  await openRoute(page, BASE, '/album')
  await page.evaluate(() => {
    const items = ['#e32b40', '#3268e0', '#32c57a', '#ddbd52'].map((color, i) => {
      const c = document.createElement('canvas'); c.width = 120; c.height = 600
      const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 120, 600)
      return { aid: `fixture-${i}`, title: `图片${i}`, kind: 'official', ref: c.toDataURL() }
    })
    localStorage.setItem('gsr.album.v1', JSON.stringify(items))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.tile img').length === 4 && [...document.querySelectorAll('.tile img')].every(i => i.complete))
  const choose = async (label, text) => {
    await page.click(`[role="combobox"][aria-label="${label}"]`)
    await page.evaluate(text => [...document.querySelectorAll('[role="option"]')].find(o => o.textContent.trim().replace('✓', '').trim() === text).click(), text)
    await sleep(180)
  }
  check('no native select in album controls', await page.$$eval('select', els => els.length === 0))
  check('desktop gallery distributes four cards horizontally', await page.$$eval('.tile', els => new Set(els.map(e => Math.round(e.getBoundingClientRect().left))).size === 4))
  check('portrait preview has a bottom fade', await page.$eval('.tile .faded', el => getComputedStyle(el).maskImage.includes('linear-gradient')))
  const croppedHeight = await page.$eval('.tile .art-image', el => el.getBoundingClientRect().height)
  await choose('画面', '完整原图')
  const fullHeight = await page.$eval('.tile .art-image', el => el.getBoundingClientRect().height)
  check('portrait preview crops precisely the upper two thirds', Math.abs(croppedHeight / fullHeight - 2 / 3) < .01)
  await choose('画面', '人物预览 · 上 2/3 渐隐')
  await page.focus('[role="combobox"][aria-label="图片显示"]')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  check('custom selector supports keyboard selection', await page.$eval('[aria-label="图片显示"]', el => el.textContent.includes('铺满裁切')))
  await choose('图片显示', '完整显示')

  async function selectTwo() {
    await page.evaluate(() => {
      const clear = [...document.querySelectorAll('button')].find(b => b.textContent.includes('清空选择'))
      clear?.click()
    })
    await sleep(50)
    await page.evaluate(() => [...document.querySelectorAll('.tile')].slice(0, 2).forEach(e => e.click()))
    await sleep(400)
  }
  async function drag(from, to, pointer = 'mouse') {
    await page.$$eval('.collage-slot', els => Promise.all(els.flatMap(el => el.getAnimations().map(a => a.finished.catch(() => {})))))
    await page.$eval('.collage-editor', el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    const boxes = await page.$$eval('.collage-slot', els => els.map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }))
    if (pointer === 'mouse') {
      await page.mouse.move(boxes[from].x, boxes[from].y)
      await page.mouse.down()
      await page.mouse.move(boxes[to].x, boxes[to].y, { steps: 12 })
      await sleep(70)
      const animated = await page.$$eval('.collage-slot', els => els.some(e => e.getAnimations().length > 0))
      await page.mouse.up()
      await sleep(400)
      return animated
    }
    const cdp = await page.createCDPSession()
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [boxes[from]] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [boxes[to]] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
    await sleep(400)
  }
  const pixel = (index) => page.evaluate(async index => {
    const { collageLayout } = await import('/src/utils/collage.js')
    const cv = document.querySelector('canvas.cv')
    const name = document.querySelector('[aria-label="模板"]').textContent
    const key = name.includes('四宫') ? 'grid2' : name.includes('九宫') ? 'grid3' : name.includes('三连') ? 'strip3' : 'hero'
    const cell = collageLayout(key).cells[index]
    return [...cv.getContext('2d').getImageData(Math.round(cell[0] + cell[2] / 2), Math.round(cell[1] + cell[3] / 2), 1, 1).data]
  }, index)
  await selectTwo()
  check('natural template follows the cropped image ratio', await page.$eval('.collage-slot', el => Math.abs(el.getBoundingClientRect().width / el.getBoundingClientRect().height - .3) < .01))
  check('PNG applies the gradient to the cropped image', await page.$eval('canvas.cv', cv => {
    const ctx = cv.getContext('2d')
    const a = ctx.getImageData(180, 100, 1, 1).data
    const b = ctx.getImageData(180, 1190, 1, 1).data
    return a[0] > 200 && b[0] < 50
  }))
  for (const [label, last] of [['四宫格 2×2', 3], ['九宫格 3×3', 8], ['长条三连 1×3', 2], ['主图 + 四小图', 4]]) {
    await choose('模板', label)
    await selectTwo()
    const animation = await drag(0, last)
    const id = await page.$$eval('.collage-slot', (els, i) => els[i].dataset.aid, last)
    check(`${label}: can drag to an empty final cell`, id === 'fixture-0')
    check(`${label}: PNG preserves the empty-cell placement`, (await pixel(last))[0] > 200)
    if (last === 3) check('slot movement is animated', animation)
  }
  await choose('模板', '四宫格 2×2')
  await selectTwo()
  await drag(0, 1)
  check('occupied cells swap without duplication', await page.$$eval('.collage-slot', els => els[0].dataset.aid === 'fixture-1' && els[1].dataset.aid === 'fixture-0'))
  await page.focus('.collage-slot[data-aid="fixture-0"]')
  await page.keyboard.down('Alt'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Alt')
  await sleep(400)
  check('keyboard can move a picture into an empty cell', await page.$$eval('.collage-slot', els => els[2].dataset.aid === 'fixture-0'))
  await page.evaluate(() => document.documentElement.classList.add('no-motion'))
  await drag(2, 3)
  check('motion-off skips the drop animation', await page.$$eval('.drag-ghost', els => els.length === 0))
  await page.evaluate(() => document.documentElement.classList.remove('no-motion'))
  await page.click('.ops button:nth-child(2)')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gsr.album.v1') || '[]').some(i => i.title === '拼图作品'))
  const saved = await page.evaluate(async () => {
    const { getBlob } = await import('/src/utils/idb.js')
    const item = JSON.parse(localStorage.getItem('gsr.album.v1')).find(i => i.title === '拼图作品')
    const image = await createImageBitmap(await getBlob(item.mediaId))
    const c = document.createElement('canvas'); c.width = image.width; c.height = image.height
    const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0)
    return { color: [...ctx.getImageData(902, 902, 1, 1).data], url: c.toDataURL() }
  })
  check('actual saved PNG keeps the picture in the bottom-right cell', saved.color[0] > 200)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(`${OUT_DIR}/album-editor-export.png`, Buffer.from(saved.url.split(',')[1], 'base64'))
  // Real posters for visual review.
  await page.evaluate(() => localStorage.setItem('gsr.album.v1', JSON.stringify([1055, 1056, 1057, 1058].map((id, i) => ({ aid: `real-${id}`, kind: 'official', title: ['砂糖', '七七', '莫娜', '刻晴'][i], ref: `assets/paintings/${id}_${['砂糖', '七七', '莫娜', '刻晴'][i]}.webp` })))))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.tile img').length === 4 && [...document.querySelectorAll('.tile img')].every(i => i.complete))
  await page.evaluate(() => document.querySelectorAll('.tile').forEach(e => e.click()))
  await sleep(500)
  await page.screenshot({ path: `${OUT_DIR}/album-editor-desktop.png`, fullPage: true })
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await sleep(400)
  // Changing mobile emulation reloads the page; restore this test's transient selection.
  await page.waitForFunction(() => document.querySelectorAll('.tile').length === 4)
  await page.evaluate(() => document.querySelectorAll('.tile').forEach(e => e.click()))
  await sleep(400)
  check('mobile gallery remains two columns', await page.$$eval('.tile', els => new Set(els.map(e => Math.round(e.getBoundingClientRect().left))).size === 2))
  check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await choose('模板', '四宫格 2×2')
  await drag(0, 3, 'touch')
  check('touch drag works on mobile', await page.$$eval('.collage-slot', els => els[3].dataset.aid === 'real-1055'))
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: `${OUT_DIR}/album-editor-mobile.png`, fullPage: true })
} finally { await browser?.close(); server.kill(); await sleep(300) }
console.log(failed ? `${failed} failures` : 'All album-editor checks passed')
process.exitCode = failed ? 1 : 0
