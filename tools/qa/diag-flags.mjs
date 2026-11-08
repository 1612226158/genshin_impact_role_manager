#!/usr/bin/env node
/** 断言诊断开关生效：?flat=1 下 backdrop-filter 为 none；?nostar=1 下星空 canvas 隐藏 */
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

  const page1 = await browser.newPage()
  await openRoute(page1, BASE, '/?flat=1#/')
  const bf = await page1.evaluate(
    () => getComputedStyle(document.querySelector('.gs-panel')).backdropFilter
  )
  check(`?flat=1 下 .gs-panel backdrop-filter = "${bf}"`, bf === 'none')
  await page1.close()

  const page2 = await browser.newPage()
  await openRoute(page2, BASE, '/?flat=1&nostar=1#/')
  const hidden = await page2.evaluate(() => {
    const cv = document.querySelector('canvas.bg-stars')
    return cv ? getComputedStyle(cv).display === 'none' : false
  })
  check('?nostar=1 下星空 canvas display=none', hidden)
  await page2.close()

  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
