#!/usr/bin/env node
/** Detect lost image edges in thumbnails, collage templates and the saved PNG. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { BASE, OUT_DIR, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'

const server = startVite()
let browser, failed = 0
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
try {
  if (!await waitServer(BASE)) throw new Error('server not ready')
  browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', e => { console.log(e.message); failed++ })
  await openRoute(page, BASE, '/album')
  await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 100; c.height = 500
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 100, 500)
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 100, 60)
    ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 440, 100, 60)
    localStorage.setItem('gsr.album.v1', JSON.stringify([{ aid: 'tall', kind: 'official', ref: c.toDataURL(), title: '竖长图边缘测试' }]))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelector('.tile img')?.complete)
  const choose = async (label, text) => {
    await page.click(`[role="combobox"][aria-label="${label}"]`)
    await page.evaluate(text => [...document.querySelectorAll('[role="option"]')].find(o => o.textContent.replace('✓', '').trim() === text).click(), text)
    await sleep(200)
  }
  await choose('画面', '完整原图')
  await choose('模板', '四宫格 2×2')
  await page.click('.tile')
  await sleep(200)
  check('thumbnail preserves the full image', await page.$eval('.tile img', el => Math.abs(el.getBoundingClientRect().width / el.getBoundingClientRect().height - el.naturalWidth / el.naturalHeight) < .01))
  check('default collage mode preserves full image', await page.$eval('[aria-label="图片显示"]', el => el.textContent.includes('完整显示')))
  const edges = () => page.evaluate(() => {
    const c = document.querySelector('canvas.cv')
    const ctx = c.getContext('2d')
    const label = document.querySelector('[aria-label="模板"]').textContent
    const template = label.includes('四宫') ? 'grid2' : label.includes('九宫') ? 'grid3' : label.includes('三连') ? 'strip3' : 'hero'
    const [w, h] = template === 'grid2' ? [595, 595] : template === 'grid3' ? [1180 / 3, 1180 / 3] : template === 'strip3' ? [1080, 1420 / 3] : [990, 1000]
    const pixel = (x, y) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data]
    return { top: pixel(w / 2, 15), bottom: pixel(w / 2, h - 15), side: pixel(12, h / 2) }
  })
  const full = p => p.top[0] > 240 && p.top[1] < 10 && p.bottom[2] > 240 && p.bottom[0] < 10
  for (const template of ['grid2', 'grid3', 'strip3', 'hero']) {
    await choose('模板', { grid2: '四宫格 2×2', grid3: '九宫格 3×3', strip3: '长条三连 1×3', hero: '主图 + 四小图' }[template])
    await sleep(150)
    check(`${template} retains both ends of tall image`, full(await edges()))
  }
  await choose('模板', '四宫格 2×2')
  await sleep(150)
  check('contain uses background rather than stretching', (await edges()).side.slice(0, 3).join(',') === '11,27,40')
  await choose('图片显示', '铺满裁切')
  await sleep(150)
  check('optional cover mode still fills the cell', !full(await edges()))
  await choose('图片显示', '完整显示')
  await sleep(150)
  check('switching back restores the complete image', full(await edges()))
  await page.evaluate(() => [...document.querySelectorAll('.ops button')].find(b => b.textContent.includes('存入相册')).click())
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gsr.album.v1') || '[]').some(i => i.title === '拼图作品'))
  const saved = await page.evaluate(async () => {
    const { getBlob } = await import('/src/utils/idb.js')
    const item = JSON.parse(localStorage.getItem('gsr.album.v1')).find(i => i.title === '拼图作品')
    const blob = await getBlob(item.mediaId)
    const img = await createImageBitmap(blob)
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data]
    return { w: img.width, h: img.height, top: pixel(297, 15), bottom: pixel(297, 580), png: c.toDataURL() }
  })
  check('saved PNG retains both image ends at 1200×1200', saved.w === 1200 && saved.h === 1200 && full(saved))
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(`${OUT_DIR}/album-fit-saved.png`, Buffer.from(saved.png.split(',')[1], 'base64'))
  // Visual check with real character posters, independent of the synthetic edge markers.
  await page.evaluate(() => {
    localStorage.setItem('gsr.album.v1', JSON.stringify([
      { aid: 'a1', kind: 'official', ref: 'assets/paintings/1055_砂糖.webp', title: '砂糖' },
      { aid: 'a2', kind: 'official', ref: 'assets/paintings/1056_七七.webp', title: '七七' },
    ]))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('.tile img').length === 2 && [...document.querySelectorAll('.tile img')].every(i => i.complete))
  await page.evaluate(() => document.querySelectorAll('.tile').forEach(el => el.click()))
  await sleep(400)
  await page.screenshot({ path: `${OUT_DIR}/album-fit-desktop.png`, fullPage: true })
  await page.setViewport({ width: 390, height: 844 })
  await sleep(150)
  check('mobile album has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: `${OUT_DIR}/album-fit-mobile.png`, fullPage: true })
} finally {
  await browser?.close()
  server.kill()
  await sleep(300)
}
console.log(failed ? `${failed} failures` : 'All album-fit checks passed')
process.exitCode = failed ? 1 : 0
