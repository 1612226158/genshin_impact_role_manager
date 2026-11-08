/**
 * 构建后处理：把 dist/index.html 复制为 dist/404.html。
 *
 * GitHub Pages 是纯静态服务器，直接访问 /<repo>/c/1055 会返回真 404；
 * 把应用外壳放到 404.html，未知路径就会加载同一个 SPA，路由按当前
 * pathname 正常渲染对应页面（状态码仍是 404，但功能可用）。
 * 复制出的文件里资源地址是带 base 的绝对路径，无需改写。
 */
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const index = path.join(root, 'dist', 'index.html')
const notFound = path.join(root, 'dist', '404.html')

if (!existsSync(index)) {
  console.error('[postbuild] 未找到 dist/index.html，请先执行 vite build')
  process.exit(1)
}
copyFileSync(index, notFound)
console.log('[postbuild] dist/404.html 已生成（GitHub Pages 深链兜底）')
