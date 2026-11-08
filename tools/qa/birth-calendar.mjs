#!/usr/bin/env node
/** 断言：生日「按月浏览」为 7 列日历，无星期、2 月 29 天、头像不遮日期、点击跳详情 */
import { BASE, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'

const server = startVite()
let failed = 0
const check = (name, cond, extra = '') => {
  console.log(cond ? `  ✓ ${name}${extra ? ' ' + extra : ''}` : `  ✗ ${name}${extra ? ' ' + extra : ''}`)
  if (!cond) failed += 1
}
const pickMonth = async (page, m) => {
  await page.evaluate((mm) => {
    const btn = [...document.querySelectorAll('.mtab')].find((b) => b.textContent.trim().startsWith(`${mm}月`))
    btn?.click()
  }, m)
  await sleep(500)
}
const geometry = (page) =>
  page.evaluate(() => {
    const grid = document.querySelector('.cal-grid')
    const cells = [...document.querySelectorAll('.cell')]
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length
    const first = cells[0].getBoundingClientRect()
    const seventh = cells[6].getBoundingClientRect()
    const eighth = cells[7] ? cells[7].getBoundingClientRect() : null
    return { cols, count: cells.length, firstTop: +first.top.toFixed(1), seventhTop: +seventh.top.toFixed(1), eighthTop: eighth ? +eighth.top.toFixed(1) : null }
  })

try {
  if (!(await waitServer(BASE))) throw new Error('server not ready')
  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  await openRoute(page, BASE, '/birthday')
  await sleep(900)

  console.log('1) 12 个月页签')
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.mtab')].length)
  check('存在 12 个月份页签', tabs === 12, `tabs=${tabs}`)

  console.log('2) 11 月：7 列骨架、30 天、无星期')
  await pickMonth(page, 11)
  const g11 = await geometry(page)
  console.log('   ', JSON.stringify(g11))
  check('网格为 7 列', g11.cols === 7)
  check('11 月有 30 个日期格', g11.count === 30, `count=${g11.count}`)
  check('第 1–7 格同在第一行（1 号起于首列）', Math.abs(g11.firstTop - g11.seventhTop) <= 1)
  check('第 8 格换行', g11.eighthTop > g11.seventhTop + 10)
  const weekdayText = await page.evaluate(() => {
    const panel = document.querySelector('.cal-grid')?.parentElement
    const t = panel ? panel.innerText : ''
    return ['周一', '周二', '周一', '一', '二', '三', '四', '五', '六', '日'].filter((w) => t.includes(w))
  })
  check('日历区域不含星期文字', weekdayText.length === 0, `hit=${weekdayText.join(',')}`)

  console.log('3) 2 月：29 天')
  await pickMonth(page, 2)
  const g2 = await geometry(page)
  console.log('   ', JSON.stringify(g2))
  check('2 月有 29 个日期格（含 2/29）', g2.count === 29, `count=${g2.count}`)

  console.log('4) 头像不遮挡日期数字')
  const overlap = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.cell')].filter((c) => c.querySelector('.face'))
    return cells.slice(0, 6).map((c) => {
      const n = c.querySelector('.dnum').getBoundingClientRect()
      const f = c.querySelector('.face').getBoundingClientRect()
      return !(n.bottom <= f.top || n.top >= f.bottom || n.right <= f.left || n.left >= f.right)
    })
  })
  check('前 6 个有生日格子均无重叠', overlap.every((x) => x === false), JSON.stringify(overlap))

  console.log('5) 点击生日格跳转角色详情')
  const target = await page.evaluate(() => {
    const cell = [...document.querySelectorAll('.cell')].find((c) => c.querySelector('.face'))
    return { day: cell.querySelector('.dnum').textContent.trim(), name: cell.querySelector('.face').alt }
  })
  await page.evaluate(() => {
    const cell = [...document.querySelectorAll('.cell')].find((c) => c.querySelector('.face'))
    cell.click()
  })
  await sleep(900)
  const nav = await page.evaluate(() => ({ path: location.pathname, h1: document.querySelector('.name-row h1')?.textContent || '' }))
  console.log('   ', JSON.stringify({ target, nav }))
  check('跳转到 /c/{id} 详情页', /^\/c\/.+/.test(nav.path), nav.path)
  check('详情页角色与所点格子一致', nav.h1 === target.name, `${target.name} vs ${nav.h1}`)

  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
