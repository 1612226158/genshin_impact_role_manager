#!/usr/bin/env node
/**
 * 详情页性能取样：传输量构成 + 关键时间点 + LCP
 * 用法：node perf-detail.mjs [url]
 */
import { launchBrowser, sleep } from './lib/common.mjs'

const url = process.argv[2] || 'http://127.0.0.1:5319/c/509103'

const browser = await launchBrowser()
const page = await browser.newPage()
await page.setCacheEnabled(false)
const bytes = { js: 0, css: 0, img: 0, json: 0, font: 0, other: 0, count: 0 }
const heaviest = []

page.on('response', async (res) => {
  try {
    const type = (res.request().resourceType() || 'other').toLowerCase()
    const len = Number(res.headers()['content-length'] || 0)
    const key = ['script'].includes(type) ? 'js' : ['stylesheet'].includes(type) ? 'css' : ['image'].includes(type) ? 'img' : ['xhr', 'fetch'].includes(type) ? 'json' : ['font'].includes(type) ? 'font' : 'other'
    bytes[key] += len
    bytes.count += 1
    if (len > 20000) heaviest.push([len, type, res.url()])
  } catch {
    /* ignore */
  }
})

const t0 = Date.now()
await page.goto(url, { waitUntil: 'load', timeout: 90000 })
const loadMs = Date.now() - t0

const lcp = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let value = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) value = e.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      setTimeout(() => resolve(Math.round(value)), 1200)
    })
)

const nav = await page.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0] || {}
  const paints = performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)])
  return {
    domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0),
    transferSize: n.transferSize,
    encodedBodySize: n.encodedBodySize,
    paints,
  }
})

const total = Object.entries(bytes).filter(([k]) => k !== 'count').reduce((s, [, v]) => s + v, 0)
console.log('URL:', url)
console.log(`load 事件耗时: ${loadMs}ms   LCP: ${lcp}ms   DCL: ${nav.domContentLoaded}ms`)
console.log('导航文档:', nav.paints.map(([n, t]) => `${n}=${t}ms`).join(' '))
console.log('\n传输量构成（content-length 之和）：')
for (const [k, v] of Object.entries(bytes)) {
  if (k === 'count') continue
  if (!v) continue
  console.log(`  ${k.padEnd(6)} ${(v / 1024).toFixed(0).padStart(6)} KB`)
}
console.log(`  ${'合计'.padEnd(5)} ${(total / 1024).toFixed(0).padStart(6)} KB，请求 ${bytes.count} 个`)
console.log('\n最重的资源：')
heaviest
  .sort((a, b) => b[0] - a[0])
  .slice(0, 6)
  .forEach(([len, type, u]) => console.log(`  ${(len / 1024).toFixed(0).padStart(6)} KB  ${type.padEnd(8)} ${u.split('/').pop()}`))

await browser.close()
