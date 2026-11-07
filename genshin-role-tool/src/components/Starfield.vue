<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const canvasRef = ref(null)
let ctx = null
let ro = null

/** 星点与光斑种子固定，保证每次渲染一致（避免刷新后布局跳动） */
let seed = 20261107
function rnd() {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}

function draw() {
  const el = canvasRef.value
  if (!el || !ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = el.clientWidth
  const h = el.clientHeight
  el.width = Math.floor(w * dpr)
  el.height = Math.floor(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  seed = 20261107
  const count = Math.round((w * h) / 9000)
  const total = Math.max(140, Math.min(320, count))

  for (let i = 0; i < total; i += 1) {
    const x = rnd() * w
    const y = rnd() * h
    const r = 0.35 + rnd() * 1.25
    const a = 0.12 + rnd() * 0.6
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(226, 240, 255, ${a.toFixed(3)})`
    ctx.fill()
  }

  // 少量偏金色的亮星，呼应金线
  for (let i = 0; i < 18; i += 1) {
    const x = rnd() * w
    const y = rnd() * h
    const r = 0.7 + rnd() * 1.1
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(242, 228, 196, ${(0.35 + rnd() * 0.4).toFixed(3)})`
    ctx.fill()
  }
}

onMounted(() => {
  ctx = canvasRef.value?.getContext('2d') || null
  draw()
  ro = new ResizeObserver(() => draw())
  ro.observe(document.documentElement)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  ctx = null
})
</script>

<template>
  <div class="starfield" aria-hidden="true">
    <div class="bg-grad"></div>
    <canvas ref="canvasRef" class="bg-stars"></canvas>
    <div class="blob blob-a"></div>
    <div class="blob blob-b"></div>
    <div class="blob blob-c"></div>
  </div>
</template>

<style scoped>
.starfield {
  position: fixed;
  inset: 0;
  z-index: var(--gs-z-bg);
  pointer-events: none;
  overflow: hidden;
}

.bg-grad {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 50% -10%, #16405f 0%, rgba(22, 64, 95, 0) 58%),
    linear-gradient(170deg, var(--gs-bg-2) 0%, var(--gs-bg-1) 38%, var(--gs-bg-0) 100%);
}

.bg-stars {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.5;
  animation: breathe 16s ease-in-out infinite;
}

.blob-a {
  width: 46vw;
  height: 46vw;
  left: -10vw;
  top: -12vw;
  background: radial-gradient(circle, rgba(58, 138, 176, 0.35), transparent 68%);
}

.blob-b {
  width: 38vw;
  height: 38vw;
  right: -8vw;
  top: 18vh;
  background: radial-gradient(circle, rgba(122, 96, 156, 0.24), transparent 70%);
  animation-delay: -5s;
}

.blob-c {
  width: 52vw;
  height: 40vw;
  left: 22vw;
  bottom: -18vw;
  background: radial-gradient(circle, rgba(211, 188, 142, 0.14), transparent 72%);
  animation-delay: -9s;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1) translateY(0);
    opacity: 0.42;
  }
  50% {
    transform: scale(1.08) translateY(-12px);
    opacity: 0.62;
  }
}

@media (prefers-reduced-motion: reduce) {
  .blob {
    animation: none;
  }
}
</style>
