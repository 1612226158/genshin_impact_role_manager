#!/usr/bin/env node
/** 断言：详情页左侧头像栏自动滚动定位到当前角色（首进 + 栏内切换两种路径） */
import { BASE, launchBrowser, openRoute, sleep, startVite, waitServer, CLICK_TAB_SCRIPT } from './lib/common.mjs'

const server = startVite()
let failed = 0
const check = (name, cond) => {
  console.log(cond ? `  ✓ ${name}` : `  ✗ ${name}`)
  if (!cond) failed += 1
}

try {
  if (!(await waitServer(BASE))) throw new Error('server not ready')
  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  console.log('1) 首次进入 /c/1055（砂糖，列表深处）')
  await openRoute(page, BASE, '/c/1055')
  await sleep(700)
  const s1 = await page.evaluate(() => {
    const rail = document.querySelector('.rail')
    const item = rail?.querySelector('.rail-item.on')
    if (!rail || !item) return null
    const ir = item.getBoundingClientRect()
    const rr = rail.getBoundingClientRect()
    return {
      name: item.title,
      scrollTop: rail.scrollTop,
      visible: ir.top >= rr.top - 2 && ir.bottom <= rr.bottom + 2,
    }
  })
  console.log('   ', JSON.stringify(s1))
  check('当前角色为砂糖', s1?.name === '砂糖')
  check('头像栏已滚动（scrollTop > 200）', s1 && s1.scrollTop > 200)
  check('选中头像在可视区内', s1 && s1.visible)

  console.log('2) 头像栏内点击另一个角色（风元素深处的角色）')
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.rail-item')]
    items[100].click()
  })
  await sleep(900)
  const s2 = await page.evaluate(() => {
    const rail = document.querySelector('.rail')
    const item = rail?.querySelector('.rail-item.on')
    const crumb = document.querySelector('.crumb')?.textContent || ''
    return {
      crumb: crumb.trim(),
      name: item?.title,
      pathname: location.pathname,
      visible: (() => {
        if (!rail || !item) return false
        const ir = item.getBoundingClientRect()
        const rr = rail.getBoundingClientRect()
        return ir.top >= rr.top - 2 && ir.bottom <= rr.bottom + 2
      })(),
    }
  })
  console.log('   ', JSON.stringify(s2))
  check('路由切到新角色', s2.pathname.startsWith('/c/') && s2.pathname !== '/c/1055')
  check('面包屑显示新角色', s2.crumb.length > 3 && s2.crumb.includes('/'))
  check('头像栏高亮切到新角色', s2.name && s2.name !== '砂糖')
  check('新选中头像在可视区内', s2.visible)

  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
