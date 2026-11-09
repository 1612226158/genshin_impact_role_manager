#!/usr/bin/env node
/**
 * 死代码扫描（只读，不删任何文件）
 *
 * 判定「零引用」需要覆盖这些入口，否则会误删：
 *   1. 静态 import / export ... from
 *   2. 动态 import('...')
 *   3. 路由表的 component: 懒加载与静态引用
 *   4. defineAsyncComponent(() => import('...'))
 *   5. 模板/字符串里出现的文件名（如 'CharacterCard.vue'、'ModuleStub'）
 *   6. 入口文件（main.js / App.vue）与 vite 配置中的显式引用
 *
 * 输出：每个 src 文件的入边数量；入边为 0 的列为「候选」，
 * 并额外给出 public/assets 中未被任何数据/代码引用的资源统计。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const srcDir = path.join(root, 'genshin-role-tool', 'src')
const publicDir = path.join(root, 'genshin-role-tool', 'public')
const EXTS = ['.js', '.vue', '.mjs', '.ts']

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(full, acc)
    } else if (EXTS.includes(path.extname(name))) {
      acc.push(full)
    }
  }
  return acc
}

const files = walk(srcDir)
const rel = (f) => path.relative(srcDir, f).split(path.sep).join('/')
const byRel = new Map(files.map((f) => [rel(f), f]))

/** 解析 import 目标（含 @/ 别名与相对路径），返回候选真实路径 */
function resolveSpec(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = path.join(srcDir, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null
  const tries = [base, base + '.js', base + '.vue', base + '.mjs', path.join(base, 'index.js')]
  for (const t of tries) {
    if (byRel.has(path.relative(srcDir, t).split(path.sep).join('/'))) {
      return path.relative(srcDir, t).split(path.sep).join('/')
    }
  }
  return null
}

const inbound = new Map(files.map((f) => [rel(f), new Set()]))
const unresolved = []

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const from = rel(file)
  const specs = new Set()

  // 1) 静态 import / 副作用 import / export from
  for (const m of text.matchAll(/(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    specs.add(m[1])
  }
  // 2) 动态 import()
  for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.add(m[1])

  for (const spec of specs) {
    const target = resolveSpec(spec, file)
    if (target) inbound.get(target)?.add(from)
    else if (spec.startsWith('.') || spec.startsWith('@/')) unresolved.push(`${from} -> ${spec}`)
  }
}

// 5) 字符串层面的引用（模板注释、文档、动态拼接的组件名等）
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const from = rel(file)
  for (const [target] of inbound) {
    if (target === from) continue
    const base = path.basename(target, path.extname(target))
    // 过于通用的名字（index/App/main）容易误判，跳过
    if (['index', 'main', 'App'].includes(base)) continue
    if (new RegExp(`['"\`/]${base}(\\.vue)?['"\`]`).test(text)) inbound.get(target).add(`${from}#string`)
  }
}

// 6) 入口豁免
const entries = ['main.js', 'App.vue']
for (const e of entries) if (inbound.has(e)) inbound.get(e).add('ENTRY')

const zero = [...inbound.entries()].filter(([, set]) => set.size === 0).map(([f]) => f)
const one = [...inbound.entries()].filter(([, set]) => set.size === 1).map(([f, s]) => `${f}  ← ${[...s][0]}`)

console.log('=== 扫描范围 ===')
console.log(`源文件 ${files.length} 个；入口豁免：${entries.join(', ')}`)
if (unresolved.length) {
  console.log(`\n⚠ 未能解析的 import（需人工确认）${unresolved.length} 条：`)
  unresolved.slice(0, 10).forEach((u) => console.log('  ' + u))
}

console.log('\n=== 零入边文件（删除候选，需人工复核）===')
if (!zero.length) console.log('（无）')
zero.forEach((f) => {
  const lines = readFileSync(path.join(srcDir, f), 'utf8').split('\n').length
  console.log(`  ${f}  (${lines} 行)`)
})

console.log('\n=== 仅 1 个入边的文件（下游可能连带死代码）===')
one.forEach((l) => console.log('  ' + l))

// 资源引用：数据文件 + 源码中出现的 assets/ 路径
// 注意：图标等路径由模板字符串动态拼接（assets/icons/element_${key}.png），
// 必须把「前缀」也视为已引用，否则会误报为未使用。
const dataText = readFileSync(path.join(srcDir, 'data', 'characters.json'), 'utf8')
const srcText = files.map((f) => readFileSync(f, 'utf8')).join('\n')

const dynamicPrefixes = new Set()
for (const m of srcText.matchAll(/[`'"]((?:assets\/)[^`'"]*?)\$\{/g)) {
  const raw = m[1]
  const cut = raw.lastIndexOf('/')
  if (cut > 0) dynamicPrefixes.add(raw.slice(0, cut + 1))
}
// 形如 `assets/icons/element_` + 变量 的「文件名前缀」也要覆盖
for (const m of srcText.matchAll(/[`'"]((?:assets\/)[^`'"]*?)\$\{/g)) {
  dynamicPrefixes.add(m[1])
}

const referenced = (p) => {
  if (dataText.includes(p) || srcText.includes(p)) return true
  for (const pre of dynamicPrefixes) {
    if (p.startsWith(pre)) return true
  }
  return false
}

const assetsDir = path.join(publicDir, 'assets')
let assetFiles = []
try {
  assetFiles = walkAssets(assetsDir)
} catch {
  assetFiles = []
}
function walkAssets(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walkAssets(full, acc)
    else acc.push(full)
  }
  return acc
}

let unusedCount = 0
let unusedBytes = 0
const sample = []
for (const f of assetFiles) {
  const relPath = 'assets/' + path.relative(assetsDir, f).split(path.sep).join('/')
  if (!referenced(relPath)) {
    unusedCount += 1
    unusedBytes += statSync(f).size
    if (sample.length < 12) sample.push(relPath)
  }
}
console.log('\n=== 未被引用的静态资源 ===')
console.log(`共 ${assetFiles.length} 个资源，其中 ${unusedCount} 个未被数据或代码引用，合计 ${(unusedBytes / 1048576).toFixed(2)} MB`)
if (dynamicPrefixes.size) {
  console.log(`（已识别 ${dynamicPrefixes.size} 个动态拼接前缀：${[...dynamicPrefixes].join(' , ')}）`)
}
sample.forEach((s) => console.log('  ' + s))

// 未使用的具名导出（文件仍在使用，但其中某些导出已无人调用）
// 区分两种：仅本文件内部使用（可去掉 export）/ 完全没有任何使用（真死代码）
console.log('\n=== 具名导出使用情况 ===')
const allText = new Map(files.map((f) => [rel(f), readFileSync(f, 'utf8')]))
let externalDead = 0
let internalOnly = 0
for (const [from, text] of allText) {
  if (!/^(utils|stores|composables)\//.test(from)) continue
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z_$][\w$]*)/g)) {
    const name = m[1]
    let external = 0
    for (const [other, otherText] of allText) {
      if (other === from) continue
      if (new RegExp(`\\b${name}\\b`).test(otherText)) external += 1
    }
    const internalUses = (text.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length - 1
    if (!external && internalUses > 0) {
      console.log(`  [仅内部使用] ${from} → ${name}（本文件内 ${internalUses} 处）`)
      internalOnly += 1
    } else if (!external && internalUses === 0) {
      console.log(`  [完全未使用] ${from} → ${name}`)
      externalDead += 1
    }
  }
}
console.log(`合计：仅内部使用 ${internalOnly} 个（可去掉 export，不算死代码）；完全未使用 ${externalDead} 个`)


