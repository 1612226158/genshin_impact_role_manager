<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import ArtImage from './ArtImage.vue'
import CollageCanvas from './CollageCanvas.vue'
import { collageLayout, cropFraction } from '@/utils/collage'

const props = defineProps({ items: { type: Array, default: () => [] }, template: String, fit: String, portrait: Boolean })
const emit = defineEmits(['reorder', 'remove'])
const stage = ref(null), canvas = ref(null), sizes = ref({}), drag = ref(null)
const ghost = ref(null)
const sources = computed(() => props.items.map(i => i?.src || ''))
const flags = computed(() => props.items.map(i => props.portrait && i?.kind === 'official'))
const ratios = computed(() => props.items.map((item, i) => {
  const s = item ? sizes.value[item.src] : null
  return s ? s.w / (s.h * cropFraction(s.w, s.h, flags.value[i])) : .55
}))
const layout = computed(() => collageLayout(props.template, ratios.value))
const slots = computed(() => layout.value.cells.map((cell, i) => ({
  item: props.items[i], cell, key: props.items[i]?.aid || `empty-${i}`,
  portrait: flags.value[i],
})))
function styleFor(cell) {
  const [x, y, w, h] = cell
  return { left: `${x / layout.value.w * 100}%`, top: `${y / layout.value.h * 100}%`, width: `${w / layout.value.w * 100}%`, height: `${h / layout.value.h * 100}%` }
}
function reorder(from, to) {
  if (from === to || to < 0 || to >= props.items.length) return
  const ids = props.items.map(i => i?.aid || null)
  ;[ids[from], ids[to]] = [ids[to], ids[from]]
  emit('reorder', ids)
}
function down(event, slot) {
  if (!slot.item || event.button !== 0 || drag.value) return
  const rect = event.currentTarget.getBoundingClientRect()
  drag.value = { id: slot.item.aid, item: slot.item, portrait: slot.portrait, pointer: event.pointerId,
    x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY,
    offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
    w: rect.width, h: rect.height, started: false, original: props.items.map(i => i?.aid || null) }
  stage.value.setPointerCapture(event.pointerId)
}
function move(event) {
  const d = drag.value
  if (!d || d.releasing || d.pointer !== event.pointerId) return
  d.x = event.clientX; d.y = event.clientY
  if (!d.started && Math.hypot(d.x - d.startX, d.y - d.startY) < 6) return
  d.started = true
  const box = stage.value.getBoundingClientRect()
  const x = (d.x - box.left) / box.width * layout.value.w
  const y = (d.y - box.top) / box.height * layout.value.h
  const target = layout.value.cells.findIndex(([cx, cy, cw, ch]) => x >= cx && x <= cx + cw && y >= cy && y <= cy + ch)
  reorder(props.items.findIndex(i => i?.aid === d.id), target)
}
async function finish(event, cancel = false) {
  const d = drag.value
  if (!d || d.releasing || (event?.pointerId != null && event.pointerId !== d.pointer)) return
  if (!cancel && d.started && event?.type === 'pointerup') move(event)
  d.releasing = true
  if (cancel && d.started) emit('reorder', d.original)
  if (stage.value?.hasPointerCapture(d.pointer)) stage.value.releasePointerCapture(d.pointer)
  await nextTick()
  const destination = [...(stage.value?.querySelectorAll('.collage-slot') || [])].find(el => el.dataset.aid === d.id)
  if (d.started && ghost.value && destination && !document.documentElement.classList.contains('no-motion')) {
    const r = destination.getBoundingClientRect()
    const animation = ghost.value.animate([
      { left: `${d.x - d.offsetX}px`, top: `${d.y - d.offsetY}px`, width: `${d.w}px`, height: `${d.h}px`, transform: 'scale(1.04)' },
      { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, transform: 'scale(1)' },
    ], { duration: 220, easing: 'cubic-bezier(.22,.8,.25,1)', fill: 'forwards' })
    await animation.finished.catch(() => {})
  }
  if (drag.value === d) drag.value = null
}
function keyboard(event, i) {
  if (event.key === 'Escape') { finish(null, true); return }
  if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  reorder(i, i + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1))
}
watch(() => [props.template, props.fit, props.portrait], () => finish(null, true))
onBeforeUnmount(() => { drag.value = null })
defineExpose({ exportBlob: () => canvas.value?.exportBlob() })
</script>

