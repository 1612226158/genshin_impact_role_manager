#!/usr/bin/env node
/** 诊断：各页面滚动后 TopBar 是否保持钉在顶部 */
import { BASE, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'

const server = startVite()
let failed = 0
const check = (name, cond) => {
  console.log(cond ? `  ✓ ${name}` : `  ✗ ${name}`)
  if (!cond) failed += 1
}

try {
  if (!(await waitServer(BASE))) throw new Error('server not ready')
  const browser = await launchBrowser()
  const page = await browser.newPage()

  for (const path of ['/', '/c/1055', '/birthday']) {
    await openRoute(page, BASE, path)
    const before = await page.evaluate(() => {
      const el = document.querySelector('.topbar')
      return el ? { top: el.getBoundingClientRect().top, sticky: getComputedStyle(el).position } : null
    })
    await page.evaluate(() => window.scrollTo(0, 800))
    await sleep(300)
    const after = await page.evaluate(() => ({
      top: document.querySelector('.topbar')?.getBoundingClientRect().top,
      scrollY: window.scrollY,
    }))
    console.log(
      `path=${path} sticky=${before?.sticky} before.top=${before?.top?.toFixed(1)} after(scrollY=${after.scrollY}) top=${after.top?.toFixed(1)}`
    )
    check(`${path} 滚动 ${after.scrollY}px 后顶栏仍在视口顶部`, after.scrollY === 0 || Math.abs(after.top) < 1)
  }

  await browser.close()
  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部正常（sticky 生效）')
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
