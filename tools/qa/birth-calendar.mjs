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
    const grid = document.querySelector('.cal-slide[aria-hidden="false"] .cal-grid')
    const cells = [...document.querySelectorAll('.cal-slide[aria-hidden="false"] .cell')]
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
    const panel = document.querySelector('.cal-slide[aria-hidden="false"] .cal-grid')?.parentElement
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
    const cells = [...document.querySelectorAll('.cal-slide[aria-hidden="false"] .cell')].filter((c) => c.querySelector('.face'))
    return cells.slice(0, 6).map((c) => {
      const n = c.querySelector('.dnum').getBoundingClientRect()
      const f = c.querySelector('.face').getBoundingClientRect()
      return !(n.bottom <= f.top || n.top >= f.bottom || n.right <= f.left || n.left >= f.right)
    })
  })
  check('前 6 个有生日格子均无重叠', overlap.every((x) => x === false), JSON.stringify(overlap))

  await page.setViewport({ width: 1100, height: 800 })
  check('1100px PC 窗口仍并排显示月历和生日卡', await page.evaluate(() => {
    const main = document.querySelector('.layout > .main').getBoundingClientRect()
    const card = document.querySelector('.cardpanel').getBoundingClientRect()
    return card.left >= main.right && card.right <= innerWidth
  }))

  console.log('5) 单人生日格也可以选择制作生日卡或查看详情')
  const singleCell = '.cal-slide[aria-hidden="false"] .cell.has:not(.multi)'
  const target = await page.$eval(`${singleCell} .face`, (img) => img.alt)
  const waitForPicker = () => page.waitForFunction(() => document.querySelector('.birthday-picker')?.open, { timeout: 5000 })
  await page.click(singleCell)
  await waitForPicker()
  check('单人弹窗只列出该角色', await page.$$eval('.birthday-picker .bn', (items) =>
    items.map((item) => item.textContent).join(',')
  ) === target)
  check('单人弹窗提供详情和制卡', Boolean(await page.$('.birthday-picker .picker-character')) &&
    Boolean(await page.$('.birthday-picker .picker-card')))
  await page.click('.birthday-picker .picker-card')
  const cardTitle = () => page.$eval('.card-head h2', (heading) => heading.textContent)
  check('生日卡选中该角色', await cardTitle() === `${target} · 生日卡`)
  check('生日卡保留角色详情入口', await page.$eval('.card-head a', (link) => /^\/c\/.+/.test(link.pathname)))
  check('所选角色的日期格高亮', await page.$eval('.cal-slide[aria-hidden="false"] .cell.selected .face', (img) => img.alt) === target)

  // 「制作生日卡」现在会打开工坊模态，先关闭再继续，否则焦点被模态锁住
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 5000 }).catch(() => {})
  await sleep(300)

  console.log('6) 同日生日可选择任意角色')
  const sharedCell = '.cal-slide[aria-hidden="false"] .cell.multi:nth-child(2)'
  const originalAvatar = await page.$eval(`${sharedCell} .face`, (img) => img.src)
  await page.focus(sharedCell)
  await page.keyboard.press('Enter')
  await waitForPicker()
  const names = await page.$$eval('.birthday-picker .picker-role .bn', (items) => items.map((item) => item.textContent))
  check('2 月 2 日列出林尼和琳妮特', names.length === 2 && names.includes('林尼') && names.includes('琳妮特'))
  await page.keyboard.press('Escape')
  check('关闭后焦点回到原日期格', await page.evaluate((selector) => document.activeElement.matches(selector), sharedCell))
  await page.keyboard.press('Enter')
  await waitForPicker()
  const chosenAvatar = await page.$eval('.birthday-picker .picker-role:nth-child(2) img', (img) => img.src)
  await page.click('.birthday-picker .picker-role:nth-child(2) .picker-card')
  check('第二位角色可直接制作生日卡', await cardTitle() === `${names[1]} · 生日卡`)
  check('日期格换成第二位角色头像并保留 +1', chosenAvatar !== originalAvatar &&
    await page.$eval(`${sharedCell} .face`, (img) => img.src) === chosenAvatar &&
    await page.$eval(`${sharedCell} .more`, (badge) => badge.textContent.trim()) === '+1')
  check('制卡后关闭选择弹窗并打开工坊', await page.evaluate(() =>
    !document.querySelector('.birthday-picker').open &&
    Boolean(document.querySelector('dialog.card-dialog[open] .card-canvas'))
  ))
  check('工坊内提供多格式导出与送拼图入口', await page.evaluate(() => {
    const dlg = document.querySelector('dialog.card-dialog[open]')
    return Boolean(dlg?.querySelector('.fmt-select .select-trigger')) &&
      [...dlg.querySelectorAll('.gs-btn')].some((b) => b.textContent.includes('导出到拼图'))
  }))
  // 关闭工坊（不点导出到拼图，避免跳转相册丢失本月选择状态）
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 5000 })

  await page.focus(sharedCell)
  await page.keyboard.press('Enter')
  await waitForPicker()
  await page.click('.birthday-picker .picker-role:nth-child(2) .picker-character')
  await page.waitForFunction((name) => document.querySelector('.name-row h1')?.textContent === name, {}, names[1])
  check('第二位角色可独立进入详情', /^\/c\/.+/.test(new URL(page.url()).pathname), names[1])

  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exitCode = failed ? 1 : 0
} finally {
  server.kill()
  await sleep(300)
}
