#!/usr/bin/env node
/** 断言：故事页签下滚动正文时，右侧头部（名称/按钮）保持钉住 */
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
  await openRoute(page, BASE, '/#/c/1055')
  await page.evaluate(CLICK_TAB_SCRIPT(1)) // 背景故事
  await sleep(800)

  const before = await page.evaluate(() => ({
    nameTop: document.querySelector('.name-row')?.getBoundingClientRect().top,
    actionsTop: document.querySelector('.actions')?.getBoundingClientRect().top,
    body: document.querySelector('.tab-body')
      ? {
          scrollHeight: document.querySelector('.tab-body').scrollHeight,
          clientHeight: document.querySelector('.tab-body').clientHeight,
        }
      : null,
  }))
  check('tab-body 内容超出面板高度（存在内部滚动）', before.body && before.body.scrollHeight > before.body.clientHeight)

  await page.evaluate(() => document.querySelector('.tab-body').scrollTo({ top: 300 }))
  await sleep(400)
  const after = await page.evaluate(() => ({
    nameTop: document.querySelector('.name-row')?.getBoundingClientRect().top,
    actionsTop: document.querySelector('.actions')?.getBoundingClientRect().top,
    scrollTop: document.querySelector('.tab-body').scrollTop,
  }))
  check('正文已滚动 300px', Math.abs(after.scrollTop - 300) < 6)
  check('角色名位置未移动', Math.abs(after.nameTop - before.nameTop) < 2)
  check('按钮位置未移动', Math.abs(after.actionsTop - before.actionsTop) < 2)

  await page.screenshot({ path: 'C:/Users/xiaoy/AppData/Local/Temp/qa-shots/pinned_head.png' })
  console.log(failed ? `\n结果：${failed} 项失败` : '\n全部通过')
  await browser.close()
  process.exit(failed ? 1 : 0)
} finally {
  server.kill()
  await sleep(300)
}
