<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { canvasToBlob, loadImage, roundRect } from '@/utils/canvas'

const props = defineProps({
  sources: { type: Array, default: () => [] },
  template: { type: String, default: 'grid2' },
})

const canvasRef = ref(null)
const busy = ref(false)

function layoutFor(t) {
  const G = 10
  if (t === 'grid2') {
    const s = (1200 - G) / 2
    return {
      w: 1200,
      h: 1200,
      cells: [
        [0, 0, s, s],
        [s + G, 0, s, s],
        [0, s + G, s, s],
        [s + G, s + G, s, s],
      ],
    }
  }
  if (t === 'grid3') {
    const s = (1200 - G * 2) / 3
    const cells = []
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        cells.push([c * (s + G), r * (s + G), s, s])
      }
    }
    return { w: 1200, h: 1200, cells }
  }
  if (t === 'strip3') {
    const s = (1440 - G * 2) / 3
    return {
      w: 1080,
      h: 1440,
      cells: [0, 1, 2].map((i) => [0, i * (s + G), 1080, s]),
    }
  }
  // hero
  const bigW = 990
  const s = (1000 - G) / 2
  return {
    w: 1600,
    h: 1000,
    cells: [
      [0, 0, bigW, 1000],
      [bigW + G, 0, s * 0.99, s],
      [bigW + G + s, 0, (1600 - bigW - G - s) - G, s],
      [bigW + G, s + G, s * 0.99, s],
      [bigW + G + s, s + G, (1600 - bigW - G - s) - G, s],
    ],
  }
}

const layout = computed(() => layoutFor(props.template))

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  const sx = (img.width - sw) / 2
  // 立绘多为竖长构图，裁切偏向上部以保留头部
  const bias = img.height > img.width ? 0.16 : 0.5
  const sy = (img.height - sh) * bias
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

async function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const { w, h, cells } = layout.value
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#0b1b28'
  ctx.fillRect(0, 0, w, h)

  busy.value = true
  const srcs = props.sources.slice(0, cells.length)

  for (let i = 0; i < cells.length; i += 1) {
    const [x, y, cw, ch] = cells[i]
    const src = srcs[i]

    ctx.save()
    roundRect(ctx, x, y, cw, ch, 6)
    ctx.clip()

    if (!src) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(x, y, cw, ch)
      ctx.restore()
      ctx.save()
      ctx.strokeStyle = 'rgba(211,188,142,0.28)'
      ctx.lineWidth = 2
      ctx.setLineDash([10, 8])
      roundRect(ctx, x + 2, y + 2, cw - 4, ch - 4, 6)
      ctx.stroke()
      ctx.restore()
      continue
    }

    try {
      const img = await loadImage(src)
      drawCover(ctx, img, x, y, cw, ch)
    } catch {
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      ctx.fillRect(x, y, cw, ch)
    }
    ctx.restore()
  }

  busy.value = false
}

async function exportBlob() {
  if (busy.value) return null
  return canvasToBlob(canvasRef.value, 'image/png', 1)
}

defineExpose({ exportBlob, redraw: draw })

onMounted(draw)
watch(() => [props.template, props.sources.join('|')], draw)
</script>

<template>
  <canvas ref="canvasRef" class="cv" />
</template>

<style scoped>
.cv {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.45);
}
</style>
