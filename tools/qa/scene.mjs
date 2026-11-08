#!/usr/bin/env node
/** Reference-driven scene regression: element theme, story navigation, mobile rail, motion lifecycle. */
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, ROOT, OUT_DIR, launchBrowser, openRoute, sleep, startVite, waitAssets, waitServer } from './lib/common.mjs'

const characters = JSON.parse(readFileSync(path.join(ROOT, 'genshin-role-tool/src/data/characters.json'), 'utf8')).characters
const water = characters.find(c => c.element === '水')
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
  mkdirSync(OUT_DIR, { recursive: true })
  await openRoute(page, BASE, '/c/1055')
  await waitAssets(page)
  check('wind theme', await page.$eval('.starfield', el => el.dataset.element === '风'))
  const image = () => page.$eval('.bg-stars', el => el.toDataURL())
  const first = await image()
  await sleep(200)
  check('particles move', first !== await image())
  await page.screenshot({ path: `${OUT_DIR}/after-stats.png` })

  await page.click('.tabs button:nth-child(2)')
  await sleep(700)
  const before = await page.$eval('.name-row', el => el.getBoundingClientRect().top)
  await page.click('.reader-index button:nth-child(4)')
  await sleep(800)
  check('story jump changes only panel scroll', await page.evaluate(() => {
    const panel = document.querySelector('.tab-body')
    const section = document.querySelector('#story-sec-3')
    return panel.scrollTop > 0 && Math.abs(section.getBoundingClientRect().top - panel.getBoundingClientRect().top - 10) < 3 && window.scrollY === 0
  }))
  await page.evaluate(() => {
    const panel = document.querySelector('.tab-body')
    const section = document.querySelector('#story-sec-4')
    panel.scrollTop += section.getBoundingClientRect().top - panel.getBoundingClientRect().top - 10
  })
  await sleep(150)
  check('manual story scroll updates index', await page.$eval('.reader-index button:nth-child(5)', el => el.getAttribute('aria-current') === 'location'))
  check('story header remains pinned', Math.abs(before - await page.$eval('.name-row', el => el.getBoundingClientRect().top)) < 2)
  await page.screenshot({ path: `${OUT_DIR}/after-story.png` })

  await openRoute(page, BASE, `/c/${water.id}`)
  check('water theme after character change', await page.$eval('.starfield', el => el.dataset.element === '水'))
  await waitAssets(page)
  await page.screenshot({ path: `${OUT_DIR}/after-water.png` })

  await openRoute(page, BASE, '/settings')
  await page.click('input[value="off"]')
  await sleep(200)
  check('motion setting stops canvas immediately', await page.$eval('.starfield', el => el.dataset.running === 'false'))
  const still = await image()
  await sleep(200)
  check('disabled canvas stays static', still === await image())
  await page.click('input[value="on"]')
  await sleep(150)
  check('motion setting resumes canvas', await page.$eval('.starfield', el => el.dataset.running === 'true'))
  // A background tab must release the animation loop.
  const other = await browser.newPage()
  await other.bringToFront()
  await sleep(150)
  check('background tab pauses canvas', await page.evaluate(() => document.hidden && document.querySelector('.starfield').dataset.running === 'false'))
  await page.bringToFront()
  await other.close()
  await sleep(150)
  check('foreground tab resumes canvas', await page.$eval('.starfield', el => el.dataset.running === 'true'))

  await page.setViewport({ width: 390, height: 844 })
  await openRoute(page, BASE, '/c/1055')
  await waitAssets(page)
  await sleep(500)
  const visible = () => page.evaluate(() => {
    const rail = document.querySelector('.rail').getBoundingClientRect()
    const item = document.querySelector('.rail-item.on').getBoundingClientRect()
    return item.left >= rail.left - 2 && item.right <= rail.right + 2
  })
  check('mobile initial avatar is visible', await visible())
  check('mobile viewport has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await page.screenshot({ path: `${OUT_DIR}/after-mobile.png`, fullPage: true })
  await page.evaluate(() => [...document.querySelectorAll('.rail-item')].at(-1).click())
  await sleep(800)
  check('mobile character switch scrolls horizontally', await visible())
  await page.setViewport({ width: 1600, height: 1050 })
  await sleep(600)
  check('resizing to desktop keeps selected avatar visible', await page.evaluate(() => {
    const rail = document.querySelector('.rail').getBoundingClientRect()
    const item = document.querySelector('.rail-item.on').getBoundingClientRect()
    return item.top >= rail.top - 2 && item.bottom <= rail.bottom + 2
  }))
} finally {
  await browser?.close()
  server.kill()
  await sleep(300)
}
console.log(failed ? `${failed} failures` : 'All scene checks passed')
process.exitCode = failed ? 1 : 0
