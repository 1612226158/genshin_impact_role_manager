<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { assetUrl } from '@/utils/asset'
import { elementColor, elementIcon } from '@/utils/element'
import { canvasToBlob, drawStars, loadImage, mix, rgba, roundRect, wrapText } from '@/utils/canvas'

const props = defineProps({
  character: { type: Object, required: true },
  /** 可编辑配置：画幅、文案、装饰开关、立绘取景 */
  config: { type: Object, default: () => ({}) },
})

const canvasRef = ref(null)
/** 最近一次绘制出的可拖拽区域（画布坐标），用于判断拖的是海报还是卡牌 */
const rects = { poster: null, card: null }
/** 实际生效的归一化偏移（可能被边框夹紧），供拖拽结束后同步状态 */
const effective = { art: { x: 0, y: 0 }, card: { x: 0, y: 0 } }
/** 上一帧海报的尺寸度量：归一化可移动上限由它推导（不依赖重绘即可返回） */
const metrics = { poster: null, card: null }
const busy = ref(false)
const failed = ref(false)
let drawVersion = 0
/* 实际执行的绘制次数：拖动时应远少于 pointermove 次数 */
let drawCount = 0

/** 图片缓存：避免每次拖动都重新 new Image 解码（那正是闪烁的根源） */
const imgCache = new Map()
function getImage(src) {
  if (!src) return Promise.resolve(null)
  if (imgCache.has(src)) return Promise.resolve(imgCache.get(src))
  return loadImage(src)
    .then((img) => {
      imgCache.set(src, img)
      return img
    })
    .catch(() => null)
}

const DEFAULTS = {
  width: 1080,
  height: 1350,
  texts: { name: '', meta: '', greeting: '', sign: '', footer: '原神角色工具 · 素材版权归 miHoYo 所有' },
  show: { icon: true, halo: true, stars: true, frame: true, meta: true, sign: true, footer: true },
  art: { scale: 1, x: 0, y: 0 },
  card: { scale: 1, x: -1, y: 1 },
  artMode: 'poster',
}

const cfg = computed(() => {
  const c = props.config || {}
  return {
    width: Number(c.width) || DEFAULTS.width,
    height: Number(c.height) || DEFAULTS.height,
    texts: { ...DEFAULTS.texts, ...(c.texts || {}) },
    show: { ...DEFAULTS.show, ...(c.show || {}) },
    art: { ...DEFAULTS.art, ...(c.art || {}) },
    card: { ...DEFAULTS.card, ...(c.card || {}) },
    artMode: c.artMode || DEFAULTS.artMode,
  }
})

/** 立绘来源：海报取竖版全身图，卡牌取头像大图，两者都放则海报为主 + 卡牌插图 */
function artSources(c) {
  const paintings = c.images?.paintings || []
  const poster = paintings[0]?.file ? assetUrl(paintings[0].file) : ''
  const card = c.images?.avatar_hd ? assetUrl(c.images.avatar_hd) : c.images?.avatar ? assetUrl(c.images.avatar) : ''
  return { poster: poster || card, card: card || poster }
}

