<script setup>
import { computed, ref, watch } from 'vue'
import { cropFraction, fittedRect } from '@/utils/collage'

const props = defineProps({
  src: { type: String, default: '' }, alt: { type: String, default: '' },
  portrait: Boolean, fit: { type: String, default: 'natural' },
  cellRatio: { type: Number, default: 1 }, lazy: Boolean,
})
const emit = defineEmits(['size'])
const size = ref({ w: 1, h: 1 })
const fraction = computed(() => cropFraction(size.value.w, size.value.h, props.portrait))
const ratio = computed(() => size.value.w / (size.value.h * fraction.value))
const frameStyle = computed(() => {
  if (props.fit === 'natural') return { width: '100%', height: '100%' }
  const r = fittedRect(ratio.value, 1, props.cellRatio, 1, props.fit)
  return { left: `${r.x / props.cellRatio * 100}%`, top: `${r.y * 100}%`, width: `${r.w / props.cellRatio * 100}%`, height: `${r.h * 100}%` }
})
function loaded(event) {
  const img = event.target
  size.value = { w: img.naturalWidth, h: img.naturalHeight }
  emit('size', size.value)
}
watch(() => props.src, () => { size.value = { w: 1, h: 1 } })
</script>

<template>
  <div class="art-image" :class="{ natural: fit === 'natural' }" :style="fit === 'natural' ? { aspectRatio: ratio } : undefined">
    <div class="image-frame" :class="{ faded: fraction < 1 }" :style="frameStyle">
      <img :src="src" :alt="alt" :loading="lazy ? 'lazy' : 'eager'" draggable="false"
        :style="{ height: `${100 / fraction}%` }" @load="loaded" />
    </div>
  </div>
</template>

<style scoped>
.art-image { position: relative; width: 100%; height: 100%; overflow: hidden; }
.art-image.natural { height: auto; }
.image-frame { position: absolute; overflow: hidden; }
.image-frame img { width: 100%; max-width: none; display: block; }
.faded { mask-image: linear-gradient(to bottom, #000 0%, #000 82%, transparent 100%); }
</style>