<template>
  <div ref="stage" class="collage-editor" :style="{ aspectRatio: `${layout.w}/${layout.h}` }"
    @pointermove="move" @pointerup="finish" @pointercancel="finish($event, true)" @lostpointercapture="finish($event, true)">
    <TransitionGroup name="slot" tag="div" class="slot-layer">
      <div v-for="(slot, i) in slots" :key="slot.key" class="collage-slot" :class="{ empty: !slot.item, lifted: drag?.started && drag.id === slot.item?.aid }"
        :style="styleFor(slot.cell)" :data-aid="slot.item?.aid" :tabindex="slot.item ? 0 : -1"
        :role="slot.item ? 'group' : undefined" :aria-label="slot.item ? `${i + 1}：${slot.item.title}，可拖动；Alt 加方向键换位` : `空位 ${i + 1}`"
        @pointerdown="down($event, slot)" @keydown="keyboard($event, i)">
        <template v-if="slot.item">
          <ArtImage :src="slot.item.src" :alt="slot.item.title" :portrait="slot.portrait" :fit="fit" :cell-ratio="slot.cell[2] / slot.cell[3]"
            @size="sizes[slot.item.src] = $event" />
          <span class="slot-number">{{ i + 1 }}</span>
          <button class="slot-remove" type="button" :aria-label="`移除${slot.item.title}`" @pointerdown.stop @click.stop="emit('remove', slot.item.aid)">×</button>
        </template>
        <span v-else class="empty-mark">＋</span>
      </div>
    </TransitionGroup>
    <CollageCanvas ref="canvas" class="export-canvas" :sources="sources" :portraits="flags" :template="template" :fit="fit" />
    <Teleport to="body">
      <div v-if="drag?.started" ref="ghost" class="drag-ghost" :style="{ left: `${drag.x - drag.offsetX}px`, top: `${drag.y - drag.offsetY}px`, width: `${drag.w}px`, height: `${drag.h}px` }">
        <ArtImage :src="drag.item.src" :alt="drag.item.title" :portrait="drag.portrait" :fit="fit" :cell-ratio="drag.w / drag.h" />
      </div>
    </Teleport>
  </div>
  <p class="drag-help" aria-live="polite">{{ drag?.started ? '拖到目标位置即可换位' : '拖动图片调整顺序，也可用 Alt + 方向键' }}</p>
</template>

<style scoped>
.collage-editor { position: relative; width: 100%; background: #0b1b28; border-radius: 8px; box-shadow: 0 10px 30px #0004; }
.slot-layer { position: absolute; inset: 0; }
.collage-slot { position: absolute; overflow: hidden; border-radius: 5px; cursor: grab; touch-action: none; user-select: none; background: #0b1b28; }
.collage-slot.empty { border: 1px dashed var(--gs-line-hi); background: #ffffff05; cursor: default; }
.collage-slot.lifted { opacity: .2; }
.slot-move { transition: transform .32s cubic-bezier(.22,.8,.25,1); }
.slot-enter-active, .slot-leave-active { transition: opacity .18s; }
.slot-enter-from, .slot-leave-to { opacity: 0; }
.slot-number { position: absolute; top: 5px; left: 5px; width: 22px; height: 22px; display: grid; place-items: center; padding: 0; line-height: 1; border-radius: 50%; background: #071521c9; color: var(--gs-gold-hi); font-size: 11px; pointer-events: none; }
.slot-remove { position: absolute; top: 5px; right: 5px; width: 22px; height: 22px; display: grid; place-items: center; padding: 0 0 2px; line-height: 1; border-radius: 50%; background: #071521c9; color: var(--gs-ink); font-size: 18px; }
.empty-mark { position: absolute; inset: 0; display: grid; place-items: center; color: var(--gs-line-hi); }
.export-canvas { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.drag-ghost { position: fixed; z-index: 10000; pointer-events: none; overflow: hidden; background: #0b1b28; border: 2px solid var(--gs-gold); border-radius: 6px; box-shadow: 0 14px 30px #0008; transform: scale(1.04); }
.drag-help { color: var(--gs-ink-3); font-size: 11.5px; }
</style>