function autoMeta(c) {
  const parts = []
  if (c.birthday) parts.push(c.birthday)
  if (c.constellation) parts.push(c.constellation)
  if (c.element) parts.push(`${c.element}元素`)
  return parts.join('  ·  ')
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/* ---------------- 静态层：底纹 / 边框 / 文字，只在版式改变时重绘 ---------------- */
let staticLayer = null
let staticKey = ''

function layout(w, h, show) {
  // 字号随画幅等比缩放，保证不同比例下观感一致
  const s = Math.min(1.6, Math.max(0.5, Math.min(w / 1080, h / 1350)))
  const margin = Math.round(46 * s)
  return { s, margin, footerH: show.footer ? 64 * s : 24 * s }
}

async function renderStatic(key, w, h, cfgV, c) {
  const { s, margin } = layout(w, h, cfgV.show)
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')
  const el = elementColor(c.element)
  const { texts, show } = cfgV

  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, mix(el, '#ffffff', 0.9))
  g.addColorStop(0.52, '#f9f7f3')
  g.addColorStop(1, mix(el, '#ffffff', 0.82))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  if (show.halo) {
    const halo = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.max(w, h) * 0.6)
    halo.addColorStop(0, rgba(el, 0.16))
    halo.addColorStop(1, rgba(el, 0))
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, w, h)
  }

  if (show.stars) drawStars(ctx, w, h, { count: 90, seed: 31, color: '60,80,100' })

  if (show.frame) {
    ctx.strokeStyle = 'rgba(168, 130, 63, 0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2)
    ctx.strokeStyle = 'rgba(168, 130, 63, 0.22)'
    ctx.lineWidth = 1
    ctx.strokeRect(margin + 9, margin + 9, w - (margin + 9) * 2, h - (margin + 9) * 2)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  let y = margin + 46 * s
  const iconPath = elementIcon(c.element)
  if (show.icon && iconPath) {
    const iconSize = 62 * s
    const icon = await getImage(assetUrl(iconPath))
    if (icon) ctx.drawImage(icon, w / 2 - iconSize / 2, y - iconSize / 2, iconSize, iconSize)
    y += iconSize / 2 + 28 * s
  } else {
    y += 30 * s
  }

  ctx.fillStyle = rgba(el, 0.92)
  ctx.font = `600 ${Math.round(26 * s)}px "Noto Serif SC", "Songti SC", serif`
  ctx.letterSpacing = `${Math.round(10 * s)}px`
  ctx.fillText('HAPPY BIRTHDAY', w / 2, y)
  ctx.letterSpacing = '0px'

  const nameSize = Math.round(Math.min(84 * s, w * 0.1))
  // 标题基线与名字基线必须相隔 ≥ 名字字号，否则 84px 的姓名会压住标题
  y += Math.round(nameSize * 1.02)
  ctx.fillStyle = '#2e2a25'
  ctx.font = `700 ${nameSize}px "Noto Serif SC", "Songti SC", serif`
  ctx.fillText(texts.name || c.name || '角色', w / 2, y)
  y += nameSize * 0.42

  const metaText = show.meta ? texts.meta || autoMeta(c) : ''
  if (metaText) {
    const metaSize = Math.round(24 * s)
    ctx.fillStyle = 'rgba(90, 78, 62, 0.86)'
    ctx.font = `400 ${metaSize}px "Noto Sans SC", "PingFang SC", sans-serif`
    ctx.letterSpacing = `${Math.round(3 * s)}px`
    ctx.fillText(metaText, w / 2, y)
    ctx.letterSpacing = '0px'
    y += metaSize * 1.5
  }

  if (texts.greeting) {
    const greetSize = Math.round(24 * s)
    const lineH = greetSize * 1.5
    ctx.fillStyle = 'rgba(58, 50, 40, 0.92)'
    ctx.font = `400 ${greetSize}px "Noto Serif SC", "Songti SC", serif`
    const lines = wrapText(ctx, texts.greeting, w - margin * 4).slice(0, 2)
    lines.forEach((line, i) => ctx.fillText(line, w / 2, y + i * lineH))
    y += lines.length * lineH
  }

  if (show.sign && texts.sign) {
    const signSize = Math.round(21 * s)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(120, 100, 72, 0.85)'
    ctx.font = `400 ${signSize}px "Noto Serif SC", "Songti SC", serif`
    ctx.fillText(texts.sign, w - margin - 16 * s, y + signSize)
    ctx.textAlign = 'center'
    y += signSize * 1.9
  }

  // 白色相纸（立绘容器），文字区之外的部分
  const artTop = y + 24 * s
  const artBottom = h - (show.footer ? 64 * s : 24 * s)
  const artInset = margin + 6 * s
  const boxW = w - artInset * 2
  const boxH = Math.max(60, artBottom - artTop)
  const radius = 24 * s

  ctx.save()
  roundRect(ctx, artInset, artTop, boxW, boxH, radius)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()

  if (show.footer) {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(120, 108, 92, 0.7)'
    ctx.font = `400 ${Math.round(17 * s)}px "Noto Sans SC", "PingFang SC", sans-serif`
    ctx.letterSpacing = '2px'
    ctx.fillText(texts.footer || '', w / 2, h - 40 * s)
    ctx.letterSpacing = '0px'
  }

  return { layer: cv, key, layout: { s, margin, artTop, artBottom, artInset, boxW, boxH, radius } }
}

