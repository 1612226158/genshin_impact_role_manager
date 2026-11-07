<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { assetUrl } from '@/utils/asset'
import { elementColor } from '@/utils/element'
import {
  canvasToBlob,
  drawStars,
  loadImage,
  mix,
  rgba,
  roundRect,
  wrapText,
} from '@/utils/canvas'

const props = defineProps({
  character: { type: Object, required: true },
  template: { type: String, default: 'portrait' }, // portrait | square
  greeting: { type: String, default: '' },
})

const canvasRef = ref(null)
const busy = ref(false)
const failed = ref(false)

const SIZE = {
  portrait: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
}

const dims = computed(() => SIZE[props.template] || SIZE.portrait)

/**
 * 优先用 686×800 的头像大图：它的浅灰底与卡面同色，能自然融合，
 * 且构图偏正面全身，比 1:2.5 的官方竖版海报更适合卡片版式。
 */
function pickArt(c) {
  if (c.images?.avatar_hd) return assetUrl(c.images.avatar_hd)
  const paintings = c.images?.paintings || []
  if (paintings[0]?.file) return assetUrl(paintings[0].file)
  if (c.images?.avatar) return assetUrl(c.images.avatar)
  return ''
}

async function draw() {
  const canvas = canvasRef.value
  if (!canvas || !props.character) return
  const { w, h } = dims.value
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  const el = elementColor(props.character.element)
  const isSquare = props.template === 'square'

  busy.value = true
  failed.value = false

  // ---- 背景：暖白纸面 + 元素色晕染 ----
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, mix(el, '#ffffff', 0.9))
  g.addColorStop(0.52, '#f9f7f3')
  g.addColorStop(1, mix(el, '#ffffff', 0.82))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // 顶部大光晕
  const halo = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.62)
  halo.addColorStop(0, rgba(el, 0.16))
  halo.addColorStop(1, rgba(el, 0))
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, w, h)

  drawStars(ctx, w, h, { count: 90, seed: 31, color: '60,80,100' })

  // ---- 金色内框 ----
  const inset = isSquare ? 44 : 48
  ctx.strokeStyle = 'rgba(168, 130, 63, 0.55)'
  ctx.lineWidth = 2
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2)
  ctx.strokeStyle = 'rgba(168, 130, 63, 0.22)'
  ctx.lineWidth = 1
  ctx.strokeRect(inset + 9, inset + 9, w - (inset + 9) * 2, h - (inset + 9) * 2)

  // ---- 顶部文字 ----
  const c = props.character
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  const topY = isSquare ? 108 : 132
  ctx.fillStyle = rgba(el, 0.92)
  ctx.font = '600 26px "Noto Serif SC", "Songti SC", serif'
  ctx.letterSpacing = '10px'
  ctx.fillText('HAPPY BIRTHDAY', w / 2, topY)
  ctx.letterSpacing = '0px'

  // 角色名
  const nameY = isSquare ? 196 : 234
  const nameSize = isSquare ? 66 : 80
  ctx.fillStyle = '#2e2a25'
  ctx.font = `700 ${nameSize}px "Noto Serif SC", "Songti SC", serif`
  ctx.fillText(c.name || '角色', w / 2, nameY)

  // 日期 / 命之座
  const metaParts = []
  if (c.birthday) metaParts.push(c.birthday)
  if (c.constellation) metaParts.push(c.constellation)
  if (c.element) metaParts.push(`${c.element}元素`)
  ctx.fillStyle = 'rgba(90, 78, 62, 0.86)'
  ctx.font = '400 24px "Noto Sans SC", "PingFang SC", sans-serif'
  ctx.letterSpacing = '3px'
  ctx.fillText(metaParts.join('  ·  '), w / 2, nameY + (isSquare ? 42 : 50))
  ctx.letterSpacing = '0px'

  // 祝贺语
  const greetY = nameY + (isSquare ? 88 : 104)
  if (props.greeting) {
    ctx.fillStyle = 'rgba(58, 50, 40, 0.92)'
    ctx.font = '400 24px "Noto Serif SC", "Songti SC", serif'
    const lines = wrapText(ctx, props.greeting, w - 260).slice(0, 2)
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, greetY + i * 36)
    })
  }

  // ---- 角色立绘：装进带金边的圆角画框 ----
  const artTop = greetY + (props.greeting ? 64 : 40)
  const artBottom = h - (isSquare ? 92 : 112)
  const src = pickArt(c)

  if (src) {
    try {
      const img = await loadImage(src)
      const maxH = artBottom - artTop
      const maxW = w - 200
      // 按原图比例取框，避免拉伸或留白
      const scale = Math.min(maxH / img.height, maxW / img.width)
      const bw = img.width * scale
      const bh = img.height * scale
      const bx = (w - bw) / 2
      const by = artBottom - bh
      const radius = 26

      ctx.save()
      ctx.shadowColor = rgba(el, 0.35)
      ctx.shadowBlur = 42
      ctx.shadowOffsetY = 12
      roundRect(ctx, bx, by, bw, bh, radius)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.restore()

      ctx.save()
      roundRect(ctx, bx, by, bw, bh, radius)
      ctx.clip()
      ctx.drawImage(img, bx, by, bw, bh)
      ctx.restore()

      ctx.save()
      roundRect(ctx, bx + 1, by + 1, bw - 2, bh - 2, radius - 1)
      ctx.strokeStyle = 'rgba(168, 130, 63, 0.55)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    } catch (err) {
      console.warn('[生日卡] 立绘绘制失败', err)
      failed.value = true
      drawNoArt(ctx, w, artTop, artBottom)
    }
  } else {
    failed.value = true
    drawNoArt(ctx, w, artTop, artBottom)
  }

  // ---- 页脚 ----
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(120, 108, 92, 0.7)'
  ctx.font = '400 17px "Noto Sans SC", "PingFang SC", sans-serif'
  ctx.letterSpacing = '2px'
  ctx.fillText('原神角色工具 · 素材版权归 miHoYo 所有', w / 2, h - 58)
  ctx.letterSpacing = '0px'

  busy.value = false
}

function drawNoArt(ctx, w, top, bottom) {
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(120,108,92,0.55)'
  ctx.font = '400 24px "Noto Sans SC", sans-serif'
  ctx.fillText('该角色暂无可用于生成卡片的立绘', w / 2, (top + bottom) / 2)
}

async function exportBlob() {
  if (busy.value) return null
  return canvasToBlob(canvasRef.value, 'image/png', 1)
}

defineExpose({ exportBlob, redraw: draw })

onMounted(async () => {
  if (document.fonts?.ready) await document.fonts.ready
  draw()
})

watch(
  () => [props.character?.id, props.template, props.greeting, props.character?.name],
  () => draw()
)
</script>

<template>
  <div class="holder">
    <canvas ref="canvasRef" class="cv" />
    <p v-if="busy" class="hint">绘制中…</p>
  </div>
</template>

<style scoped>
.holder {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.cv {
  display: block;
  width: 100%;
  height: auto;
  max-height: 62vh;
  border-radius: 8px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
}

.hint {
  position: absolute;
  bottom: 8px;
  right: 10px;
  font-size: 11px;
  color: #8a7a64;
}
</style>
