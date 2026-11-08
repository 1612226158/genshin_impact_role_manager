<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = defineProps({ front: String, back: String, name: String })
const flipped = ref(false)
const inner = ref(null)
const box = ref({ w: 0, h: 0 })
const frontSize = ref({ w: 0, h: 0 }), backSize = ref({ w: 0, h: 0 })
let observer
function fit(size) {
  if (!size.w || !box.value.w) return { maxWidth: '100%', maxHeight: '100%' }
  const scale = Math.min(box.value.w / size.w, box.value.h / size.h)
  return { width: `${size.w * scale}px`, height: `${size.h * scale}px` }
}
function loaded(event, side) {
  const size = { w: event.target.naturalWidth, h: event.target.naturalHeight }
  if (side === 'front') frontSize.value = size
  else backSize.value = size
}
watch(() => [props.front, props.back], () => {
  flipped.value = false
  frontSize.value = { w: 0, h: 0 }; backSize.value = { w: 0, h: 0 }
})
onMounted(() => {
  observer = new ResizeObserver(([entry]) => { box.value = { w: entry.contentRect.width, h: entry.contentRect.height } })
  observer.observe(inner.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <button type="button" class="flip-artwork" :class="{ flipped }" :disabled="!back" :aria-pressed="flipped"
    :aria-label="`${name}：${flipped ? '点击翻回海报' : '点击翻至高清头像'}`" @click="flipped = !flipped">
    <span ref="inner" class="flip-inner">
      <span class="flip-face front" :aria-hidden="flipped"><img :src="front" :style="fit(frontSize)" :alt="`${name} 海报`" draggable="false" @load="loaded($event, 'front')" /></span>
      <span class="flip-face back-face" :aria-hidden="!flipped"><img :src="back || front" :style="fit(backSize)" :alt="`${name} 高清头像`" draggable="false" @load="loaded($event, 'back')" /></span>
    </span>
    <span v-if="back" class="flip-hint">{{ flipped ? '点击翻回海报' : '点击翻至高清头像' }} <span aria-hidden="true">⟳</span></span>
  </button>
</template>

<style scoped>
.flip-artwork { position: relative; width: 100%; height: min(820px, calc(100vh - 250px)); min-height: 240px; padding: 0 0 26px; perspective: 1400px; transition: height .34s var(--gs-ease); }
.flip-inner { position: relative; display: block; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .65s cubic-bezier(.2,.75,.25,1); }
.flipped .flip-inner { transform: rotateY(180deg); }
.flip-face { position: absolute; inset: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.back-face { transform: rotateY(180deg); }
.flip-face img {
  max-height: 100%;
  max-width: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 16px 40px #0007;
  outline: 1px solid var(--gs-line-hi);
  /* 尺寸随 ResizeObserver 每帧重算，天然连续；
     不要再对 width/height 加过渡——宽高若不同步会短暂破坏图片比例 */
}
.flip-hint { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; color: var(--gs-ink-2); font-size: 11.5px; }
.flip-hint span { color: var(--gs-gold); margin-left: 5px; }
@media (max-width: 900px) { .flip-artwork { height: 58vh; } }
</style>
