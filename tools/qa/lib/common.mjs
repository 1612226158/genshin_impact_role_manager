import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

/** 仓库根目录（lib/ 在 tools/qa/ 下，往上三层） */
export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
export const PROJECT = path.join(ROOT, 'genshin-role-tool')
export const OUT_DIR = 'C:/Users/xiaoy/AppData/Local/Temp/qa-shots'

export const PORT = 5317
export const BASE = `http://127.0.0.1:${PORT}`

export const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
/**
 * ffmpeg 注意：E:/other_software/ffmpeg/ 下只有源码，无 exe。
 * 可用的是 GPT-SoVITS 自带的构建，且该 build 无 file 协议，输出必须走 `-f image2pipe -` 管道。
 */
export const FFMPEG = 'E:/other_software/GPTSoVITS/GPT-SoVITS-v3lora-20250228/ffmpeg.exe'
export const FFPROBE = 'E:/other_software/GPTSoVITS/GPT-SoVITS-v3lora-20250228/ffprobe.exe'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 在后台启动 vite dev server（--strictPort），返回可 kill 的子进程 */
export function startVite(port = PORT) {
  return spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], {
    cwd: PROJECT,
    stdio: 'ignore',
  })
}

/** 轮询等待服务就绪 */
export async function waitServer(base, { timeoutMs = 30000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const r = await fetch(base)
      if (r.ok) return true
    } catch {
      /* not ready */
    }
    await sleep(400)
  }
  return false
}

/** 统一的无头浏览器启动参数 */
export function launchBrowser({ width = 1600, height = 1050 } = {}) {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--disable-gpu', '--hide-scrollbars', '--no-sandbox'],
    defaultViewport: { width, height, deviceScaleFactor: 1 },
    protocolTimeout: 180000,
  })
}

/** 等待页面图片与字体就绪。
 *  ⚠️ 页面存在视口外的 lazy 图片（如头像栏 138 张）永远不会加载，
 *  因此必须设置总时长上限（默认 8s），否则脚本会无限挂起。 */
export async function waitAssets(page, cap = 8000) {
  await Promise.race([
    page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.addEventListener('load', res, { once: true })
                img.addEventListener('error', res, { once: true })
              })
        )
      )
      await document.fonts.ready
    }),
    sleep(cap),
  ])
}

/**
 * 打开路由并等待应用渲染完成。
 * 注意：不要用 page.waitForSelector——在本机 headless Chrome 上会无限挂起，
 * 一律用 waitForFunction；页内点击用「evaluate 内自轮询等元素」模式。
 */
export async function openRoute(page, base, path, { timeoutMs = 20000 } = {}) {
  await page.goto(`${base}/?_n=${Date.now()}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  })
  await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, {
    timeout: timeoutMs,
  })
  await sleep(400) // 懒加载路由渲染缓冲，断言前必须等
}

/** 页面内轮询点击第 N 个 .tabs button（详情页页签为懒加载路由） */
export const CLICK_TAB_SCRIPT = (index) => `(async () => {
  const b = await new Promise((res) => {
    const t = setInterval(() => {
      const el = [...document.querySelectorAll('.tabs button')][${index}]
      if (el) { clearInterval(t); res(el) }
    }, 150)
    setTimeout(() => { clearInterval(t); res(null) }, 6000)
  })
  if (b) b.click()
})()`
