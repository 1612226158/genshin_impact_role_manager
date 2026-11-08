#!/usr/bin/env node
/**
 * 以「HMR 禁用」模式启动 vite dev server（诊断用）。
 * 用法：node dev-nohmr.mjs   （Ctrl+C 结束；vite 前台运行，便于用户手动操作）
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const PROJECT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)), 'genshin-role-tool')

process.env.NO_HMR = '1'
process.chdir(PROJECT)

const { createServer } = await import('vite')
const server = await createServer({
  configFile: path.join(PROJECT, 'vite.config.js'),
  server: { port: 5317, strictPort: true },
})
await server.listen()
console.log('dev server (NO_HMR) running at http://localhost:5317')
console.log('按 Ctrl+C 结束')
