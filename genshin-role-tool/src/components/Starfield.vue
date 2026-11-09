<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { elementColor } from '@/utils/element'

const props = defineProps({
  element: { type: String, default: '' },
  motion: { type: Boolean, default: true },
  pair: { type: Array, default: null },
})
const tint = computed(() => props.element ? elementColor(props.element) : '#417a9b')
const pairTints = computed(() => props.pair?.map((element) => element ? elementColor(element) : '#417a9b'))
const skyKey = computed(() => props.pair ? `compare:${props.pair.join('|')}` : props.element)
const canvasRef = ref(null)
const running = ref(false)
let ctx, observer, frame = 0, last = 0, clock = 0
let width = 0, height = 0, stars = []
let seed = 20261107
const rnd = () => {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}
function resize() {
  const canvas = canvasRef.value
  if (!ctx || !canvas) return
  width = canvas.clientWidth
  height = canvas.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  seed = 20261107
  stars = Array.from({ length: Math.min(180, Math.max(60, Math.round(width * height / 8500))) }, (_, i) => ({
    x: rnd() * width, y: rnd() * height, r: .4 + rnd() * 1.1,
    alpha: .12 + rnd() * .4, speed: 3 + rnd() * 9,
    phase: rnd() * Math.PI * 2, sparkle: i % 23 === 0, drift: i % 4 === 0,
  }))
  draw()
}
function draw() {
  if (!ctx || !width || !height) return
  ctx.clearRect(0, 0, width, height)
  for (const s of stars) {
    const x = s.x + (s.drift ? Math.sin(clock * .2 + s.phase) * 8 : 0)
    const y = s.drift ? ((s.y - clock * s.speed) % height + height) % height : s.y
    const driftTint = pairTints.value?.[x < width / 2 ? 0 : 1] ?? tint.value
    ctx.fillStyle = s.drift ? driftTint : '#e2f0ff'
    ctx.globalAlpha = s.alpha * (.8 + Math.sin(clock * .65 + s.phase) * .2)
    ctx.beginPath()
    if (s.sparkle) {
      const r = s.r * 3.5
      ctx.moveTo(x, y - r)
      ctx.lineTo(x + r * .23, y - r * .23)
      ctx.lineTo(x + r, y)
      ctx.lineTo(x + r * .23, y + r * .23)
      ctx.lineTo(x, y + r)
      ctx.lineTo(x - r * .23, y + r * .23)
      ctx.lineTo(x - r, y)
      ctx.lineTo(x - r * .23, y - r * .23)
      ctx.closePath()
    } else ctx.arc(x, y, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}
function stop() {
  cancelAnimationFrame(frame)
  frame = 0
  last = 0
  running.value = false
}
function tick(now) {
  if (!last) last = now
  const elapsed = now - last
  if (elapsed >= 1000 / 30) {
    clock += Math.min(elapsed, 100) / 1000
    last = now
    draw()
  }
  frame = requestAnimationFrame(tick)
}
function sync() {
  stop()
  if (!ctx) return
  // Disabled effects retain a static starfield, with no RAF loop.
  draw()
  const root = document.documentElement
  const hidden = root.classList.contains('no-stars') || root.classList.contains('no-app')
  if (props.motion && !document.hidden && !hidden) {
    running.value = true
    frame = requestAnimationFrame(tick)
  }
}
watch(() => props.motion, sync)
watch([tint, pairTints], draw)
onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  observer = new ResizeObserver(resize)
  observer.observe(canvasRef.value)
  document.addEventListener('visibilitychange', sync)
  resize()
  sync()
})
onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  document.removeEventListener('visibilitychange', sync)
  ctx = null
})
</script>

<template>
  <div class="starfield" :class="{ paused: !running }" :data-element="element || 'neutral'" :data-running="running" aria-hidden="true">
    <div class="bg-grad" />
    <Transition name="sky">
      <div :key="skyKey" class="element-sky" :class="{ 'paired-sky': pairTints }"
        :style="{ '--scene-color': tint, '--sky-left': pairTints?.[0], '--sky-right': pairTints?.[1] }" />
    </Transition>
    <canvas ref="canvasRef" class="bg-stars" />
    <div class="horizon" />
  </div>
</template>

<style scoped>
.starfield { position: fixed; inset: 0; z-index: var(--gs-z-bg); pointer-events: none; overflow: hidden; }
.bg-grad, .element-sky, .bg-stars, .horizon { position: absolute; inset: 0; }
.bg-grad { background: linear-gradient(170deg, #123350, #0c2438 38%, #071521); }
.element-sky {
  background:
    radial-gradient(ellipse 80% 42% at 42% 51%, color-mix(in srgb, var(--scene-color) 30%, transparent), transparent 80%),
    radial-gradient(ellipse 65% 85% at 18% 22%, color-mix(in srgb, var(--scene-color) 19%, transparent), transparent 85%),
    linear-gradient(180deg, transparent, color-mix(in srgb, var(--scene-color) 9%, transparent) 62%, transparent);
}
.paired-sky {
  background:
    radial-gradient(ellipse 68% 74% at 0% 37%, color-mix(in srgb, var(--sky-left) 34%, transparent), transparent 84%),
    radial-gradient(ellipse 68% 74% at 100% 37%, color-mix(in srgb, var(--sky-right) 34%, transparent), transparent 84%),
    linear-gradient(90deg, color-mix(in srgb, var(--sky-left) 12%, transparent), transparent 50%,
      color-mix(in srgb, var(--sky-right) 12%, transparent));
}
.bg-stars { width: 100%; height: 100%; }
.horizon {
  inset: 36% -20% 0;
  background: radial-gradient(ellipse at 50% 75%, rgba(211,188,142,.05), transparent 60%);
  animation: breathe 18s ease-in-out infinite alternate;
}
.paused .horizon { animation-play-state: paused; }
@keyframes breathe { to { transform: translateY(-16px); opacity: .5; } }
.sky-enter-active, .sky-leave-active { transition: opacity .65s ease; }
.sky-enter-from, .sky-leave-to { opacity: 0; }
</style>