/* ---------------- 立绘层：每次拖动只重绘这一层 ---------------- */
function drawArt(ctx, cfgV, L, posterImg, cardImg) {
  const { s, artTop, artInset, boxW, boxH, radius } = L
  const { art, card: cardCfg, artMode } = cfgV
  const scale = Math.max(0.2, art.scale || 1)
  rects.poster = null
  rects.card = null

  const roundClip = (x, y, rw, rh, r) => {
    ctx.save()
    roundRect(ctx, x, y, rw, rh, r)
    ctx.clip()
  }
  const goldStroke = (x, y, rw, rh, r, alpha = 0.55) => {
    ctx.save()
    roundRect(ctx, x + 1, y + 1, rw - 2, rh - 2, Math.max(1, r - 1))
    ctx.strokeStyle = `rgba(168, 130, 63, ${alpha})`
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }

  if (artMode === 'card') {
    if (!cardImg) return
    const side = Math.min(boxW, boxH) * 0.94
    // 位置映射天然落在相纸内部（x∈[-1,1] → [artInset, artInset+boxW-side]）
    const x0 = artInset + (boxW - side) / 2 + clamp(art.x || 0, -1, 1) * ((boxW - side) / 2)
    const y0 = artTop + (boxH - side) / 2 + clamp(art.y || 0, -1, 1) * ((boxH - side) / 2)
    const k = side / Math.min(cardImg.width, cardImg.height) * scale
    const dw = cardImg.width * k
    const dh = cardImg.height * k

    ctx.save()
    ctx.shadowColor = 'rgba(120, 90, 40, 0.32)'
    ctx.shadowBlur = 28 * s
    ctx.shadowOffsetY = 10 * s
    roundRect(ctx, x0, y0, side, side, radius)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()

    roundClip(x0, y0, side, side, radius)
    ctx.drawImage(cardImg, x0 + side / 2 - dw / 2, y0 + side / 2 - dh / 2, dw, dh)
    ctx.restore()

    goldStroke(x0, y0, side, side, radius)
    rects.poster = { x: x0, y: y0, w: side, h: side }
    metrics.poster = { boxW: side, boxH: side, dw: side, dh: side }
    effective.art.x = art.x || 0
    effective.art.y = art.y || 0
    return
  }

  if (!posterImg) return
  const base = Math.min(boxW / posterImg.width, boxH / posterImg.height)
  const k = base * scale
  const dw = posterImg.width * k
  const dh = posterImg.height * k

  // 位移限制采用「整块不许越出相纸」：
  // 图片比相纸窄 → 可在相纸内左右滑动（另一侧留白）；
  // 图片比相纸宽 → 只能在溢出范围内移动，避免露出空白边。
  const maxX = Math.abs(boxW - dw) / 2
  const maxY = Math.abs(boxH - dh) / 2
  const offX = clamp((art.x || 0) * (boxW / 2), -maxX, maxX)
  const offY = clamp((art.y || 0) * (boxH / 2), -maxY, maxY)
  const cx = artInset + boxW / 2 + offX
  const cy = artTop + boxH / 2 + offY

  roundClip(artInset, artTop, boxW, boxH, radius)
  ctx.drawImage(posterImg, cx - dw / 2, cy - dh / 2, dw, dh)
  ctx.restore()
  rects.poster = { x: artInset, y: artTop, w: boxW, h: boxH }
  metrics.poster = { boxW, boxH, dw, dh }

  effective.art.x = maxX ? offX / (boxW / 2) : 0
  effective.art.y = maxY ? offY / (boxH / 2) : 0

  if (artMode === 'both' && cardImg) {
    const m = 18 * s
    const baseCw = Math.min(boxW * 0.34, boxH * 0.36)
    const cw = baseCw * Math.max(0.4, cardCfg.scale || 1)
    // 在「可用区间」内线性映射：-1 = 左/上边缘，+1 = 右/下边缘，0 = 居中。
    // 之前以左下角为基准再加减半个余量，导致左侧越界、右侧永远到不了边。
    const spanX = Math.max(0, boxW - cw - m * 2)
    const spanY = Math.max(0, boxH - cw - m * 2)
    const px = artInset + m + ((clamp(cardCfg.x || 0, -1, 1) + 1) / 2) * spanX
    const py = artTop + m + ((clamp(cardCfg.y || 0, -1, 1) + 1) / 2) * spanY
    const kk = cw / Math.min(cardImg.width, cardImg.height)
    const iw = cardImg.width * kk
    const ih = cardImg.height * kk

    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = 22 * s
    ctx.shadowOffsetY = 6 * s
    roundRect(ctx, px, py, cw, cw, radius * 0.7)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()

    roundClip(px, py, cw, cw, radius * 0.7)
    ctx.drawImage(cardImg, px + cw / 2 - iw / 2, py + cw / 2 - ih / 2, iw, ih)
    ctx.restore()

    // 白色衬边 + 金色细边，让卡牌与海报层次分明
    ctx.save()
    roundRect(ctx, px, py, cw, cw, radius * 0.7)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.lineWidth = 6 * s
    ctx.stroke()
    ctx.restore()
    goldStroke(px, py, cw, cw, radius * 0.7, 0.75)

    rects.card = { x: px, y: py, w: cw, h: cw }
    metrics.card = { boxW, boxH, cw }
    effective.card.x = cardCfg.x || 0
    effective.card.y = cardCfg.y || 0
  }
}

