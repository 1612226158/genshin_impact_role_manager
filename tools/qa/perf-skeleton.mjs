#!/usr/bin/env node
/**
 * 断言：详情页海报骨架 / 故事按需加载与骨架 / 编辑器载入守卫 / 二次访问命中缓存
 * 通过请求拦截人为延迟资源，制造可观测的加载中间态。
 */
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

  await page.setRequestInterception(true)
  page.on('request', async (req) => {
    const url = req.url()
    if (url.includes('/data/stories')) {
      await sleep(900)
      return req.continue().catch(() => {})
    }
    if (/\.webp(\?|$)/.test(url)) {
      await sleep(500)
      return req.continue().catch(() => {})
    }
    req.continue().catch(() => {})
  })

  console.log('1) 海报骨架（图片延迟 500ms）')
  await page.goto(`${BASE}/c/509103`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await sleep(350)
  const skel = await page.evaluate(() => {
    const el = document.querySelector('.poster-skel')
    const poster = document.querySelector('.poster')
    if (!el || !poster) return null
    const a = el.getBoundingClientRect()
    const b = poster.getBoundingClientRect()
    return { w: Math.round(a.width), h: Math.round(a.height), dw: Math.abs(a.width - b.width), dh: Math.abs(a.height - b.height) }
  })
  console.log('   ', JSON.stringify(skel))
  check('图片加载前存在海报骨架', Boolean(skel))
  check('骨架尺寸与海报容器一致（Δ ≤ 2px）', skel && skel.dw <= 2 && skel.dh <= 2, skel ? `Δw=${skel.dw} Δh=${skel.dh}` : '')

  await page.waitForFunction(() => !document.querySelector('.poster-skel'), { timeout: 15000 })
  const afterPoster = await page.evaluate(() => ({
    img: Boolean(document.querySelector('.flip-artwork img')),
    natural: document.querySelector('.flip-artwork img')?.naturalWidth || 0,
  }))
  check('图片就绪后骨架移除', true)
  check('海报已解码（naturalWidth > 0）', afterPoster.natural > 0, `w=${afterPoster.natural}`)

  console.log('2) 故事按需加载 + 骨架（chunk 延迟 900ms）')
  const beforeStory = await page.evaluate(() => Boolean(document.querySelector('.story-skel')))
  check('未点击故事页签时不加载正文', beforeStory === false)

  // 页签有 150ms 离场过渡，单点采样会错过；用观察器记录骨架是否出现过
  await page.evaluate(() => {
    window.__sawSkeleton = false
    window.__skelObserver = new MutationObserver(() => {
      if (document.querySelector('.story-skel')) window.__sawSkeleton = true
    })
    window.__skelObserver.observe(document.body, { childList: true, subtree: true })
  })
  await page.evaluate(() => [...document.querySelectorAll('.tabs button')].find((b) => b.textContent.includes('背景故事'))?.click())
  await page.waitForFunction(
    () => document.querySelector('.story-skel') === null && (document.querySelector('.reader-text')?.innerText.length || 0) > 100,
    { timeout: 20000 }
  )
  const sawSkeleton = await page.evaluate(() => {
    window.__skelObserver?.disconnect()
    return window.__sawSkeleton
  })
  const story = await page.evaluate(() => ({
    text: document.querySelector('.reader-text')?.innerText.length || 0,
    sections: document.querySelectorAll('.reader-text section').length,
  }))
  console.log('   ', JSON.stringify({ sawSkeleton, ...story }))
  check('加载期间确实出现过骨架', sawSkeleton === true)
  check('正文已渲染（> 100 字）', story.text > 100, `len=${story.text}`)
  check('分节数量 > 0', story.sections > 0, `sections=${story.sections}`)

  console.log('3) 编辑器：载入完成前禁止保存')
  await page.evaluate(() => [...document.querySelectorAll('.actions button')].find((b) => b.textContent.trim() === '编辑')?.click())
  await page.waitForFunction(() => Boolean(document.querySelector('dialog[open]')), { timeout: 10000 })
  await sleep(150)
  const guard = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('dialog[open] .head-ops .gs-btn')].find((b) => /保存|载入中/.test(b.textContent))
    return { text: btn?.textContent.trim(), disabled: btn?.disabled }
  })
  console.log('   ', JSON.stringify(guard))
  // 第二次打开时故事已缓存，可能瞬间就绪；两种状态都算正确
  check('保存按钮处于守卫状态或已就绪', guard.text === '载入中…' ? guard.disabled === true : guard.text === '保存')
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('dialog[open] .head-ops .gs-btn')].find((b) => /保存/.test(b.textContent))
    return btn && btn.textContent.trim() === '保存' && !btn.disabled
  }, { timeout: 15000 })
  const storyFields = await page.evaluate(() => ({
    sections: document.querySelectorAll('dialog[open] .section-edit').length,
    firstText: document.querySelector('dialog[open] .section-edit textarea')?.value?.length || 0,
  }))
  console.log('   ', JSON.stringify(storyFields))
  check('编辑器已填入故事分节', storyFields.sections > 0, `sections=${storyFields.sections}`)
  check('首节正文非空（未被空值覆盖）', storyFields.firstText > 50, `len=${storyFields.firstText}`)

  await page.evaluate(() => document.querySelector('dialog[open] .head-ops .gs-btn')?.click())
  await sleep(300)

  console.log('4) 同会话内已缓存：来回切页签不再出现骨架')
  // 说明：整页刷新会重建模块图，正文会重新拉取（浏览器 HTTP 缓存仍生效），
  // 这里验证的是会话内缓存——切回属性再切回故事应无骨架。
  await page.evaluate(() => {
    window.__sawSkeleton = false
    window.__skelObserver = new MutationObserver(() => {
      if (document.querySelector('.story-skel')) window.__sawSkeleton = true
    })
    window.__skelObserver.observe(document.body, { childList: true, subtree: true })
    const tabs = [...document.querySelectorAll('.tabs button')]
    tabs.find((b) => b.textContent.includes('属性'))?.click()
  })
  await sleep(400)
  await page.evaluate(() => [...document.querySelectorAll('.tabs button')].find((b) => b.textContent.includes('背景故事'))?.click())
  await page.waitForFunction(() => (document.querySelector('.reader-text')?.innerText.length || 0) > 100, { timeout: 8000 })
  const instant = await page.evaluate(() => {
    window.__skelObserver?.disconnect()
    return { skel: window.__sawSkeleton, text: document.querySelector('.reader-text')?.innerText.length || 0 }
  })
  console.log('   ', JSON.stringify(instant))
  check('会话内切换页签不再出现骨架', instant.skel === false)
  check('缓存后正文立即可见', instant.text > 100, `len=${instant.text}`)

  await page.screenshot({ path: `${OUT_DIR}/detail-story-skeleton.png` })
  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
