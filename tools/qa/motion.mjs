#!/usr/bin/env node
/**
 * 动画体系断言（6 项）：验证 prefers-reduced-motion: reduce 不再压制应用动效、
 * 页签滑动过渡存在、应用内动画开关（设置→视觉）可用。
 * 用法：node motion.mjs
 */
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
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  console.log('1) 模拟 Windows 辅助功能关闭动画（prefers-reduced-motion: reduce）')
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await openRoute(page, BASE, '/c/1055')
  await sleep(800)

  const bodyTrans = await page.evaluate(
    () => getComputedStyle(document.querySelector('.body')).transition
  )
  check('布局列宽过渡仍在（grid-template-columns 动画不受系统设置影响）', /grid-template-columns/.test(bodyTrans))

  const pillDur = await page.evaluate(() => {
    const el = document.querySelector('.gs-pill') || document.querySelector('.gs-btn')
    return el ? getComputedStyle(el).transitionDuration : ''
  })
  check('按钮过渡时长保持 0.18s 级别（非 0.01ms）', /0\.1[0-9]?s|0\.2s|0\.18s/.test(pillDur))

  console.log('2) 页签切换为滑动过渡')
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.tabs button')][1]
    if (b) b.click()
  })
  await sleep(120)
  const mid = await page.evaluate(() => {
    const el = document.querySelector('.tab-body')
    return el ? getComputedStyle(el).transform : ''
  })
  check('切换瞬间 tab-body 处于位移中间态（matrix ≠ none）', mid && mid !== 'none')

  const wideCols = await page.evaluate(
    () => getComputedStyle(document.querySelector('.body')).gridTemplateColumns
  )
  check('故事页签下布局为四列（含收窄立绘列）', wideCols.trim().split(' ').length === 4)

  console.log('3) 应用内动画开关')
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('gsr.settings.v1') || '{}')
    s.motion = 'off'
    localStorage.setItem('gsr.settings.v1', JSON.stringify(s))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(1000)
  check(
    '设置 motion=off 后 <html> 挂 no-motion 类',
    await page.evaluate(() => document.documentElement.classList.contains('no-motion'))
  )
  const offDur = await page.evaluate(() => {
    const el = document.querySelector('.gs-btn')
    return el ? getComputedStyle(el).transitionDuration : ''
  })
  check('关闭后过渡时长压到 0.01ms 级别', /^0\.0000?1s|0s|1e-05s/.test(offDur))

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
