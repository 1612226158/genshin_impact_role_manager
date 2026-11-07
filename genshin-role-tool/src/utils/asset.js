/**
 * 静态资源路径工具
 * base 为 './' 时，必须基于 BASE_URL 拼接，否则子目录部署或 file:// 打开会 404
 */
export const BASE = import.meta.env.BASE_URL || './'

export function assetUrl(path) {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/.test(path)) return path
  return BASE + String(path).replace(/^\.?\//, '')
}
