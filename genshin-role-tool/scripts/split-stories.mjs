/**
 * 把角色正文（story）从主数据中拆分出来。
 *
 * 背景：characters.json 里 story 占 96%（1788KB / 1860KB），被打进首屏 chunk，
 * 导致线上详情页 JS 传输 771KB、LCP 3.98s。拆出后主数据仅剩列表/详情必需字段，
 * 正文改为按需动态 import（只在打开「背景故事」或编辑时加载）。
 *
 * 产物：
 *   src/data/characters.json  ← 去掉 story
 *   src/data/stories.json     ← { [id]: { summary, sections } }
 *
 * 幂等：重复执行不会丢失数据（已拆过则直接跳过）。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const charsPath = path.join(root, 'src', 'data', 'characters.json')
const storiesPath = path.join(root, 'src', 'data', 'stories.json')

const data = JSON.parse(readFileSync(charsPath, 'utf8'))
const list = data.characters

const stories = {}
let moved = 0
let bytes = 0
for (const c of list) {
  if (!c.story) continue
  stories[String(c.id)] = c.story
  bytes += Buffer.byteLength(JSON.stringify(c.story), 'utf8')
  delete c.story
  moved += 1
}

writeFileSync(charsPath, JSON.stringify(data), 'utf8')
writeFileSync(storiesPath, JSON.stringify(stories), 'utf8')

const fs = await import('node:fs')
const after = fs.statSync(charsPath).size
const storySize = fs.statSync(storiesPath).size
console.log(`已拆分 ${moved} 个角色的故事文本（${(bytes / 1024).toFixed(0)}KB）`)
console.log(`characters.json: ${(after / 1024).toFixed(0)}KB`)
console.log(`stories.json:    ${(storySize / 1024).toFixed(0)}KB`)
