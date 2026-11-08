<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { assetUrl } from '@/utils/asset'

const props = defineProps({
  characters: { type: Array, required: true },
  activeId: { type: [String, Number], required: true },
})
const emit = defineEmits(['select'])
const railRef = ref(null)
let frame = 0
let observer
let mounted = false

function stop() {
  cancelAnimationFrame(frame)
  frame = 0
}

function locate() {
  stop()
  const rail = railRef.value
  const item = rail?.querySelector('.rail-item.on')
  if (!item) return
  const horizontal = getComputedStyle(rail).flexDirection === 'row'
  const axis = horizontal ? 'scrollLeft' : 'scrollTop'
  const rect = item.getBoundingClientRect()
  const box = rail.getBoundingClientRect()
  const start = rail[axis]
  const offset = horizontal ? rect.left - box.left : rect.top - box.top
  const size = horizontal ? rail.clientWidth : rail.clientHeight
  const itemSize = horizontal ? item.clientWidth : item.clientHeight
  const max = horizontal ? rail.scrollWidth - size : rail.scrollHeight - size
  const target = Math.max(0, Math.min(max, start + offset - (size - itemSize) / 2))
  if (document.documentElement.classList.contains('no-motion') || Math.abs(target - start) < 2) {
    rail[axis] = target
    return
  }
  const t0 = performance.now()
  const step = (now) => {
    if (document.documentElement.classList.contains('no-motion')) {
      rail[axis] = target
      stop()
      return
    }
    const p = Math.min(1, (now - t0) / 380)
    rail[axis] = start + (target - start) * (1 - (1 - p) ** 3)
    frame = p < 1 ? requestAnimationFrame(step) : 0
  }
  frame = requestAnimationFrame(step)
}

watch(() => props.activeId, async () => {
  await nextTick()
  if (mounted) locate()
})
onMounted(() => {
  mounted = true
  observer = new ResizeObserver(locate)
  observer.observe(railRef.value)
  locate()
})
onBeforeUnmount(() => {
  mounted = false
  stop()
  observer?.disconnect()
})
</script>

<template>
  <nav ref="railRef" class="rail" aria-label="角色切换" @wheel.passive="stop" @pointerdown="stop" @keydown="stop">
    <button v-for="c in characters" :key="c.id" type="button" class="rail-item"
      :class="{ on: String(c.id) === String(activeId) }" :title="c.name"
      :aria-current="String(c.id) === String(activeId) ? 'true' : undefined"
      @click="emit('select', c.id)">
      <img v-if="c.images?.avatar || c.images?.avatar_hd"
        :src="assetUrl(c.images.avatar || c.images.avatar_hd)" :alt="c.name" loading="lazy" />
      <span v-else class="rail-fallback">{{ (c.name || '?').slice(0, 1) }}</span>
    </button>
  </nav>
</template>

<style scoped>
.rail {
  position: relative;
  flex: 0 0 46px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  padding: 16px 3px;
  scrollbar-width: none;
  overscroll-behavior: contain;
}
.rail::-webkit-scrollbar { display: none; }
.rail-item {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  padding: 0;
  border-radius: 50%;
  border: 2px solid rgba(237,230,214,.18);
  opacity: .6;
  transition: opacity .18s var(--gs-ease), border-color .18s var(--gs-ease), box-shadow .18s var(--gs-ease);
}
.rail-item img, .rail-fallback {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: #efe9df;
}
.rail-fallback { display: grid; place-items: center; color: #8a7c66; }
.rail-item:hover { opacity: .95; border-color: #d3bc8e; }
.rail-item.on {
  opacity: 1;
  border-color: #f5f2ea;
  box-shadow: 0 0 0 2px rgba(211,188,142,.55), 0 0 16px rgba(211,188,142,.25);
}
@media (max-width: 1200px) { .rail-item { width: 32px; height: 32px; } }
@media (max-width: 900px) {
  .rail { flex: 0 0 auto; width: 100%; flex-direction: row; max-height: none; overflow-x: auto; overflow-y: hidden; padding: 6px 3px; }
  .rail-item { width: 36px; height: 36px; }
}
</style>
