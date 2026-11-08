#!/usr/bin/env node
/** 断言：属性 ↔ 背景故事 切换时海报平滑缩放（存在中间态，非瞬切） */
import { BASE, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'

const server = startVite()
let failed = 0
const check = (name, cond, extra = '') => {
  console.log(cond ? `  ✓ ${name}${extra ? ' ' + extra : ''}` : `  ✗ ${name}${extra ? ' ' + extra : ''}`)
  if (!cond) failed += 1
}
const imgWidth = (page) =>
  page.evaluate(() => {
    const img = document.querySelector('.front img')
    return img ? +img.getBoundingClientRect().width.toFixed(1) : null
  })

try {
  if (!(await waitServer(BASE))) throw new Error('server not ready')
  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  await openRoute(page, BASE, '/c/1055')
  await sleep(900)
  const statsW = await imgWidth(page)
  console.log(`  属性页海报宽 ${statsW}px`)

  console.log('1) 属性 → 背景故事（缩小）')
  await page.evaluate(() => [...document.querySelectorAll('.tabs button')][1]?.click())
  await sleep(150)
  const midDown = await imgWidth(page)
  await sleep(800)
  const storyW = await imgWidth(page)
  console.log(`  中间态 ${midDown}px → 终态 ${storyW}px`)
  check('切到背景故事后海报变小', storyW < statsW - 60, `${statsW} → ${storyW}`)
  check(
    '缩小过程存在缓动中间态',
    midDown > storyW + 5 && midDown < statsW - 5,
    `mid=${midDown}`
  )

  console.log('2) 背景故事 → 属性（放大）')
  await page.evaluate(() => [...document.querySelectorAll('.tabs button')][0]?.click())
  await sleep(150)
  const midUp = await imgWidth(page)
  await sleep(800)
  const backW = await imgWidth(page)
  console.log(`  中间态 ${midUp}px → 终态 ${backW}px`)
  check('切回属性后海报恢复', Math.abs(backW - statsW) <= 3, `${statsW} vs ${backW}`)
  check('放大过程存在缓动中间态', midUp > storyW + 5 && midUp < backW - 5, `mid=${midUp}`)

  console.log('3) 关闭动效时直接落位')
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('gsr.settings.v1') || '{}')
    s.motion = 'off'
    localStorage.setItem('gsr.settings.v1', JSON.stringify(s))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(1200)
  const offStart = await imgWidth(page)
  await page.evaluate(() => [...document.querySelectorAll('.tabs button')][1]?.click())
  await sleep(120)
  const offMid = await imgWidth(page)
  await sleep(600)
  const offEnd = await imgWidth(page)
  console.log(`  关闭动效: ${offStart} → 120ms 后 ${offMid} → 终态 ${offEnd}`)
  check('关闭动效后 120ms 内即达终态', Math.abs(offMid - offEnd) < 3)
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('gsr.settings.v1') || '{}')
    delete s.motion
    localStorage.setItem('gsr.settings.v1', JSON.stringify(s))
  })

  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
