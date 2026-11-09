#!/usr/bin/env node
/**
 * 端到端回归：14 项断言，覆盖编辑/记录/撤销/新建/持久化/生日闰年边界/相册收藏。
 * 用法：node e2e.mjs
 */
import { BASE, OUT_DIR, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'

const server = startVite()
let failed = 0
const check = (name, cond) => {
  console.log(cond ? `  ✓ ${name}` : `  ✗ ${name}`)
  if (!cond) failed += 1
}
const setInput = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const setSelect = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

try {
  if (!(await waitServer(BASE))) throw new Error('server not ready')
  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  console.log('1) 编辑角色并保存')
  await openRoute(page, BASE, '/c/1055')
  await page.click('.detail-edit')
  await page.waitForFunction(() => Boolean(document.querySelector('dialog[open]')))
  await sleep(900)
  const found = await page.evaluate(() => {
    const el = [...document.querySelectorAll('input')].find((i) => i.value === '无害甜度')
    if (!el) return false
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, '无害甜度·改')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })
  check('找到称号输入框', found)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '保存')
    b?.click()
  })
  await sleep(1200)
  const afterSave = await page.evaluate(() => ({
    path: location.pathname,
    toast: document.body.innerText.includes('已保存'),
    shown: document.body.innerText.includes('无害甜度·改'),
  }))
  check('保存后跳回详情页', afterSave.path.includes('/c/1055'))
  check('出现保存成功提示', afterSave.toast)
  check('详情页显示新称号', afterSave.shown)

  console.log('2) 编辑记录与撤销')
  await openRoute(page, BASE, '/history')
  await sleep(600)
  check('记录页出现本次修改', await page.evaluate(() => document.body.innerText.includes('无害甜度·改')))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '撤销')
    b?.click()
  })
  await sleep(1000)
  check('撤销成功提示', await page.evaluate(() => document.body.innerText.includes('已撤销')))

  console.log('3) 新建自定义角色')
  await openRoute(page, BASE, '/')
  await page.evaluate(() => [...document.querySelectorAll('.head-extra button')].find(b => b.textContent.includes('新建角色')).click())
  await page.waitForFunction(() => Boolean(document.querySelector('dialog[open]')))
  await sleep(900)
  await page.evaluate(() => {
    const name = [...document.querySelectorAll('input[type=text]')].find(
      (i) => i.closest('label')?.textContent.includes('名称')
    )
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(name, '测试角色甲')
    name.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '保存')
    b?.click()
  })
  await sleep(1200)
  check('创建后跳转新角色详情', /^\/c\/c_/.test(await page.evaluate(() => location.pathname)))

  console.log('4) 刷新页面验证持久化')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(1200)
  const persisted = await page.evaluate(() => ({
    overrides: JSON.parse(localStorage.getItem('gsr.overrides.v1') || '{}'),
    customs: JSON.parse(localStorage.getItem('gsr.customs.v1') || '[]'),
  }))
  check('localStorage 保留覆盖层数据', Object.keys(persisted.overrides).length > 0)
  check('localStorage 保留自建角色', persisted.customs.length > 0)
  await openRoute(page, BASE, '/')
  check('角色库中出现自建角色', await page.evaluate(() => document.body.innerText.includes('测试角色甲')))

  console.log('5) 生日同日查询（含 2/29 边界）')
  await openRoute(page, BASE, '/birthday')
  await sleep(600)
  for (const [label, value] of [['月份', 2], ['日期', 28]]) {
    const trigger = `.qbar [role="combobox"][aria-label="${label}"]`
    await page.click(trigger)
    await page.click(`${trigger} + [role="listbox"] [role="option"]:nth-child(${value})`)
  }
  const set = await page.$$eval('.qbar .sel-text', (labels) =>
    labels.map((label) => label.textContent.trim()).join(',') === '2 月,28 日'
  )
  check('切换到 2 月 28 日', set)
  await sleep(600)
  check(
    '2/28 命中闰年生日的班尼特',
    await page.evaluate(() => {
      const t = document.querySelector('.results')?.innerText || ''
      return t.includes('班尼特') && t.includes('闰年生日')
    })
  )

  console.log('6) 相册收藏')
  await openRoute(page, BASE, '/c/1055')
  await sleep(800)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('加入相册'))
    b?.click()
  })
  await sleep(800)
  check('已加入相册的文字和勾号在同一行', await page.$eval('.album-action', (button) => {
    const label = button.firstElementChild.getBoundingClientRect()
    const mark = button.querySelector('.album-check')?.getBoundingClientRect()
    return Boolean(mark) && Math.abs(label.top + label.height / 2 - mark.top - mark.height / 2) < 2 && label.right <= mark.left
  }))
  await openRoute(page, BASE, '/album')
  check('相册出现收藏项', await page.evaluate(() => document.querySelectorAll('.tile').length > 0))
  check(
    '相册索引已持久化',
    await page.evaluate(() => JSON.parse(localStorage.getItem('gsr.album.v1') || '[]').length > 0)
  )

  // 清理测试数据
  await page.evaluate(() => {
    for (const k of ['gsr.overrides.v1', 'gsr.customs.v1', 'gsr.history.v1', 'gsr.album.v1']) {
      localStorage.removeItem(k)
    }
  })

  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
