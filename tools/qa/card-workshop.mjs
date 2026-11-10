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

const setFormat = async (page, label) => {
  await page.evaluate(() => document.querySelector('dialog[open] .fmt-select .select-trigger').click())
  await new Promise((r) => setTimeout(r, 150))
  await page.evaluate((t) => {
    const opt = [...document.querySelectorAll('dialog[open] .fmt-select .select-option')].find((o) => o.textContent.trim().startsWith(t))
    opt?.click()
  }, label)
  await new Promise((r) => setTimeout(r, 200))
}

const setArtMode = async (page, label) => {
  await page.evaluate(() => document.querySelector('dialog[open] .styled-select .select-trigger').click())
  await new Promise((r) => setTimeout(r, 150))
  await page.evaluate((t) => {
    const opt = [...document.querySelectorAll('dialog[open] .styled-select .select-option')].find((o) => o.textContent.includes(t))
    opt?.click()
  }, label)
  await new Promise((r) => setTimeout(r, 800))
}

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
      const btn = [...document.querySelectorAll('dialog[open] .gs-pill')].find((b) => b.textContent.trim() === t)
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

  console.log('4b) 立绘来源：卡牌 / 海报 / 两者都放')
  await setArtMode(page, '卡牌')
  const modeCard = await canvasInfo(page)
  check('卡牌模式改变画面', modeCard.hash !== afterToggle.hash, `${afterToggle.hash} → ${modeCard.hash}`)
  await setArtMode(page, '两者都放')
  const modeBoth = await canvasInfo(page)
  check('两者都放改变画面（海报 + 卡牌插图）', modeBoth.hash !== modeCard.hash, `${modeCard.hash} → ${modeBoth.hash}`)
  await setArtMode(page, '海报')
  const modePoster = await canvasInfo(page)
  check('切回海报与卡牌/两者均不同', modePoster.hash !== modeCard.hash && modePoster.hash !== modeBoth.hash)

  console.log('5) 立绘取景可调')
  await page.evaluate(() => {
    const ranges = [...document.querySelectorAll('dialog[open] .range input[type=range]')]
    ranges[0].value = '1.4'
    ranges[0].dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(700)
  const afterZoom = await canvasInfo(page)
  check('缩放立绘后画面改变', afterZoom.hash !== afterToggle.hash)

  console.log('5b) 两者都放：海报与卡牌可分别拖拽，速率按各自区域换算')
  await setArtMode(page, '两者都放')
  // 放大海报才有可拖动余量（默认 contain 时被相纸夹住，无法移动）
  await page.evaluate(() => {
    const r = document.querySelector('dialog[open] .range input[type=range]')
    r.value = '1.6'
    r.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(700)

  const readSliders = () =>
    page.evaluate(() => {
      const texts = [...document.querySelectorAll('dialog[open] .range span')].map((el) => el.textContent.trim())
      const pick = (label) =>
        texts.filter((t) => t.startsWith(label)).map((t) => Number(t.match(/-?\d+/)[0]))
      return { h: pick('水平'), v: pick('垂直') }
    })

  const cvRect = await page.evaluate(() => {
    const r = document.querySelector('dialog[open] .card-canvas').getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  })

  const base5b = await readSliders()

  // 拖左下角卡牌（水平）
  const cardStart = { x: cvRect.x + cvRect.w * 0.25, y: cvRect.y + cvRect.h * 0.8 }
  await page.mouse.move(cardStart.x, cardStart.y)
  await page.mouse.down()
  await page.mouse.move(cardStart.x + 40, cardStart.y, { steps: 8 })
  await page.mouse.up()
  await sleep(500)
  const afterCard = await readSliders()
  check(
    '拖卡牌只改变卡牌位移',
    afterCard.h[1] !== base5b.h[1] && afterCard.h[0] === base5b.h[0],
    `海报水平 ${base5b.h[0]}→${afterCard.h[0]} / 卡牌水平 ${base5b.h[1]}→${afterCard.h[1]}`
  )

  // 拖海报（垂直，默认缩放时水平被边界夹住）
  const posterStart = { x: cvRect.x + cvRect.w * 0.5, y: cvRect.y + cvRect.h * 0.45 }
  await page.mouse.move(posterStart.x, posterStart.y)
  await page.mouse.down()
  await page.mouse.move(posterStart.x, posterStart.y + 40, { steps: 8 })
  await page.mouse.up()
  await sleep(500)
  const afterPoster = await readSliders()
  check(
    '拖海报只改变海报位移',
    afterPoster.v[0] !== afterCard.v[0] && afterPoster.v[1] === afterCard.v[1],
    `海报垂直 ${afterCard.v[0]}→${afterPoster.v[0]} / 卡牌垂直 ${afterCard.v[1]}→${afterPoster.v[1]}`
  )

  const cardDelta = Math.abs(afterCard.h[1] - base5b.h[1])
  const posterDelta = Math.abs(afterPoster.v[0] - afterCard.v[0])
  check(
    '同一手势下卡牌位移幅度大于海报（速率不同）',
    cardDelta > posterDelta * 1.5,
    `card=${cardDelta} poster=${posterDelta}`
  )

  console.log('6b) 拖动不闪烁：静态层不重绘、画布尺寸不重置、位移夹在相纸内')
  await setArtMode(page, '两者都放')
  // 放大海报，制造可拖动的余量
  await page.evaluate(() => {
    const r = document.querySelector('dialog[open] .range input[type=range]')
    r.value = '1.6'
    r.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(700)

  const cvBox = await page.evaluate(() => {
    const c = document.querySelector('dialog[open] .card-canvas')
    const r = c.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height, cw: c.width, ch: c.height }
  })

  // 拖动期间逐帧采样标题区像素：若重绘导致清屏，这里会读到空白
  await page.evaluate(() => {
    const cv = document.querySelector('dialog[open] .card-canvas')
    const ctx = cv.getContext('2d')
    window.__samples = []
    window.__timer = setInterval(() => {
      const d = ctx.getImageData(Math.round(cv.width * 0.5), Math.round(cv.height * 0.09), 1, 1).data
      window.__samples.push([d[0], d[1], d[2], d[3]])
    }, 16)
  })

  const start = { x: cvBox.x + cvBox.w * 0.5, y: cvBox.y + cvBox.h * 0.45 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(start.x, start.y + i * 8)
    await sleep(30)
  }
  await page.mouse.up()
  await sleep(400)

  const dragStats = await page.evaluate(() => {
    clearInterval(window.__timer)
    const s = window.__samples.slice(1)
    const first = s[0]
    const same = s.every((p) => p.join() === first.join())
    const blank = s.some((p) => p[3] === 0 || (p[0] === 255 && p[1] === 255 && p[2] === 255))
    const cv = document.querySelector('dialog[open] .card-canvas')
    return { n: s.length, same, blank, sample: first, cw: cv.width, ch: cv.height }
  })
  console.log('   ', JSON.stringify(dragStats))
  check('拖动期间逐帧采样到有效像素', dragStats.n >= 5 && !dragStats.blank, `samples=${dragStats.n}`)
  check('标题区像素在拖动中保持不变（静态层未重绘）', dragStats.same, JSON.stringify(dragStats.sample))
  check('画布尺寸未被重置（不触发整体清屏）', dragStats.cw === cvBox.cw && dragStats.ch === cvBox.ch, `${dragStats.cw}x${dragStats.ch}`)

  // 边界夹紧：向下猛拖后垂直偏移应停在 100 且不越界
  const clampStart = { x: cvBox.x + cvBox.w * 0.5, y: cvBox.y + cvBox.h * 0.4 }
  await page.mouse.move(clampStart.x, clampStart.y)
  await page.mouse.down()
  await page.mouse.move(clampStart.x, clampStart.y + 420, { steps: 12 })
  await page.mouse.up()
  await sleep(500)
  const clampVal = await page.evaluate(() => {
    const v = [...document.querySelectorAll('dialog[open] .range span')]
      .map((el) => el.textContent.trim())
      .filter((t) => t.startsWith('垂直'))
      .map((t) => Number(t.match(/-?\d+/)[0]))
    return v[0]
  })
  // contain 拟合下 dh = boxH × 缩放，故可移动上限 = (缩放-1)×100
  const expectClamp = 60
  check('海报垂直位移被夹在上限（缩放 1.6 → 60）', clampVal === expectClamp, `垂直=${clampVal} 期望=${expectClamp}`)
  check('相纸内没有露白（底部像素非纯白）', await page.evaluate(() => {
    const cv = document.querySelector('dialog[open] .card-canvas')
    const ctx = cv.getContext('2d')
    const d = ctx.getImageData(Math.round(cv.width * 0.5), Math.round(cv.height * 0.82), 1, 1).data
    return !(d[0] === 255 && d[1] === 255 && d[2] === 255)
  }))

  console.log('6c) 绘制节流：一次拖动只按帧重绘，文本输入走防抖')
  const drawsOf = () =>
    page.evaluate(() => Number(document.querySelector('dialog[open] .card-canvas')?.dataset.draws || 0))

  // 先重置并制造可拖动余量，确保位移真的发生变化
  await page.evaluate(() => [...document.querySelectorAll('dialog[open] .gs-btn')].find((b) => b.textContent.includes('重置版式'))?.click())
  await sleep(600)
  await setArtMode(page, '两者都放')
  await page.evaluate(() => {
    const r = document.querySelector('dialog[open] .range input[type=range]')
    r.value = '1.6'
    r.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(500)

  // 先重置，保证缩放从 100% 起变化
  await page.evaluate(() => [...document.querySelectorAll('dialog[open] .gs-btn')].find((b) => b.textContent.includes('重置版式'))?.click())
  await sleep(600)

  const readLabel = () => page.evaluate(() => [...document.querySelectorAll('dialog[open] .range span')][0]?.textContent.trim())
  const d0 = await drawsOf()
  const label0 = await readLabel()
  // 在同一个 JS 任务里连发 30 次状态变更（滑块 input 会同步触发 Vue 响应式）
  await page.evaluate(() => {
    const r = document.querySelector('dialog[open] .range input[type=range]')
    for (let i = 1; i <= 30; i += 1) {
      r.value = String(1 + i * 0.02)
      r.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await sleep(200)
  const d1 = await drawsOf()
  const label1 = await readLabel()
  console.log(`   ${label0} → ${label1}；同任务 30 次变更 → 实际重绘 ${d1 - d0} 次`)
  check('状态确实发生了变化', label0 !== label1, `${label0} → ${label1}`)
  check('同任务高频变更被合并（重绘 1–3 次）', d1 - d0 >= 1 && d1 - d0 <= 3, `draws=${d1 - d0}`)

  // 文本输入防抖：连续输入后的 50ms 内不应重绘，250ms 后应重绘
  const d2 = await drawsOf()
  await page.evaluate(() => {
    const ta = document.querySelector('dialog[open] textarea')
    for (let i = 0; i < 6; i += 1) {
      ta.value = '连续输入测试' + 'x'.repeat(i + 1)
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await sleep(60)
  const d3 = await drawsOf()
  check('输入期间 60ms 内没有重绘（防抖生效）', d3 === d2, `${d2} → ${d3}`)

  await sleep(320)
  const d4 = await drawsOf()
  check('防抖窗口结束后执行了一次重绘', d4 === d2 + 1, `${d3} → ${d4}`)

  console.log('6d) 海报拖动回归：默认可横向、放大后可纵向（修复「完全拖不动」）')
  await page.evaluate(() => [...document.querySelectorAll('dialog[open] .gs-btn')].find((b) => b.textContent.includes('重置版式'))?.click())
  await sleep(600)

  const readHV = () =>
    page.evaluate(() => {
      const t = [...document.querySelectorAll('dialog[open] .range span')].map((el) => el.textContent.trim())
      const num = (label) => {
        const hit = t.find((x) => x.startsWith(label))
        return hit ? Number(hit.match(/-?\d+/)[0]) : null
      }
      return { h: num('水平'), v: num('垂直') }
    })

  const canvasBox = await page.evaluate(() => {
    const r = document.querySelector('dialog[open] .card-canvas').getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  })
  const mid = { x: canvasBox.x + canvasBox.w * 0.5, y: canvasBox.y + canvasBox.h * 0.45 }

  const baseHV = await readHV()
  await page.mouse.move(mid.x, mid.y)
  await page.mouse.down()
  await page.mouse.move(mid.x + 60, mid.y, { steps: 10 })
  await page.mouse.up()
  await sleep(400)
  const afterH = await readHV()
  check('默认缩放下海报可水平拖动', afterH.h !== baseHV.h && afterH.h !== 0, `水平 ${baseHV.h} → ${afterH.h}`)
  check('默认缩放下纵向无余量（图片等高，锁死）', afterH.v === 0, `垂直=${afterH.v}`)

  await page.evaluate(() => {
    const r = document.querySelector('dialog[open] .range input[type=range]')
    r.value = '2'
    r.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(700)
  const zoomed = await readHV()
  await page.mouse.move(mid.x, mid.y)
  await page.mouse.down()
  await page.mouse.move(mid.x, mid.y + 80, { steps: 10 })
  await page.mouse.up()
  await sleep(400)
  const afterV = await readHV()
  check('放大后海报可纵向拖动（此前被回写清零）', afterV.v !== zoomed.v && afterV.v !== 0, `垂直 ${zoomed.v} → ${afterV.v}`)

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

  await setFormat(page, 'PNG')
  await exportBtn()
  await sleep(900)
  const png = await grab()
  console.log('   PNG:', JSON.stringify(png))
  check('PNG 导出成功', png && png.type === 'image/png' && png.size > 20000, png ? `${(png.size / 1024).toFixed(0)}KB` : '')
  check('PNG 尺寸等于画幅 1080×1440', png && png.w === 1080 && png.h === 1440)
  check('文件名带角色与扩展名', png && /生日卡\.png$/.test(png.name), png?.name)

  await setFormat(page, 'JPEG')
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
  await setFormat(page, 'PNG')
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
