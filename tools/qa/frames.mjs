#!/usr/bin/env node
/**
 * 视频抽帧：利用本机 ffmpeg 的 pipe 输出（该 build 无 file 协议）。
 * 用法：node frames.mjs <video路径> [间隔秒=14] [输出目录=OUT_DIR/video]
 * 产出 <输出目录>/f_NN_t秒.png，配合 contact-sheet.mjs 生成总览图。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { FFMPEG, FFPROBE, OUT_DIR } from './lib/common.mjs'

const video = process.argv[2]
if (!video) {
  console.log('用法: node frames.mjs <video路径> [间隔秒] [输出目录]')
  process.exit(1)
}
const step = Number(process.argv[3] || 14)
const outDir = process.argv[4] || path.join(OUT_DIR, 'video')
mkdirSync(outDir, { recursive: true })

const dur = Number(
  execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video])
    .toString()
    .trim()
)
console.log(`duration=${dur.toFixed(1)}s step=${step}s`)

let n = 0
for (let t = 2; t <= dur - 2; t += step) {
  n += 1
  const name = `f_${String(n).padStart(2, '0')}_t${t}s.png`
  try {
    const buf = execFileSync(FFMPEG, [
      '-v', 'error',
      '-ss', String(t),
      '-i', video,
      '-frames:v', '1',
      '-f', 'image2pipe',
      '-c:v', 'png',
      '-',
    ], { maxBuffer: 64 * 1024 * 1024 })
    writeFileSync(path.join(outDir, name), buf)
  } catch (e) {
    console.log(`fail t=${t}: ${e.message.slice(0, 80)}`)
  }
}
console.log(`frames: ${n} -> ${outDir}`)
