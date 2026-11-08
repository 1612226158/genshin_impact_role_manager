#!/usr/bin/env node
/**
 * 以「禁用 HMR WebSocket」模式启动 vite dev server（诊断 Edge 最小化故障用）。
 * 用法：node dev-nohmr.mjs   （在任意目录运行均可；Ctrl+C 结束）
 * 原理：设置 NO_HMR=1 后启动主工程的 vite，vite.config.js 据此关闭 server.hmr。
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(HERE, '..', '..', 'genshin-role-tool')

const child = spawn(
  process.execPath,
  [path.join(PROJECT, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5317', '--strictPort'],
  {
    cwd: PROJECT,
    env: { ...process.env, NO_HMR: '1' },
    stdio: 'inherit',
  }
)

child.on('exit', (code) => process.exit(code ?? 0))
