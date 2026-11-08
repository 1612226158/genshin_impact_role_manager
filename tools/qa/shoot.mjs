#!/usr/bin/env node
/**
 * 批量截图：自动起停 vite，逐路由截图。
 * 用法：node shoot.mjs <config.json> [width] [height]
 * config: [{ name, path, wait?, script? }, ...]
 *   - script 为页内 JS 字符串（如点击页签），注意页内自轮询等元素
 */
import { mkdirSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { BASE, OUT_DIR, launchBrowser, openRoute, sleep, startVite, waitAssets, waitServer } from './lib/common.mjs'

const arg = process.argv[2] || '[]'
const width = Number(process.argv[3] || 1600)
const height = Number(process.argv[4] || 1050)
const shots = JSON.parse(arg.startsWith('[') ? arg : readFileSync(arg, 'utf-8'))
mkdirSync(OUT_DIR, { recursive: true })

const server = startVite()
let failed = 0

try {
  if (!(await waitServer(BASE))) {
    console.log('server not ready')
    process.exit(2)
  }
  const browser = await launchBrowser({ width, height })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  for (const s of shots) {
    try {
      await openRoute(page, BASE, s.path)
      await waitAssets(page)
      if (s.script) await page.evaluate(s.script)
      await sleep(s.wait ?? 500)
      const stat = await page.evaluate(() => ({
        imgs: document.images.length,
        broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
        h: document.body.scrollHeight,
      }))
      await page.screenshot({ path: `${OUT_DIR}/${s.name}.png`, fullPage: !!s.full })
      console.log(`shot ${s.name}`, JSON.stringify(stat))
    } catch (err) {
      failed += 1
      console.log(`FAIL ${s.name}: ${err.message}`)
    }
  }

  if (errors.length) {
    console.log('--- page errors ---')
    for (const e of [...new Set(errors)].slice(0, 12)) console.log(e)
  }
  await browser.close()
} finally {
  server.kill()
  await sleep(300)
}
process.exit(failed ? 1 : 0)
