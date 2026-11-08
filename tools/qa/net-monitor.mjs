#!/usr/bin/env node
/**
 * 网络空闲监视：打开页面后静置 30 秒，记录期间发出的全部请求（排除首屏静态资源）。
 * 用途：判断 localhost 页面是否存在周期性请求（favicon 404 循环、HMR 轮询等）。
 * 用法：node net-monitor.mjs [静置秒数=30] [路径=/?flat=1&nostar=1#/]
 */
import { BASE, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'

const idleSec = Number(process.argv[2] || 30)
const path = process.argv[3] || '/?flat=1&nostar=1#/'
const server = startVite()

try {
  if (!(await waitServer(BASE))) throw new Error('server not ready')
  const browser = await launchBrowser()
  const page = await browser.newPage()

  await page.goto(`${BASE}/?_n=${Date.now()}${path}`, { waitUntil: 'load', timeout: 45000 })
  await sleep(2000)

  const seen = new Map()
  page.on('request', (r) => {
    const u = r.url()
    seen.set(u, (seen.get(u) || 0) + 1)
  })
  page.on('websocket', (ws) => {
    console.log('WS opened:', ws.url())
    ws.on('close', () => console.log('WS closed:', ws.url()))
  })

  console.log(`--- idle ${idleSec}s, watching requests ---`)
  await sleep(idleSec * 1000)

  console.log('--- 静置期间的请求统计 ---')
  for (const [u, n] of seen) console.log(`${String(n).padStart(4)}  ${u.slice(0, 130)}`)
  if (!seen.size) console.log('（无任何请求）')

  await browser.close()
} finally {
  server.kill()
  await sleep(300)
}
