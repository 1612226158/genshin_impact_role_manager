#!/usr/bin/env node
/** 断言：月历居中/头像在格内/日期数字/页签居中/横向轮播一次一月/平滑 */
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

  await openRoute(page, BASE, '/birthday')
  await sleep(1000)

  console.log('1) 日历左右边距对称（居中）')
  const inset = await page.evaluate(() => {
    const grid = document.querySelector('.cal-slide .cal-grid')
    const slide = grid.closest('.cal-slide')
    const g = grid.getBoundingClientRect()
    const s = slide.getBoundingClientRect()
    return { left: +(g.left - s.left).toFixed(1), right: +(s.right - g.right).toFixed(1) }
  })
  console.log('   ', JSON.stringify(inset))
  check('左右留白对称（Δ ≤ 2px）', Math.abs(inset.left - inset.right) <= 2, `Δ=${(inset.left - inset.right).toFixed(1)}`)

  console.log('2) 头像在格内、日期数字加粗放大')
  const cell = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.cal-slide:first-child .cell')].find((x) => x.querySelector('.face'))
    const cr = c.getBoundingClientRect()
    const fr = c.querySelector('.face').getBoundingClientRect()
    const d = c.querySelector('.dnum')
    const cs = getComputedStyle(d)
    return {
      inside: fr.top >= cr.top - 0.5 && fr.bottom <= cr.bottom + 0.5 && fr.left >= cr.left - 0.5 && fr.right <= cr.right + 0.5,
      faceH: +fr.height.toFixed(1),
      cellH: +cr.height.toFixed(1),
      font: cs.fontSize,
      weight: cs.fontWeight,
    }
  })
  console.log('   ', JSON.stringify(cell))
  check('头像完全位于格子内', cell.inside)
  check('头像高度不超过 52px', cell.faceH <= 52.5, `${cell.faceH}`)
  check('日期字号 ≥ 15px', parseFloat(cell.font) >= 15, cell.font)
  check('日期字重 ≥ 700', Number(cell.weight) >= 700, cell.weight)

  console.log('3) 月份页签整体居中且间距一致')
  const tabs = await page.evaluate(() => {
    const row = document.querySelector('.mtabs')
    const rr = row.getBoundingClientRect()
    const cs = getComputedStyle(row)
    const items = [...row.children].map((b) => b.getBoundingClientRect())
    const gaps = []
    for (let i = 1; i < items.length; i++) gaps.push(+(items[i].left - items[i - 1].right).toFixed(1))
    const firstRow = items.filter((r) => Math.abs(r.top - items[0].top) < 1)
    return {
      contentLeft: +(firstRow[0].left - rr.left).toFixed(1),
      contentRight: +(rr.right - firstRow[firstRow.length - 1].right).toFixed(1),
      gap: +(gaps.find((g) => g > 0) || 0).toFixed(1),
      rowCenter: +((firstRow[0].left + firstRow[firstRow.length - 1].right) / 2).toFixed(1),
      panelCenter: +((rr.left + rr.right) / 2).toFixed(1),
      justify: cs.justifyContent,
    }
  })
  console.log('   ', JSON.stringify(tabs))
  check('页签行居中对齐', tabs.justify === 'center' && Math.abs(tabs.rowCenter - tabs.panelCenter) <= 2, `Δ=${(tabs.rowCenter - tabs.panelCenter).toFixed(1)}`)
  check(
    '首尾留白与两两间距一致（Δ ≤ 1px）',
    Math.abs(tabs.contentLeft - tabs.gap) <= 1 && Math.abs(tabs.contentRight - tabs.gap) <= 1,
    `left=${tabs.contentLeft} right=${tabs.contentRight} gap=${tabs.gap}`
  )

  console.log('4) 横向轮播：一次手势切一个月')
  const state = () =>
    page.evaluate(() => {
      const track = document.querySelector('.cal-track')
      const t = getComputedStyle(track).transform
      const x = t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41
      return {
        x: +x.toFixed(1),
        w: document.querySelector('.cal-carousel').clientWidth,
        overflow: getComputedStyle(document.querySelector('.cal-carousel')).overflow,
        transition: getComputedStyle(track).transitionDuration,
        month: document.querySelector('.mtab.on')?.textContent.trim(),
      }
    })
  const s0 = await state()
  console.log('   ', JSON.stringify(s0))
  check('轮播视口裁剪内容（overflow hidden）', s0.overflow === 'hidden')
  check('轨道有过渡动画（0.4s 级）', parseFloat(s0.transition) >= 0.3, s0.transition)

  const box = await page.evaluate(() => {
    const r = document.querySelector('.cal-carousel').getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await page.mouse.move(box.x, box.y)
  await page.mouse.wheel({ deltaX: 120 })
  await sleep(150)
  const mid = await state()
  await sleep(600)
  const after1 = await state()
  console.log(`  中间态 x=${mid.x} → 终态 x=${after1.x}（屏宽 ${s0.w}，起始月 ${s0.month}）`)
  check('前进一个月', Math.abs(after1.x - (s0.x - s0.w)) <= 4, `${after1.x} vs ${s0.x - s0.w}`)
  check('位移过程为平滑动画（中间态介于起止之间）', mid.x < s0.x - 5 && mid.x > after1.x + 5, `mid=${mid.x}`)

  // 连续两次快速滚动：锁定期内只前进一个月（从 2 月起测，避免撞到月份边界）
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.mtab')].find((b) => b.textContent.trim().startsWith('2月'))
    btn.click()
  })
  await sleep(700)
  const beforeLock = await state()
  await page.mouse.wheel({ deltaX: 120 })
  await sleep(70)
  await page.mouse.wheel({ deltaX: 120 })
  await sleep(800)
  const after2 = await state()
  console.log(`  锁定期测试：${beforeLock.x} → ${after2.x}（应只前进一屏 ${beforeLock.w}）`)
  check(
    '一次手势只切一个月（连续滚动不跳月）',
    Math.abs(after2.x - (beforeLock.x - beforeLock.w)) <= 4,
    `${after2.x} vs ${beforeLock.x - beforeLock.w}`
  )

  console.log('5) 页签点击与轮播同步')
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.mtab')].find((b) => b.textContent.trim().startsWith('7月'))
    btn.click()
  })
  await sleep(800)
  const after7 = await state()
  const expect7 = -s0.w * 6
  console.log('   ', JSON.stringify({ ...after7, expect: expect7 }))
  check('点击 7 月后轨道定位到第 7 屏', Math.abs(after7.x - expect7) <= 4, `${after7.x} vs ${expect7}`)
  check('7 月页签高亮', after7.month?.startsWith('7月'), after7.month)

  console.log('6) 无整页横向溢出')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('页面无横向溢出', overflow <= 1, `overflow=${overflow}`)

  await page.screenshot({ path: `${OUT_DIR}/birth-carousel.png` })
  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