async function draw() {
  const canvas = canvasRef.value
  const c = props.character
  if (!canvas || !c) return

  const version = ++drawVersion
  drawCount += 1
  const cfgV = cfg.value
  const { width: wpx, height: hpx } = cfgV
  const { poster, card } = artSources(c)

  // 只在尺寸变化时重设，避免无谓清屏
  if (canvas.width !== wpx || canvas.height !== hpx) {
    canvas.width = wpx
    canvas.height = hpx
  }

  busy.value = true
  failed.value = false

  const key = JSON.stringify({
    w: wpx,
    h: hpx,
    texts: cfgV.texts,
    show: cfgV.show,
    mode: cfgV.artMode,
    poster,
    card,
    el: c.element,
    name: c.name,
    meta: autoMeta(c),
  })

  // 静态层只在版式/文案/画幅变化时重建
  if (!staticLayer || staticKey !== key) {
    const built = await renderStatic(key, wpx, hpx, cfgV, c)
    if (version !== drawVersion) return
    staticLayer = built.layer
    staticKey = built.key
    staticLayer._layout = built.layout
  }

  const L = staticLayer._layout
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, wpx, hpx)
  ctx.drawImage(staticLayer, 0, 0)

  const [posterImg, cardImg] = await Promise.all([getImage(poster), getImage(card)])
  if (version !== drawVersion) return

  drawArt(ctx, cfgV, L, posterImg, cardImg)
  canvas.dataset.draws = String(drawCount)
  canvas.dataset.rects = JSON.stringify({ poster: rects.poster, card: rects.card })
  canvas.dataset.rects = JSON.stringify({ poster: rects.poster, card: rects.card })
  busy.value = false
}

/** 导出：type 支持 png / jpeg / webp；scale=2 输出双倍尺寸 */
async function exportBlob({ type = 'image/png', quality = 0.92, scale = 1 } = {}) {
  const src = canvasRef.value
  if (!src) return null
  if (scale === 1) return canvasToBlob(src, type, quality)
  const out = document.createElement('canvas')
  out.width = Math.round(src.width * scale)
  out.height = Math.round(src.height * scale)
  const ctx = out.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, out.width, out.height)
  return canvasToBlob(out, type, quality)
}

/** 命中测试：返回 'poster' | 'card' | null（参数为画布坐标） */
function hitTest(x, y) {
  const c = rects.card
  if (c && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return 'card'
  const p = rects.poster
  if (p && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return 'poster'
  return null
}

const rectOf = (target) => rects[target] || null
const effectiveOffsets = () => ({ art: { ...effective.art }, card: { ...effective.card } })

/**
 * 归一化可移动上限：0 表示该方向被相纸边界锁死。
 * 海报按「溢出量 / 半画框」换算（= 尺寸比 - 1），卡牌的位置映射本身就落在框内。
 */
function limits(target) {
  if (target === 'card') return { x: 1, y: 1 }
  const m = metrics.poster
  if (!m) return { x: 0, y: 0 }
  return {
    x: Math.abs(1 - m.dw / m.boxW),
    y: Math.abs(1 - m.dh / m.boxH),
  }
}

defineExpose({
  exportBlob,
  redraw: draw,
  hitTest,
  rectOf,
  effectiveOffsets,
  limits,
  drawCount: () => drawCount,
  dims: () => ({ width: cfg.value.width, height: cfg.value.height }),
})

onMounted(async () => {
  if (document.fonts?.ready) await document.fonts.ready
  draw()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  clearTimeout(textTimer)
})

/* ---------------- 绘制调度：几何按帧合并，文本防抖 ---------------- */
let rafId = 0
let textTimer = 0
const TEXT_DEBOUNCE_MS = 160

function runDraw() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  draw()
}

function scheduleFrame() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    draw()
  })
}

function scheduleDebounced() {
  clearTimeout(textTimer)
  textTimer = setTimeout(() => {
    textTimer = 0
    runDraw()
  }, TEXT_DEBOUNCE_MS)
}

const signature = (v) => ({
  text: JSON.stringify([v.texts, v.show, v.artMode, props.character?.id]),
  geom: JSON.stringify([v.width, v.height, v.art, v.card]),
})

watch(
  () => cfg.value,
  (next, prev) => {
    if (!prev) {
      runDraw()
      return
    }
    const a = signature(next)
    const b = signature(prev)
    // 拖动/滑块/画幅：合并到下一帧，最多一帧一次，保持实时手感
    if (a.geom !== b.geom) scheduleFrame()
    // 打字：真正防抖，避免每个字符都重建静态层
    if (a.text !== b.text) scheduleDebounced()
  },
  { deep: false }
)
</script>

<template>
  <canvas
    ref="canvasRef"
    class="card-canvas"
    :data-busy="busy"
    :data-failed="failed"
    :aria-label="`${character?.name || ''}生日卡预览`"
  />
</template>

<style scoped>
.card-canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 12px;
  background: #f9f7f3;
  box-shadow: 0 20px 60px #0006;
}
</style>
