#!/usr/bin/env node
/** 断言：生日卡工坊（模态）——画幅切换/自由比例、文案与装饰可编辑、立绘取景、多格式导出、导出到拼图 */
import { BASE, OUT_DIR, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'
import { mkdirSync } from 'node:fs'

mkdirSync(OUT_DIR, { recursive: true })
const server = startVite()
let failed = 0
const check = (name, cond, extra = '') => {
  console.log(cond ? `  ✓ ${name}${extra ? ' ' + extra : ''}` : `  ✗ ${name}${extra ? ' ' + extra : ''}`)
  if (!cond) failed += 1
}

const canvasInfo = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('dialog[open] .card-canvas')
    if (!c) return null
    const url = c.toDataURL()
    let h = 0
    for (let i = 0; i < url.length; i += 97) h = (h * 31 + url.charCodeAt(i)) % 1e9
    return { w: c.width, h: c.height, hash: h, len: url.length }
  })

try {
  if (!(await waitServer(BASE))) throw new Error('server not ready')
  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  await openRoute(page, BASE, '/birthday')
  await sleep(900)

  console.log('1) 打开工坊')
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('打开生日卡工坊'))?.click())
  await page.waitForFunction(() => Boolean(document.querySelector('dialog[open] .card-canvas')), { timeout: 15000 })
  await sleep(700)
  const charName = await page.evaluate(() => document.querySelector('dialog[open] #card-title')?.textContent || '')
  const base = await canvasInfo(page)
  console.log('   ', JSON.stringify(base))
  check('模态已打开且渲染画布', Boolean(base))
  check('默认 3:4 → 1080×1440', base && base.w === 1080 && base.h === 1440, `${base?.w}×${base?.h}`)

  console.log('2) 预设画幅')
  const clickChip = async (label) => {
    await page.evaluate((t) => {
      const btn = [...document.querySelectorAll('dialog[open] .chip')].find((b) => b.textContent.trim() === t)
      btn?.click()
    }, label)
    await page.waitForFunction(
      (t) => {
        const c = document.querySelector('dialog[open] .card-canvas')
        const expect = { '1:1': [1080, 1080], '3:4': [1080, 1440], '4:3': [1440, 1080] }[t]
        return c && expect && c.width === expect[0] && c.height === expect[1]
      },
      { timeout: 8000 },
      label
    )
    return canvasInfo(page)
  }
  const sq = await clickChip('1:1')
  check('1:1 → 1080×1080', sq.w === 1080 && sq.h === 1080, `${sq.w}×${sq.h}`)
  const wide = await clickChip('4:3')
  check('4:3 → 1440×1080', wide.w === 1440 && wide.h === 1080, `${wide.w}×${wide.h}`)
  await clickChip('3:4')

  console.log('3) 自由比例')
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('dialog[open] .num input')]
    inputs[0].value = '1200'
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
    inputs[1].value = '900'
    inputs[1].dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForFunction(() => {
    const c = document.querySelector('dialog[open] .card-canvas')
    return c && c.width === 1200 && c.height === 900
  }, { timeout: 8000 })
  const free = await canvasInfo(page)
  check('自由画幅 → 1200×900', free.w === 1200 && free.h === 900, `${free.w}×${free.h}`)
  check('自由比例与预设输出像素不同（真的改变了画布）', free.hash !== base.hash)
  await clickChip('3:4')
  await sleep(400)

  console.log('4) 文案与装饰可编辑（像素变化）')
  const before = await canvasInfo(page)
  await page.evaluate(() => {
    const ta = document.querySelector('dialog[open] textarea')
    ta.value = '愿风神护佑你的旅途'
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(700)
  const afterGreeting = await canvasInfo(page)
  check('修改祝福语后画面改变', afterGreeting.hash !== before.hash)

  await page.evaluate(() => {
    const label = [...document.querySelectorAll('dialog[open] .toggle')].find((l) => l.textContent.includes('元素图标'))
    label.querySelector('input').click()
  })
  await sleep(700)
  const afterToggle = await canvasInfo(page)
  check('关闭元素图标后画面改变', afterToggle.hash !== afterGreeting.hash)

  console.log('5) 立绘取景可调')
  await page.evaluate(() => {
    const ranges = [...document.querySelectorAll('dialog[open] .range input[type=range]')]
    ranges[0].value = '1.4'
    ranges[0].dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(700)
  const afterZoom = await canvasInfo(page)
  check('缩放立绘后画面改变', afterZoom.hash !== afterToggle.hash)

  console.log('6) 多格式导出')
  await page.evaluate(() => {
    window.__exports = []
    const orig = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__exports.push({ href: this.href, name: this.download })
      else return orig.call(this)
    }
  })

  const grab = () =>
    page.evaluate(async () => {
      const last = window.__exports.at(-1)
      if (!last) return null
      const blob = await (await fetch(last.href)).blob()
      const bmp = await createImageBitmap(blob)
      return { type: blob.type, size: blob.size, w: bmp.width, h: bmp.height, name: last.name }
    })

  const exportBtn = () => page.evaluate(() => [...document.querySelectorAll('dialog[open] .gs-btn')].find((b) => b.textContent.includes('导出图片'))?.click())

  await page.evaluate(() => {
    const sel = document.querySelector('dialog[open] .sel')
    sel.value = 'image/png'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await exportBtn()
  await sleep(900)
  const png = await grab()
  console.log('   PNG:', JSON.stringify(png))
  check('PNG 导出成功', png && png.type === 'image/png' && png.size > 20000, png ? `${(png.size / 1024).toFixed(0)}KB` : '')
  check('PNG 尺寸等于画幅 1080×1440', png && png.w === 1080 && png.h === 1440)
  check('文件名带角色与扩展名', png && /生日卡\.png$/.test(png.name), png?.name)

  await page.evaluate(() => {
    const sel = document.querySelector('dialog[open] .sel')
    sel.value = 'image/jpeg'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await exportBtn()
  await sleep(900)
  const jpg = await grab()
  check('JPEG 导出为 image/jpeg', jpg && jpg.type === 'image/jpeg', jpg?.type)
  check('JPEG 体积小于 PNG（有损压缩生效）', jpg && png && jpg.size < png.size, `${(jpg?.size / 1024).toFixed(0)}KB < ${(png?.size / 1024).toFixed(0)}KB`)

  // 2× 高清
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('dialog[open] .toggle')].find((l) => l.textContent.includes('2×'))
    t.querySelector('input').click()
  })
  await sleep(300)
  await exportBtn()
  await sleep(1500)
  const hd = await grab()
  check('2× 高清输出 2160×2880', hd && hd.w === 2160 && hd.h === 2880, hd ? `${hd.w}×${hd.h}` : '')

  console.log('7) 导出到拼图')
  await page.evaluate(() => {
    const sel = document.querySelector('dialog[open] .sel')
    sel.value = 'image/png'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.evaluate(() => [...document.querySelectorAll('dialog[open] .gs-btn')].find((b) => b.textContent.includes('导出到拼图'))?.click())
  await page.waitForFunction(() => location.pathname === '/album', { timeout: 15000 })
  await sleep(1200)
  const albumState = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('gsr.album.v1') || 'null')
    const items = Array.isArray(store) ? store : store?.items || []
    const cards = items.filter((i) => i.kind === 'card')
    const titles = cards.map((c) => c.title)
    const filled = [...document.querySelectorAll('.collage-slot')].filter((s) => !s.classList.contains('empty')).length
    return { total: items.length, cards: cards.length, titles, filled, path: location.pathname }
  })
  console.log('   ', JSON.stringify(albumState))
  check('跳转到相册页', albumState.path === '/album')
  check('相册中新增生日卡条目', albumState.cards >= 1, `cards=${albumState.cards}`)
  check('卡片标题带正确角色名', albumState.titles.some((t) => t === `${charName.replace(' · 生日卡制作', '')} 生日卡`), JSON.stringify(albumState.titles))
  check('该卡片已放入拼图槽位', albumState.filled >= 1, `filled=${albumState.filled}`)

  await page.screenshot({ path: `${OUT_DIR}/card-workshop.png` })
  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
