#!/usr/bin/env node
/** 断言：编辑器选择控件统一化、元素图标居中、生日无重复、添加立绘单行、详情三栏顶线对齐 */
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

  console.log('1) 详情页三栏顶线对齐')
  await openRoute(page, BASE, '/c/1055')
  await sleep(700)
  const align = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      return el ? el.getBoundingClientRect() : null
    }
    return {
      tab: box('.tabs button')?.top,
      poster: box('.poster')?.top,
      name: box('.name-row')?.top,
    }
  })
  console.log('   ', JSON.stringify(align))
  const base = align.tab
  check('「属性」按钮与海报顶线一致', Math.abs(align.poster - base) <= 2, `Δ=${(align.poster - base).toFixed(1)}`)
  check('「属性」按钮与右侧姓名顶线一致', Math.abs(align.name - base) <= 2, `Δ=${(align.name - base).toFixed(1)}`)

  console.log('2) 打开编辑模态')
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.actions button')].find((b) => b.textContent.trim() === '编辑')
    btn?.click()
  })
  await page.waitForFunction(() => Boolean(document.querySelector('dialog[open] .form')), { timeout: 8000 })
  await sleep(700)

  const selects = await page.evaluate(() => ({
    native: document.querySelectorAll('dialog[open] select').length,
    styled: document.querySelectorAll('dialog[open] .styled-select').length,
  }))
  check('编辑器内无原生 select', selects.native === 0, `native=${selects.native}`)
  check('编辑器使用 6 个 StyledSelect', selects.styled === 6, `styled=${selects.styled}`)

  console.log('3) 元素图标在触发器内居中')
  const icon = await page.evaluate(() => {
    const triggers = [...document.querySelectorAll('dialog[open] .select-trigger')]
    const el = triggers.find((t) => t.querySelector('.opt-icon'))
    if (!el) return null
    const tr = el.getBoundingClientRect()
    const ir = el.querySelector('.opt-icon').getBoundingClientRect()
    return {
      text: el.innerText.trim(),
      iconCenter: ir.top + ir.height / 2,
      triggerCenter: tr.top + tr.height / 2,
      delta: Math.abs(ir.top + ir.height / 2 - (tr.top + tr.height / 2)),
      size: `${Math.round(ir.width)}x${Math.round(ir.height)}`,
    }
  })
  console.log('   ', JSON.stringify(icon))
  check('元素选择器内存在图标', Boolean(icon))
  check('图标垂直居中（Δ ≤ 1.5px）', icon && icon.delta <= 1.5, `Δ=${icon?.delta?.toFixed(2)}`)

  console.log('4) 生日选项无「1 月/一月」重复')
  const closedText = await page.evaluate(() => {
    const m = document.querySelector('dialog[open] .select-trigger[aria-label="生日月份"]')
    return m ? m.innerText.replace('⌄', '').trim() : null
  })
  await page.evaluate(() => {
    document.querySelector('dialog[open] .select-trigger[aria-label="生日月份"]')?.click()
  })
  await sleep(250) // Vue 异步渲染：等下拉真正挂载
  const list = await page.evaluate(() =>
    [...document.querySelectorAll('dialog[open] .option-list .select-option')].map((o) =>
      o.innerText.replace('✓', '').trim()
    )
  )
  await page.evaluate(() => {
    document.querySelector('dialog[open] .select-trigger[aria-label="生日月份"]')?.click()
  })
  await sleep(150)
  const bd = { closedText, list }
  console.log('   ', JSON.stringify(bd))
  check('月份闭合态为「N 月」格式', bd.closedText && /^\d{1,2} 月$/.test(bd.closedText), `text="${bd.closedText}"`)
  const months = bd.list.filter((label) => /^\d{1,2} 月$/.test(label))
  check('12 个月份标签互不重复', new Set(months).size === 12 && months.length === 12, `len=${months.length}`)
  check('不含重复语义的「一月」写法', !bd.list.some((t) => t.includes('一月') || t.includes('1月')))
  const dayText = await page.evaluate(() => {
    const d = document.querySelector('dialog[open] .select-trigger[aria-label="生日日期"]')
    return d ? d.innerText.replace('⌄', '').trim() : null
  })
  check('日期闭合态为「N 日」格式', Boolean(dayText) && /^\d{1,2} 日$/.test(dayText), `text="${dayText}"`)

  console.log('5)「添加立绘」按钮单行')
  const addBtn = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('dialog[open] .add-row .gs-btn')].find((b) =>
      b.textContent.includes('添加立绘')
    )
    if (!btn) return null
    const r = btn.getBoundingClientRect()
    const lh = parseFloat(getComputedStyle(btn).lineHeight) || 20
    return { w: r.width, h: r.height, lineHeight: lh, text: btn.innerText.replace(/\s+/g, '') }
  })
  console.log('   ', JSON.stringify(addBtn))
  check('按钮文字完整且为单行', addBtn && addBtn.text === '添加立绘' && addBtn.h <= addBtn.lineHeight + 26, `h=${addBtn?.h?.toFixed(1)}`)

  console.log('6) 选择器标签不重复')
  const dup = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]')
    const innerLabels = dialog.querySelectorAll('.select-label').length
    const fields = [...dialog.querySelectorAll('.field')]
    const counts = {}
    for (const f of fields) {
      const title = f.querySelector(':scope > span')?.innerText?.trim()
      if (!title) continue
      // 统计该字段内出现同名文本的次数（标题 + 触发器内文字）
      const full = f.innerText.replace(/\s+/g, '')
      const t = title.replace(/\s+/g, '')
      if (t) counts[t] = (full.match(new RegExp(t, 'g')) || []).length
    }
    return { innerLabels, counts }
  })
  console.log('   ', JSON.stringify(dup))
  check('组件内不再渲染重复 label', dup.innerLabels === 0, `select-label=${dup.innerLabels}`)
  check('「元素」字段仅出现一次标题', (dup.counts['元素'] || 0) === 1, `count=${dup.counts['元素']}`)
  check('「武器」字段仅出现一次标题', (dup.counts['武器'] || 0) === 1, `count=${dup.counts['武器']}`)

  console.log('7) 输入框与选择器外观统一')
  await page.evaluate(() => document.activeElement?.blur()) // 弹窗打开会聚焦首个输入框，先失焦再比
  await sleep(250)
  const parity = await page.evaluate(() => {
    const input = document.querySelector("dialog[open] input[type='text']")
    const trigger = document.querySelector('dialog[open] .select-trigger')
    const pick = (el) => {
      const s = getComputedStyle(el)
      return { bg: s.backgroundColor, border: s.borderColor, h: +el.getBoundingClientRect().height.toFixed(1), r: s.borderRadius }
    }
    return { input: pick(input), trigger: pick(trigger) }
  })
  console.log('   ', JSON.stringify(parity))
  check('背景色一致', parity.input.bg === parity.trigger.bg, `${parity.input.bg} vs ${parity.trigger.bg}`)
  check('边框色一致', parity.input.border === parity.trigger.border)
  check('圆角一致', parity.input.r === parity.trigger.r, `${parity.input.r} vs ${parity.trigger.r}`)
  check('高度差 ≤ 1px', Math.abs(parity.input.h - parity.trigger.h) <= 1, `${parity.input.h} vs ${parity.trigger.h}`)

  await page.screenshot({ path: `${OUT_DIR}/editor-fixed.png` })

  console.log('8) 生日日期随月份变化并阻止保存不完整日期')
  const field = (name) => `dialog[open] .select-trigger[aria-label="生日${name}"]`
  const choose = async (name, label) => {
    await page.evaluate((selector) => document.querySelector(selector).click(), field(name))
    await page.evaluate((selector, value) => {
      const options = [...document.querySelector(selector).parentElement.querySelectorAll('.select-option')]
      options.find((option) => option.querySelector('.opt-main').textContent.trim() === value).click()
    }, field(name), label)
  }
  // 编辑器现在会在故事正文就绪前禁用保存，点击前必须等按钮可用
  const save = async () => {
    await page.waitForFunction(() => {
      const b = document.querySelector('dialog[open] .head-ops .primary')
      return b && !b.disabled
    })
    return page.evaluate(() => document.querySelector('dialog[open] .head-ops .primary').click())
  }
  await choose('月份', '1 月')
  await choose('日期', '31 日')
  await choose('月份', '2 月')
  await save()
  check('换成 2 月后清空 31 日并拦截保存', Boolean(await page.$('dialog[open] .bd + .err')))
  await page.evaluate((selector) => document.querySelector(selector).click(), field('日期'))
  const dayOptions = `${field('日期')} + .option-list .select-option`
  const days = await page.$$eval(dayOptions, (items) => items.map((item) => item.querySelector('.opt-main').textContent.trim()))
  check('2 月仅提供 1 至 29 日', days.length === 29 && days.at(-1) === '29 日')
  await page.evaluate((selector) => [...document.querySelectorAll(selector)].at(-1).click(), dayOptions)
  await save()
  await page.waitForFunction(() => !document.querySelector('dialog[open]'))
  check('2 月 29 日可以保存到角色详情', await page.$eval('.tab-body', (body) => body.textContent.includes('2月29日')))

  await openRoute(page, BASE, '/c/509226')
  await page.waitForFunction(() => [...document.querySelectorAll('.actions button')].some((b) => b.textContent.trim() === '编辑'))
  await page.evaluate(() => [...document.querySelectorAll('.actions button')].find((b) => b.textContent.trim() === '编辑').click())
  await page.waitForFunction(() => Boolean(document.querySelector('dialog[open] .form')))
  check('未设置月份时日期不可选', await page.$eval(field('日期'), (button) => button.disabled))
  await save()
  await page.waitForFunction(() => !document.querySelector('dialog[open]'))
  check('原数据中的无生日占位不会阻止保存', await page.$eval('.tab-body', (body) => body.textContent.includes('——')))

  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exitCode = failed ? 1 : 0
} finally {
  server.kill()
  await sleep(300)
}
