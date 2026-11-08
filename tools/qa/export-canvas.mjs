#!/usr/bin/env node
/**
 * 导出生日卡 / 拼图的真实成品 PNG（页面 canvas.toDataURL）。
 * 用法：
 *   node export-canvas.mjs card     -> 生日卡 1080x1350 -> OUT_DIR/card_full.png
 *   node export-canvas.mjs collage  -> 2x2 拼图（注入 4 张官方立绘） -> OUT_DIR/collage_full.png
 */
import { writeFileSync } from 'node:fs'
import { BASE, OUT_DIR, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'

const mode = process.argv[2] || 'card'
const server = startVite()

const ALBUM_ITEMS = [
  { aid: 'a_t1', kind: 'official', ref: 'assets/paintings/1055_砂糖.webp', title: '砂糖' },
  { aid: 'a_t2', kind: 'official', ref: 'assets/paintings/1056_七七.webp', title: '七七' },
  { aid: 'a_t3', kind: 'official', ref: 'assets/paintings/1057_莫娜.webp', title: '莫娜' },
  { aid: 'a_t4', kind: 'official', ref: 'assets/paintings/1058_刻晴.webp', title: '刻晴' },
]

try {
  if (!(await waitServer(BASE))) throw new Error('server not ready')
  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  if (mode === 'card') {
    await openRoute(page, BASE, '/birthday')
    await page.waitForFunction(() => Boolean(document.querySelector('canvas.cv')), { timeout: 20000 })
    await sleep(2500)
  } else {
    await openRoute(page, BASE, '/album')
    await page.evaluate((items) => localStorage.setItem('gsr.album.v1', JSON.stringify(items)), ALBUM_ITEMS)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await sleep(2000)
    await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('.tile')]
      for (const t of tiles.slice(0, 4)) t.click()
    })
    await sleep(2000)
  }

  const data = await page.evaluate(() => {
    const cv = document.querySelector('canvas.cv')
    return cv ? { url: cv.toDataURL('image/png'), w: cv.width, h: cv.height } : null
  })
  if (data?.url) {
    const out = `${OUT_DIR}/${mode}_full.png`
    writeFileSync(out, Buffer.from(data.url.split(',')[1], 'base64'))
    console.log(`exported ${out} ${data.w}x${data.h}`)
  } else {
    console.log('no canvas.cv found')
  }
  await browser.close()
} finally {
  server.kill()
  await sleep(300)
}
