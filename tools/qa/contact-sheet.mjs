#!/usr/bin/env node
/**
 * 把抽帧结果拼成带时间戳的缩略总览图，便于一次性目视分析。
 * 用法：node contact-sheet.mjs <帧目录> [输出jpg] [每格宽]
 * 依赖：隔离环境 Python（Pillow）或本项目内 node——这里用 Pillow 生成质量更好，
 *       若无 Pillow 请改用 frames.mjs 所在环境。
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { OUT_DIR } from './lib/common.mjs'

const dir = process.argv[2]
if (!dir) {
  console.log('用法: node contact-sheet.mjs <帧目录> [输出jpg] [格宽]')
  process.exit(1)
}
const out = process.argv[3] || path.join(OUT_DIR, 'contact_sheet.jpg')
const cell = Number(process.argv[4] || 470)

// 借助隔离环境 Python + Pillow 拼图（中文字体/透明度处理更稳）
const PY = 'C:/Users/xiaoy/.workbuddy/binaries/python/envs/default/Scripts/python.exe'
const code = `
from PIL import Image, ImageDraw
import glob, sys
files = sorted(glob.glob(r'''${dir.replaceAll('\\', '/')}/*.png'''))
cols, tw, th = 4, ${cell}, int(${cell} * 0.465)
rows = (len(files)+cols-1)//cols
sheet = Image.new('RGB', (cols*tw+cols*4, rows*(th+20)), (10,20,30))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).resize((tw, th), Image.LANCZOS)
    x=(i%cols)*(tw+4); y=(i//cols)*(th+20)
    sheet.paste(im,(x,y+18))
    t=f.split('_t')[1].replace('s.png','')
    d.text((x+6,y+3), 't='+t+'s', fill=(211,188,142))
sheet.save(r'''${out.replaceAll('\\', '/')}''', quality=88)
print('ok', len(files))
`
const res = execFileSync(PY, ['-c', code], { encoding: 'utf-8' })
console.log(res.trim(), '->', out)
