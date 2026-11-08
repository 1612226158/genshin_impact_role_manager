<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true },
  label: String,
  compact: Boolean,
  /** 外部已有字段标题时隐藏组件内的可见 label（label 仍用于无障碍命名） */
  hideLabel: Boolean,
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const root = ref(null), trigger = ref(null), open = ref(false), active = ref(0), above = ref(false)
const id = useId()
const selected = computed(() => props.options.find(o => String(o.value) === String(props.modelValue)))
const empty = computed(() => props.modelValue === '' || props.modelValue === null || props.modelValue === undefined)
function show() {
  active.value = Math.max(0, props.options.findIndex(o => String(o.value) === String(props.modelValue)))
  above.value = innerHeight - trigger.value.getBoundingClientRect().bottom < Math.min(260, props.options.length * 48)
  open.value = true
}
function choose(i) {
  emit('update:modelValue', props.options[i].value)
  open.value = false
  trigger.value.focus({ preventScroll: true })
}
async function key(event) {
  if (event.key === 'Escape') { open.value = false; return }
  if (event.key === 'Tab') { open.value = false; return }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return
  event.preventDefault()
  if (!open.value) { show(); return }
  if (event.key === 'Enter' || event.key === ' ') { choose(active.value); return }
  if (event.key === 'Home') active.value = 0
  else if (event.key === 'End') active.value = props.options.length - 1
  else active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + props.options.length) % props.options.length
  await nextTick()
  root.value.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
}
function outside(e) { if (!root.value?.contains(e.target)) open.value = false }
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="styled-select" :class="{ expanded: open, compact }">
    <span v-if="!compact && label && !hideLabel" class="select-label">{{ label }}</span>
    <button ref="trigger" type="button" class="select-trigger" role="combobox" :aria-label="label"
      :aria-expanded="open" :aria-controls="`${id}-list`" aria-haspopup="listbox"
      :aria-activedescendant="open ? `${id}-${active}` : undefined" @click="open ? open = false : show()" @keydown="key">
      <span class="sel-value">
        <img v-if="selected?.icon" class="opt-icon" :src="selected.icon" alt="" draggable="false" />
        <span class="sel-text" :class="{ placeholder: empty }">{{ selected?.label ?? placeholder }}</span>
      </span>
      <span class="chevron" aria-hidden="true">⌄</span>
    </button>
    <Transition name="options">
      <div v-if="open" :id="`${id}-list`" role="listbox" :aria-label="label" class="option-list" :class="{ above }">
        <div v-for="(option, i) in options" :id="`${id}-${i}`" :key="option.value" role="option"
          :aria-selected="String(modelValue) === String(option.value)" :data-active="active === i" class="select-option"
          @pointermove="active = i" @click="choose(i)">
          <span class="opt-main">
            <img v-if="option.icon" class="opt-icon" :src="option.icon" alt="" draggable="false" />
            <span>{{ option.label }}</span>
          </span>
          <span v-if="String(modelValue) === String(option.value)" class="opt-check" aria-hidden="true">✓</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.styled-select { position: relative; min-width: 0; }
.styled-select.expanded { z-index: 8; }
.compact .select-trigger { min-height: 36px; height: 36px; padding: 0 12px; border-radius: 999px; }
.compact .option-list.above { bottom: calc(100% + 5px); }
.select-label { display: block; color: var(--gs-ink-2); font-size: 12px; margin-bottom: 5px; }
.select-trigger { width: 100%; min-height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; border: 1px solid var(--gs-line-hi); border-radius: 8px; background: #10293d; font-size: 13px; text-align: left; transition: border-color .18s, background .18s; }
.select-trigger:hover, .expanded .select-trigger { border-color: var(--gs-gold); background: #17384e; }
.sel-value { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sel-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sel-text.placeholder { color: var(--gs-ink-3); }
.opt-icon { width: 18px; height: 18px; flex: 0 0 18px; object-fit: contain; display: block; }
.chevron { color: var(--gs-gold); transition: transform .2s; flex: 0 0 auto; }
.expanded .chevron { transform: rotate(180deg); }
.option-list { position: absolute; top: calc(100% + 5px); left: 0; right: 0; padding: 5px; max-height: 250px; overflow: auto; background: #10293d; border: 1px solid var(--gs-line-hi); border-radius: 10px; box-shadow: 0 12px 32px #0008; }
.option-list.above { top: auto; bottom: calc(100% - 16px); }
.select-option { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 10px; font-size: 13px; border-radius: 6px; cursor: pointer; color: var(--gs-ink-2); }
.opt-main { display: flex; align-items: center; gap: 8px; min-width: 0; }
.opt-check { color: var(--gs-gold-hi); flex: 0 0 auto; }
.select-option[data-active=true] { background: #214257; color: var(--gs-ink); }
.select-option[aria-selected=true] { color: var(--gs-gold-hi); background: #d3bc8e18; }
.options-enter-active, .options-leave-active { transition: opacity .16s, transform .16s; }
.options-enter-from, .options-leave-to { opacity: 0; transform: translateY(-5px); }
</style>
