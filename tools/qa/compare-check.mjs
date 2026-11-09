#!/usr/bin/env node
/** 断言：导航分组（库/生日/相册/对比 + 右侧记录/设置）、对比页数据正确性与交互 */
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

  console.log('1) 顶部导航分组与顺序')
  await openRoute(page, BASE, '/')
  await sleep(600)
  const nav = await page.evaluate(() => {
    const primary = [...document.querySelectorAll('.nav .nav-item')].map((a) => ({ t: a.textContent.trim(), x: Math.round(a.getBoundingClientRect().left) }))
    const secondary = [...document.querySelectorAll('.nav-sub .sub-item')].map((a) => ({ t: a.textContent.trim(), x: Math.round(a.getBoundingClientRect().left) }))
    const group = document.querySelector('.nav-sub')?.getBoundingClientRect()
    return { primary, secondary, groupRight: group ? Math.round(window.innerWidth - group.right) : null }
  })
  console.log('   ', JSON.stringify(nav))
  check('主导航为 角色库/生日/相册/对比', nav.primary.map((i) => i.t).join('|') === '角色库|生日|相册|对比')
  check('次导航为 记录/设置', nav.secondary.map((i) => i.t).join('|') === '记录|设置')
  check('次导航位于主导航右侧', nav.secondary[0].x > nav.primary.at(-1).x + 100)
  check('次导航贴合右边界（< 120px）', nav.groupRight !== null && nav.groupRight < 120, `gap=${nav.groupRight}`)

  console.log('2) 对比页数据正确')
  await openRoute(page, BASE, '/compare?a=1055&b=1071')
  await sleep(800)
  const data = await page.evaluate(() => {
    const names = [...document.querySelectorAll('.col-name')].map((e) => e.textContent.trim())
    const rows = {}
    document.querySelectorAll('.cmp-row').forEach((r) => {
      const label = r.querySelector('.row-label')?.textContent.trim().replace(/\s+/g, '')
      const cells = [...r.querySelectorAll('.cell')].map((c) => c.textContent.trim())
      rows[label] = { cells, diff: r.classList.contains('diff') }
    })
    return { names, rows }
  })
  console.log('   ', JSON.stringify({ names: data.names, 元素: data.rows['元素']?.cells, 星级: data.rows['星级'] }))
  check('两列角色与 URL 参数一致', data.names.join('|') === '砂糖|芙宁娜')
  check('元素行取值为 风 / 水', data.rows['元素']?.cells.join('|') === '风|水')
  check('生日行与数据一致（11月26日 / 10月13日）', data.rows['生日']?.cells.join('|') === '11月26日|10月13日')
  check('相异字段带差异标记', data.rows['元素']?.diff === true)

  console.log('2b) 立绘海报（叠加卡片样式）')
  const posters = await page.evaluate(() => {
    const stacks = [...document.querySelectorAll('.painting-stack')]
    const first = document.querySelector('.cmp-row')
    return stacks.map((s) => {
      const r = s.getBoundingClientRect()
      const img = s.querySelector('img')
      const ir = img?.getBoundingClientRect()
      return {
        cx: Math.round(r.left + r.width / 2),
        cy: Math.round(r.top + r.height / 2),
        h: Math.round(r.height),
        // 注意：img 有 rotate 变换，getBoundingClientRect 会被旋转放大的外接框干扰，
        // 因此用未变换的 offsetWidth/offsetHeight 判断是否超出容器布局尺寸
        img: img
          ? {
              nw: img.naturalWidth,
              w: Math.round(img.offsetWidth),
              h: Math.round(img.offsetHeight),
              inside: img.offsetWidth <= s.clientWidth + 1 && img.offsetHeight <= s.clientHeight + 1,
            }
          : null,
        aboveTable: first ? r.bottom <= first.getBoundingClientRect().top + 4 : null,
      }
    })
  })
  console.log('   ', JSON.stringify(posters))
  check('左右各有一个立绘卡片容器', posters.length === 2)
  check('两侧立绘均已解码（naturalWidth > 0）', posters.every((p) => p.img && p.img.nw > 0))
  check('立绘在容器内未被裁切', posters.every((p) => p.img.inside))
  check('左侧立绘在左、右侧在右', posters[0].cx < posters[1].cx - 100)
  check('立绘区位于对比表上方', posters.every((p) => p.aboveTable !== false))

  console.log('3) 相同字段不标差异')
  await openRoute(page, BASE, '/compare?a=1071&b=1056')
  await sleep(700)
  const same = await page.evaluate(() => {
    const out = {}
    document.querySelectorAll('.cmp-row').forEach((r) => {
      const label = r.querySelector('.row-label')?.textContent.trim().replace(/\s+/g, '')
      out[label] = { diff: r.classList.contains('diff'), cells: [...r.querySelectorAll('.cell')].map((c) => c.textContent.trim()) }
    })
    return out
  })
  check('五星对五星时星级不标差异', same['星级']?.diff === false, JSON.stringify(same['星级']))
  check('元素不同仍标差异', same['元素']?.diff === true)

  console.log('4) 选择器交互')
  await page.evaluate(() => document.querySelector('.pick-slot .picker-trigger').click())
  await sleep(200)
  const panelOpen = await page.evaluate(() => Boolean(document.querySelector('.picker-panel')))
  check('点击触发器展开选择面板', panelOpen)
  // 另一侧已选的角色应被排除（当前右侧是七七）
  await page.$eval('.picker-search', (el) => {
    el.value = '七七'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(250)
  const excluded = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.picker-row .row-name')].map((e) => e.textContent.trim()),
    none: Boolean(document.querySelector('.picker-none')),
  }))
  check('另一侧已选角色不出现在列表（防重复）', excluded.rows.length === 0 && excluded.none, JSON.stringify(excluded))

  // 改成搜索未被选用的角色
  await page.$eval('.picker-search', (el) => {
    el.value = '砂糖'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(250)
  const filtered = await page.evaluate(() => [...document.querySelectorAll('.picker-row .row-name')].map((e) => e.textContent.trim()))
  check('搜索过滤生效', filtered.includes('砂糖') && filtered.length <= 5, JSON.stringify(filtered.slice(0, 5)))
  await page.evaluate(() => [...document.querySelectorAll('.picker-row')].find((r) => r.textContent.includes('砂糖')).click())
  await sleep(500)
  const afterPick = await page.evaluate(() => ({
    names: [...document.querySelectorAll('.col-name')].map((e) => e.textContent.trim()),
    query: location.search,
  }))
  console.log('   ', JSON.stringify(afterPick))
  check('选中后左侧变为砂糖', afterPick.names[0] === '砂糖')
  check('URL 同步写入参数', /a=1055/.test(afterPick.query), afterPick.query)

  console.log('5) 交换左右')
  const beforeSwap = await page.evaluate(() => [...document.querySelectorAll('.col-name')].map((e) => e.textContent.trim()))
  await page.evaluate(() => [...document.querySelectorAll('.gs-btn')].find((b) => b.textContent.includes('交换左右')).click())
  await sleep(400)
  const swapped = await page.evaluate(() => [...document.querySelectorAll('.col-name')].map((e) => e.textContent.trim()))
  check('交换后顺序反转', swapped[0] === beforeSwap[1] && swapped[1] === beforeSwap[0], `${beforeSwap.join('|')} → ${swapped.join('|')}`)

  console.log('6) 键盘与移动端')
  await page.evaluate(() => document.querySelector('.pick-slot .picker-trigger').click())
  await sleep(200)
  await page.keyboard.press('Escape')
  await sleep(200)
  check('Esc 关闭选择面板', await page.evaluate(() => !document.querySelector('.picker-panel')))

  await page.setViewport({ width: 390, height: 844 })
  await sleep(400)
  const mob = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cols: getComputedStyle(document.querySelector('.cmp-row')).gridTemplateColumns.split(' ').length,
  }))
  check('移动端无横向溢出', mob.overflow <= 1, `overflow=${mob.overflow}`)
  check('移动端仍保持三列结构（标签 + 两角色）', mob.cols === 3, `cols=${mob.cols}`)
  await page.screenshot({ path: `${OUT_DIR}/compare-mobile.png` })

  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
