#!/usr/bin/env node
/** 第五轮 13/14 项断言：工具栏等高、圆形浅色角标、筛选排序过渡、相册角标对齐 */
import { BASE, OUT_DIR, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'
import { mkdirSync } from 'node:fs'

mkdirSync(OUT_DIR, { recursive: true })
const server = startVite()
let failed = 0
const check = (name, cond, extra = '') => {
  console.log(cond ? `  ✓ ${name}${extra ? ' ' + extra : ''}` : `  ✗ ${name}${extra ? ' ' + extra : ''}`)
  if (!cond) failed += 1
}

try {
  if (!(await waitServer(BASE))) throw new Error('server not ready')
  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  console.log('1) 角色库工具栏控件等高')
  await openRoute(page, BASE, '/')
  await sleep(700)
  const bar = await page.evaluate(() => {
    const box = document.querySelector('.head-extra')
    return [...box.children].map((el) => {
      const r = el.getBoundingClientRect()
      return { cls: el.className.split(' ')[0], text: (el.innerText || '').slice(0, 6), h: +r.height.toFixed(1) }
    })
  })
  console.log('   ', JSON.stringify(bar))
  const heights = bar.map((b) => b.h)
  const maxDiff = Math.max(...heights) - Math.min(...heights)
  check('工具栏各控件高度差 ≤ 1px', maxDiff <= 1, `diff=${maxDiff.toFixed(1)}`)

  console.log('2) 卡片圆形浅色角标')
  const badge = await page.evaluate(() => {
    const el = document.querySelector('.cell .badge')
    if (!el) return null
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const m = s.backgroundColor.match(/[\d.]+/g).map(Number)
    const lum = (m[0] + m[1] + m[2]) / 3
    return { radius: s.borderRadius, bg: s.backgroundColor, lum, size: Math.round(r.width) }
  })
  console.log('   ', JSON.stringify(badge))
  check('角标为圆形', Boolean(badge) && badge.radius.includes('50%'))
  check('角标为浅色（亮度 > 180）', Boolean(badge) && badge.lum > 180, `lum=${badge?.lum?.toFixed(0)}`)
  check('角标 28px', Boolean(badge) && badge.size === 28)

  console.log('3) 筛选/排序平滑过渡')
  const moveRule = await page.evaluate(
    () =>
      [...document.styleSheets].some((s) => {
        try {
          return [...s.cssRules].some((r) => (r.selectorText || '').startsWith('.cards-move'))
        } catch {
          return false
        }
      })
  )
  check('存在 .cards-move 位移过渡规则', moveRule)
  await page.evaluate(() => document.querySelector('.page .dir')?.click())
  await sleep(90)
  const moving = await page.evaluate(() => {
    const cell = document.querySelector('.cell')
    const t = cell ? getComputedStyle(cell).transform : 'none'
    return t && t !== 'none'
  })
  check('排序切换瞬间卡片处于位移动画中', moving)
  await sleep(600)

  console.log('4) 相册角标对齐')
  // 新浏览器配置没有收藏数据：走真实流程（详情页「加入相册」）造两条收藏
  for (const id of ['1055', '1056']) {
    await openRoute(page, BASE, `/c/${id}`)
    await sleep(600)
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.actions button')].find((b) => b.textContent.includes('加入相册'))
      btn?.click()
    })
    await sleep(500)
  }
  await openRoute(page, BASE, '/album')
  await sleep(1400)
  // 选中一张图，`序号` 角标才会出现
  await page.evaluate(() => document.querySelector('.tile')?.click())
  await sleep(450)
  const tiles = await page.evaluate(() => {
    const t = document.querySelector('.tile')
    if (!t) return { error: 'no .tile' }
    const o = t.querySelector('.order')
    const k = t.querySelector('.kind')
    if (!o || !k) return { error: `missing ${!o ? '.order ' : ''}${!k ? '.kind' : ''}`, html: t.innerHTML.slice(0, 120) }
    const or = o.getBoundingClientRect()
    const kr = k.getBoundingClientRect()
    return {
      orderTop: +or.top.toFixed(1),
      kindTop: +kr.top.toFixed(1),
      orderH: +or.height.toFixed(1),
      kindH: +kr.height.toFixed(1),
    }
  })
  console.log('   ', JSON.stringify(tiles))
  check('左右角标顶线一致（Δ ≤ 1px）', !tiles.error && Math.abs(tiles.orderTop - tiles.kindTop) <= 1)
  check('左右角标同高（Δ ≤ 1px）', !tiles.error && Math.abs(tiles.orderH - tiles.kindH) <= 1)

  await page.screenshot({ path: `${OUT_DIR}/round5-album.png` })
  await openRoute(page, BASE, '/')
  await sleep(700)
  await page.screenshot({ path: `${OUT_DIR}/round5-library.png` })

  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
