<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { canvasToBlob, loadImage, roundRect } from '@/utils/canvas'
import { collageLayout, cropFraction, fittedRect } from '@/utils/collage'

const props = defineProps({
  sources: { type: Array, default: () => [] },
  template: { type: String, default: 'grid2' },
  fit: { type: String, default: 'contain' },
  portraits: { type: Array, default: () => [] },
})

const canvasRef = ref(null)
const busy = ref(false)
let drawVersion = 0

function prepareImage(img, portrait) {
  const fraction = cropFraction(img.width, img.height, portrait)
  if (fraction === 1) return img
  const layer = document.createElement('canvas')
  layer.width = img.width
  layer.height = Math.round(img.height * fraction)
  const ctx = layer.getContext('2d')
  ctx.drawImage(img, 0, 0)
  ctx.globalCompositeOperation = 'destination-out'
  const fade = ctx.createLinearGradient(0, layer.height * .82, 0, layer.height)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.fillStyle = fade
  ctx.fillRect(0, layer.height * .82, layer.width, layer.height * .18)
  return layer
}

async function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const version = ++drawVersion
  const fit = props.fit
  const srcs = props.sources.slice(0, 9)
  const portraits = [...props.portraits]
  const template = props.template
  busy.value = true
  // Load a snapshot first, then paint atomically. A newer selection owns the canvas.
  const images = await Promise.all(srcs.map((src) => src ? loadImage(src).catch(() => null) : null))
  if (version !== drawVersion) return
  const prepared = images.map((img, i) => img ? prepareImage(img, portraits[i]) : null)
  const { w, h, cells } = collageLayout(template, prepared.map(img => img ? img.width / img.height : 0.55))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#0b1b28'
  ctx.fillRect(0, 0, w, h)

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

    if (prepared[i]) {
      const img = prepared[i]
      const r = fittedRect(img.width, img.height, cw, ch, fit)
      ctx.drawImage(img, x + r.x, y + r.y, r.w, r.h)
    } else {
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
watch(() => [props.template, props.fit, props.sources.join('|'), props.portraits.join('|')], draw)
onBeforeUnmount(() => { drawVersion += 1 })
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
