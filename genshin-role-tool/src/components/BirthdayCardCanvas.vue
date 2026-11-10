<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { assetUrl } from '@/utils/asset'
import { elementColor, elementIcon } from '@/utils/element'
import { canvasToBlob, drawStars, loadImage, mix, rgba, roundRect, wrapText } from '@/utils/canvas'

const props = defineProps({
  character: { type: Object, required: true },
  /** 可编辑配置：画幅、文案、装饰开关、立绘取景 */
  config: { type: Object, default: () => ({}) },
})

const canvasRef = ref(null)
const busy = ref(false)
const failed = ref(false)
let drawVersion = 0

const DEFAULTS = {
  width: 1080,
  height: 1350,
  texts: { name: '', meta: '', greeting: '', sign: '', footer: '原神角色工具 · 素材版权归 miHoYo 所有' },
  show: { icon: true, halo: true, stars: true, frame: true, meta: true, sign: true, footer: true },
  art: { scale: 1, x: 0, y: 0 },
}

const cfg = computed(() => {
  const c = props.config || {}
  return {
    width: Number(c.width) || DEFAULTS.width,
    height: Number(c.height) || DEFAULTS.height,
    texts: { ...DEFAULTS.texts, ...(c.texts || {}) },
    show: { ...DEFAULTS.show, ...(c.show || {}) },
    art: { ...DEFAULTS.art, ...(c.art || {}) },
  }
})

/** 卡片优先用竖版立绘（全身），没有立绘时退回头像大图 */
function pickArt(c) {
  const paintings = c.images?.paintings || []
  if (paintings[0]?.file) return assetUrl(paintings[0].file)
  if (c.images?.avatar_hd) return assetUrl(c.images.avatar_hd)
  if (c.images?.avatar) return assetUrl(c.images.avatar)
  return ''
}

function autoMeta(c) {
  const parts = []
  if (c.birthday) parts.push(c.birthday)
  if (c.constellation) parts.push(c.constellation)
  if (c.element) parts.push(`${c.element}元素`)
  return parts.join('  ·  ')
}

async function draw() {
  const canvas = canvasRef.value
  const c = props.character
  if (!canvas || !c) return

  const version = ++drawVersion
  const { width: w, height: h, texts, show, art } = cfg.value
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  const el = elementColor(c.element)
  // 字号随画幅等比缩放，保证 1:1 / 3:4 / 4:3 / 自由比例下观感一致
  const s = Math.min(1.6, Math.max(0.5, Math.min(w / 1080, h / 1350)))
  const margin = Math.round(46 * s)

  busy.value = true
  failed.value = false

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
    const icon = await loadImage(assetUrl(iconPath)).catch(() => null)
    if (version !== drawVersion) return
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
  // 名字字号大，行高按字号推进，避免与下方副标题重叠
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

  const footerH = show.footer ? 64 * s : 24 * s
  const artTop = y + 24 * s
  const artBottom = h - footerH
  const artInset = margin + 6 * s
  const src = pickArt(c)

  if (src) {
    try {
      const img = await loadImage(src)
      if (version !== drawVersion) return
      const boxW = w - artInset * 2
      const boxH = Math.max(60, artBottom - artTop)
      const radius = 24 * s

      ctx.save()
      roundRect(ctx, artInset, artTop, boxW, boxH, radius)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.restore()

      // 默认 contain（完整显示立绘），放大后才产生裁剪；再叠加用户的缩放与偏移
      const base = Math.min(boxW / img.width, boxH / img.height)
      const k = base * Math.max(0.2, art.scale || 1)
      const dw = img.width * k
      const dh = img.height * k
      const cx = w / 2 + (art.x || 0) * (boxW / 2)
      const cy = artTop + boxH / 2 + (art.y || 0) * (boxH / 2)

      ctx.save()
      roundRect(ctx, artInset, artTop, boxW, boxH, radius)
      ctx.clip()
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
      ctx.restore()

      ctx.save()
      roundRect(ctx, artInset + 1, artTop + 1, boxW - 2, boxH - 2, radius - 1)
      ctx.strokeStyle = 'rgba(168, 130, 63, 0.55)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    } catch (err) {
      if (version !== drawVersion) return
      console.warn('[生日卡] 立绘绘制失败', err)
      failed.value = true
      drawNoArt(ctx, w, artTop, artBottom, s)
    }
  } else {
    failed.value = true
    drawNoArt(ctx, w, artTop, artBottom, s)
  }

  if (show.footer) {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(120, 108, 92, 0.7)'
    ctx.font = `400 ${Math.round(17 * s)}px "Noto Sans SC", "PingFang SC", sans-serif`
    ctx.letterSpacing = '2px'
    ctx.fillText(texts.footer || '', w / 2, h - 40 * s)
    ctx.letterSpacing = '0px'
  }

  busy.value = false
}

function drawNoArt(ctx, w, top, bottom, s) {
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(120,108,92,0.55)'
  ctx.font = `400 ${Math.round(22 * s)}px "Noto Sans SC", sans-serif`
  ctx.fillText('该角色暂无可用于生成卡片的立绘', w / 2, (top + bottom) / 2)
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

defineExpose({
  exportBlob,
  redraw: draw,
  dims: () => ({ width: cfg.value.width, height: cfg.value.height }),
})

onMounted(async () => {
  if (document.fonts?.ready) await document.fonts.ready
  draw()
})

watch(
  () => [props.character?.id, JSON.stringify(cfg.value)],
  () => draw()
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
