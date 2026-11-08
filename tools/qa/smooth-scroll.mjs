#!/usr/bin/env node
/** Verify real mouse-wheel easing on the library and ownership of nested/native scrolling. */
import { BASE, launchBrowser, openRoute, sleep, startVite, waitServer } from './lib/common.mjs'

const server = startVite()
let browser, failed = 0
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
try {
  if (!await waitServer(BASE)) throw new Error('server not ready')
  browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', e => { console.log(e.message); failed++ })
  await openRoute(page, BASE, '/')
  await page.evaluate(() => {
    const scroll = window.scrollTo.bind(window)
    window.__wheelWrites = 0
    window.scrollTo = (...args) => { window.__wheelWrites++; return scroll(...args) }
  })
  await page.mouse.move(800, 500)
  await page.mouse.wheel({ deltaY: 600 })
  await sleep(65)
  const mid = await page.evaluate(() => window.scrollY)
  await sleep(650)
  const end = await page.evaluate(() => window.scrollY)
  console.log(JSON.stringify({ mid, end }))
  check('wheel has a visible intermediate position', mid > 0 && mid < 590)
  check('wheel reaches requested distance', Math.abs(end - 600) < 3)
  const writes = await page.evaluate(() => window.__wheelWrites)
  await sleep(160)
  check('easing loop stops after reaching destination', writes === await page.evaluate(() => window.__wheelWrites))
  check('top bar stays fixed', await page.$eval('.topbar', el => Math.abs(el.getBoundingClientRect().top) < 1))
  await page.mouse.wheel({ deltaY: 400 })
  await sleep(65)
  await page.mouse.wheel({ deltaY: -600 })
  await sleep(700)
  check('repeated/reversed wheel input updates destination', Math.abs(await page.evaluate(() => window.scrollY) - 400) < 3)
  await page.evaluate(() => {
    const box = document.createElement('div')
    box.id = 'nested-scroll-test'
    box.style.cssText = 'position:fixed;top:200px;right:20px;width:180px;height:120px;overflow:auto;z-index:9999;background:#123350'
    const content = document.createElement('div')
    content.style.height = '1000px'
    box.append(content)
    document.body.append(box)
  })
  await page.mouse.move(1500, 250)
  const before = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel({ deltaY: 200 })
  await sleep(400)
  check('nested container scrolls natively', await page.$eval('#nested-scroll-test', el => el.scrollTop > 0))
  check('nested scroll does not move the document', await page.evaluate(() => window.scrollY) === before)
  await page.evaluate(() => document.querySelector('#nested-scroll-test').remove())
  const intercepted = async (options) => page.evaluate(options => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...options })
    document.querySelector('.grid').dispatchEvent(event)
    return event.defaultPrevented
  }, options)
  check('zoom gesture remains native', !await intercepted({ deltaY: 120, ctrlKey: true }))
  check('small precision deltas remain native', !await intercepted({ deltaY: 8 }))
  await openRoute(page, BASE, '/settings')
  await page.click('input[value="off"]')
  await sleep(180)
  await page.click('.brand')
  await sleep(600)
  check('motion off leaves wheel native', !await intercepted({ deltaY: 200 }))
  await openRoute(page, BASE, '/settings')
  await page.click('input[value="on"]')
  await sleep(180)
  await page.click('.brand')
  await sleep(600)
  check('motion on re-enables easing', await intercepted({ deltaY: 600 }))
  await page.click('.nav-item[href="/birthday"]')
  await sleep(800)
  check('leaving library cancels pending scroll', await page.evaluate(() => location.pathname === '/birthday' && window.scrollY === 0))
} finally {
  await browser?.close()
  server.kill()
  await sleep(300)
}
console.log(failed ? `${failed} failures` : 'All smooth-scroll checks passed')
process.exitCode = failed ? 1 : 0
