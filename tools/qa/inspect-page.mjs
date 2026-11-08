import { launchBrowser, sleep } from './lib/common.mjs'

const url = process.argv[2] || 'https://www.surfcg.com/game/ys/lyx-2'
const browser = await launchBrowser({ width: 1400, height: 900 })
const page = await browser.newPage()
const imgs = new Set()
page.on('response', (r) => {
  const u = r.url()
  if (/\.(png|jpe?g|webp)(\?|$)/i.test(u) && !/logo|favicon|avatar_small/i.test(u)) imgs.add(u)
})
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
await sleep(6000)
// 滚动触发懒加载
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 800) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 300))
  }
})
await sleep(2000)

const info = await page.evaluate(() => ({
  title: document.title,
  h1: [...document.querySelectorAll('h1,h2')].map((e) => e.textContent.trim()).slice(0, 6),
  text: document.body.innerText.slice(0, 600),
  imgCount: document.images.length,
}))
console.log('TITLE:', info.title)
console.log('HEADINGS:', info.h1.join(' | '))
console.log('IMG in DOM:', info.imgCount)
console.log('TEXT:', info.text.replaceAll('\n', ' | ').slice(0, 400))
console.log('--- 素材图（前 15 个响应） ---')
for (const u of [...imgs].slice(0, 15)) console.log(' ', u.slice(0, 130))
await page.screenshot({ path: 'C:/Users/xiaoy/AppData/Local/Temp/qa-shots/surfcg.png' })
await browser.close()
