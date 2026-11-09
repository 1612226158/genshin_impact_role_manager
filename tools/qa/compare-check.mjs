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
      rows[label] ??= { cells: [], diff: r.classList.contains('diff') }
      rows[label].cells.push(r.querySelector('.cell').textContent.trim())
    })
    return { names, rows }
  })
  console.log('   ', JSON.stringify({ names: data.names, 元素: data.rows['元素']?.cells, 星级: data.rows['星级'] }))
  check('两列角色与 URL 参数一致', data.names.join('|') === '砂糖|芙宁娜')
  check('元素行取值为 风 / 水', data.rows['元素']?.cells.join('|') === '风|水')
  check('生日行与数据一致（11月26日 / 10月13日）', data.rows['生日']?.cells.join('|') === '11月26日|10月13日')
  check('相异字段带差异标记', data.rows['元素']?.diff === true)

  console.log('2b) 独立面板与外侧悬浮立绘')
  const posters = await page.evaluate(() => {
    const panels = [...document.querySelectorAll('.compare-panel')]
    return panels.map((panel, index) => {
      const frame = panel.getBoundingClientRect()
      const poster = panel.querySelector('.floating-poster')
      const image = poster.querySelector('img')
      const art = image.getBoundingClientRect()
      const value = panel.querySelector('.cell').getBoundingClientRect()
      return {
        images: poster.querySelectorAll('img').length,
        loaded: image.naturalWidth > 0,
        height: image.offsetHeight,
        floating: getComputedStyle(poster).position === 'absolute',
        overlapsEdge: index === 0 ? art.left < frame.left && art.right > frame.left : art.left < frame.right && art.right > frame.right,
        centered: Math.abs(value.left + value.width / 2 - frame.left - frame.width / 2) < 2,
        rowTops: [...panel.querySelectorAll('.cmp-row')].map((row) => row.getBoundingClientRect().top),
      }
    })
  })
  check('两个独立面板，每侧仅一张有效海报', posters.length === 2 && posters.every((p) => p.images === 1 && p.loaded))
  check('大幅海报悬浮并跨过各自面板的外缘', posters.every((p) => p.floating && p.overlapsEdge && p.height > 400))
  check('属性值在各自面板内居中', posters.every((p) => p.centered))
  check('左右同名字段逐行对齐', posters[0].rowTops.every((top, i) => Math.abs(top - posters[1].rowTops[i]) < 2))
  const skyColors = () => page.$eval('.paired-sky:not(.sky-leave-active)', (sky) =>
    ['--sky-left', '--sky-right'].map((key) => sky.style.getPropertyValue(key))
  )
  check('全屏星空背景分别使用风、水元素色', (await skyColors()).join('|') === '#33ccb3|#4088ff')
  await page.click('.side-a .floating-poster')
  const pulse = (side) => page.$eval(`.side-${side} .poster-flare`, (flare) => flare.getAnimations().length > 0)
  check('点击左海报触发左侧专属光效', await pulse('a') && !(await pulse('b')))
  await page.focus('.side-b .floating-poster')
  await page.keyboard.press('Enter')
  check('键盘也能触发右海报光效', await pulse('b'))
  await sleep(600)
  await page.screenshot({ path: `${OUT_DIR}/compare-desktop.png` })

  const cvRows = () => page.$$eval('.cmp-row[data-field="cv"]', (rows) => rows.map((row) => ({
    label: row.querySelector('.row-label').textContent.trim(),
    name: row.querySelector('.cell').textContent.trim(),
    diff: row.classList.contains('diff'),
  })))
  const chinese = await cvRows()
  check('每个面板只有一行 CV，默认中文', Object.keys(data.rows).filter((label) => label.endsWith('CV')).length === 1 &&
    chinese.length === 2 && chinese.every((row) => row.label === '中文 CV') && chinese.map((row) => row.name).join('|') === '小敢|钱琛')
  await page.click('.side-a button[data-field="cv"]')
  const japanese = await cvRows()
  check('点击左侧后两边一起显示日文 CV', japanese.every((row) => row.label === '日文 CV') &&
    japanese.map((row) => row.name).join('|') === '藤田茜|水濑祈')
  await page.click('.side-b button[data-field="cv"]')
  check('点击右侧后两边一起显示英文 CV', (await cvRows()).every((row) => row.label === '英文 CV'))
  await page.keyboard.press('Enter')
  check('键盘切到韩文 CV 时，同一配音不标差异', (await cvRows()).every((row) => row.label === '韩文 CV' && !row.diff))
  await page.keyboard.press('Enter')
  check('四种语言循环后回到中文 CV', (await cvRows()).every((row) => row.label === '中文 CV'))

  console.log('3) 相同字段不标差异')
  await openRoute(page, BASE, '/compare?a=1071&b=1056')
  await sleep(700)
  check('五星对五星时星级不标差异', (await page.$$('.cmp-row[data-field="star"].diff')).length === 0)
  check('元素不同仍标差异', (await page.$$('.cmp-row[data-field="element"].diff')).length === 2)

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
  const onlySideEnters = async (side) => {
    await page.waitForFunction(() => Boolean(document.querySelector('.compare-swap-enter-active')), { timeout: 2500 })
    return page.$$eval('.compare-swap-enter-active, .compare-swap-move', (panels, key) =>
      panels.length === 1 && panels[0].classList.contains(`side-${key}`) && panels[0].getAnimations().length > 0, side
    )
  }
  await page.evaluate(() => [...document.querySelectorAll('.picker-row')].find((r) => r.textContent.includes('砂糖')).click())
  check('选择器 A 换人只播放左侧入场', await onlySideEnters('a'))
  await sleep(500)
  const afterPick = await page.evaluate(() => ({
    names: [...document.querySelectorAll('.col-name')].map((e) => e.textContent.trim()),
    query: location.search,
  }))
  console.log('   ', JSON.stringify(afterPick))
  check('选中后左侧变为砂糖', afterPick.names[0] === '砂糖')
  check('URL 同步写入参数', /a=1055/.test(afterPick.query), afterPick.query)

  await page.click('.pick-slot:nth-child(2) .picker-trigger')
  await page.waitForFunction(() => Boolean(document.querySelector('.picker-search')))
  await page.$eval('.picker-search', (el) => {
    el.value = '芙宁娜'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.waitForFunction(() => [...document.querySelectorAll('.picker-row')].some((row) => row.textContent.includes('芙宁娜')))
  await page.evaluate(() => [...document.querySelectorAll('.picker-row')].find((row) => row.textContent.includes('芙宁娜')).click())
  check('选择器 B 换人只播放右侧入场', await onlySideEnters('b'))
  await sleep(400)

  console.log('5) 交换左右')
  const beforeSwap = await page.evaluate(() => [...document.querySelectorAll('.col-name')].map((e) => e.textContent.trim()))
  await page.evaluate(() => [...document.querySelectorAll('.gs-btn')].find((b) => b.textContent.includes('交换左右')).click())
  await page.waitForFunction(() => document.querySelectorAll('.compare-swap-move').length === 2, { timeout: 2500 })
  check('两块面板交换时都有位移动效', await page.$$eval('.compare-swap-move', (panels) =>
    panels.every((panel) => getComputedStyle(panel).transform !== 'none')
  ))
  await sleep(650)
  const swapped = await page.evaluate(() => [...document.querySelectorAll('.col-name')].map((e) => e.textContent.trim()))
  check('交换后顺序反转', swapped[0] === beforeSwap[1] && swapped[1] === beforeSwap[0], `${beforeSwap.join('|')} → ${swapped.join('|')}`)
  check('背景左右色随角色交换', (await skyColors()).join('|') === '#4088ff|#33ccb3')

  console.log('6) 键盘与移动端')
  await page.evaluate(() => document.querySelector('.pick-slot .picker-trigger').click())
  await sleep(200)
  await page.keyboard.press('Escape')
  await sleep(200)
  check('Esc 关闭选择面板', await page.evaluate(() => !document.querySelector('.picker-panel')))

  console.log('7) 角色库 → 详情 → 对比队列')
  async function openFromLibrary(name) {
    await page.click('.nav .nav-item[href="/"]')
    await page.waitForFunction((target) => [...document.querySelectorAll('.grid .card .name')].some((label) => label.textContent.trim() === target), {}, name)
    await page.evaluate((target) => [...document.querySelectorAll('.grid .card')].find((card) =>
      card.querySelector('.name')?.textContent.trim() === target).click(), name)
    await page.waitForFunction((target) => document.querySelector('.name-row h1')?.textContent === target, {}, name)
  }
  await openFromLibrary('砂糖')
  await page.click('.compare-add')
  check('加入第一位仍停在详情，角落显示 1 / 2', await page.evaluate(() =>
    location.pathname === '/c/1055' && document.querySelector('.compare-queue .queue-count')?.textContent.trim() === '1 / 2' &&
    document.querySelector('.compare-queue .queue-entry')?.textContent.includes('砂糖') &&
    document.querySelector('.compare-add').getAttribute('aria-pressed') === 'true'
  ))
  await page.click('.compare-add')
  await page.waitForFunction(() => !document.querySelector('.compare-queue'))
  check('再次点击已加入对比会取消并恢复按钮状态', await page.$eval('.compare-add', (button) =>
    button.getAttribute('aria-pressed') === 'false' && button.textContent.trim() === '加入对比'
  ))
  await page.click('.compare-add')
  await page.click('.compare-queue .queue-remove')
  await page.waitForFunction(() => !document.querySelector('.compare-queue'))
  check('移除后可以重新加入', await page.$eval('.compare-add', (button) => !button.disabled))
  await page.click('.compare-add')
  await openFromLibrary('芙宁娜')
  check('经过角色库切到另一位详情，第一位仍在队列', await page.$eval('.compare-queue .queue-entry', (entry) => entry.textContent.includes('砂糖')))
  await page.click('.compare-queue header')
  await page.waitForFunction(() => location.pathname === '/c/1055' && document.querySelector('.name-row h1')?.textContent === '砂糖', { timeout: 5000 })
  check('点击队列窗口返回已加入角色的详情并保留队列', await page.$eval('.compare-queue .queue-count', (count) => count.textContent.trim() === '1 / 2'))
  await openFromLibrary('芙宁娜')
  await page.click('.compare-add')
  await page.waitForFunction(() => location.pathname === '/compare' && document.querySelectorAll('.col-name').length === 2)
  check('加入第二位自动进入对比，左右与加入顺序一致', (await page.$$eval('.col-name', (names) =>
    names.map((name) => name.textContent.trim()).join('|')
  )) === '砂糖|芙宁娜')
  await page.waitForFunction(() => !document.querySelector('.compare-queue'))
  check('完成跳转后队列清空', true)

  await page.setViewport({ width: 390, height: 844 })
  await sleep(400)
  const mob = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cols: getComputedStyle(document.querySelector('.compare-board')).gridTemplateColumns.split(' ').length,
  }))
  check('移动端无横向溢出', mob.overflow <= 1, `overflow=${mob.overflow}`)
  check('窄屏仍保持两个独立面板', mob.cols === 2, `cols=${mob.cols}`)
  await page.screenshot({ path: `${OUT_DIR}/compare-mobile.png` })

  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exitCode = failed ? 1 : 0
} finally {
  server.kill()
  await sleep(300)
}
