<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { assetUrl } from '@/utils/asset'
import { elementColor } from '@/utils/element'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  characters: { type: Array, required: true },
  label: { type: String, default: '选择角色' },
  exclude: { type: [String, Number], default: '' },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const kw = ref('')
const active = ref(0)
const root = ref(null)
const inputRef = ref(null)

const current = computed(() => props.characters.find((c) => String(c.id) === String(props.modelValue)) || null)

const list = computed(() => {
  const text = kw.value.trim().toLowerCase()
  const excluded = String(props.exclude || '')
  return props.characters
    .filter((c) => String(c.id) !== excluded)
    .filter((c) => {
      if (!text) return true
      const hay = `${c.name} ${c.title || ''} ${c.element || ''} ${c.affiliation || ''}`.toLowerCase()
      return hay.includes(text)
    })
    .slice(0, 60)
})

const avatar = (c) => assetUrl(c.images?.avatar || c.images?.avatar_hd || '')

function show() {
  open.value = true
  kw.value = ''
  active.value = 0
  nextTick(() => inputRef.value?.focus())
}
function choose(id) {
  emit('update:modelValue', id)
  open.value = false
}
function onKey(e) {
  if (!open.value) return
  if (e.key === 'Escape') {
    open.value = false
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = Math.min(active.value + 1, list.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const picked = list.value[active.value]
    if (picked) choose(picked.id)
  }
}
function outside(e) {
  if (!root.value?.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))

watch(list, () => {
  active.value = Math.min(active.value, Math.max(list.value.length - 1, 0))
})
</script>

<template>
  <div ref="root" class="picker">
    <button type="button" class="picker-trigger" :aria-label="label" :aria-expanded="open" @click="open ? (open = false) : show()">
      <template v-if="current">
        <img v-if="avatar(current)" class="pt-avatar" :src="avatar(current)" :alt="current.name" />
        <span class="pt-name">{{ current.name }}</span>
        <span class="pt-el" :style="{ '--c': elementColor(current.element) }">{{ current.element || '无' }}</span>
      </template>
      <span v-else class="pt-empty">{{ label }}</span>
      <span class="pt-caret" aria-hidden="true">⌄</span>
    </button>

    <div v-if="open" class="picker-panel" role="dialog" :aria-label="label">
      <input
        ref="inputRef"
        v-model="kw"
        type="text"
        class="picker-search"
        placeholder="搜索名称 / 称号 / 元素"
        aria-label="搜索角色"
        @keydown="onKey"
      />
      <ul class="picker-list" role="listbox">
        <li v-for="(c, i) in list" :key="c.id">
          <button
            type="button"
            class="picker-row"
            :class="{ 'is-active': i === active, 'is-current': String(c.id) === String(modelValue) }"
            role="option"
            :aria-selected="String(c.id) === String(modelValue)"
            @click="choose(c.id)"
            @pointermove="active = i"
          >
            <img v-if="avatar(c)" :src="avatar(c)" :alt="c.name" loading="lazy" />
            <span v-else class="row-ph">{{ (c.name || '?').slice(0, 1) }}</span>
            <span class="row-name">{{ c.name }}</span>
            <span class="row-meta">{{ c.element || '无' }} · {{ c.weapon || '—' }} · {{ c.star || '?' }}★</span>
          </button>
        </li>
        <li v-if="!list.length" class="picker-none">没有匹配的角色</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
}

.picker-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid var(--gs-line-hi);
  background: rgba(10, 30, 47, 0.72);
  color: var(--gs-ink);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.18s var(--gs-ease), background 0.18s var(--gs-ease);
}

.picker-trigger:hover,
.picker-trigger[aria-expanded='true'] {
  border-color: var(--gs-gold);
  background: rgba(23, 56, 78, 0.8);
}

.pt-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  background: #efe9df;
}

.pt-name {
  font-weight: 600;
}

.pt-el {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  color: var(--c, var(--gs-ink-2));
  border: 1px solid color-mix(in srgb, var(--c, #7c93a7) 45%, transparent);
}

.pt-empty {
  color: var(--gs-ink-3);
}

.pt-caret {
  margin-left: auto;
  color: var(--gs-ink-3);
  font-size: 12px;
}

.picker-panel {
  position: absolute;
  z-index: 30;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  padding: 8px;
  border-radius: 12px;
  border: 1px solid var(--gs-line-hi);
  background: #0c2438;
  box-shadow: 0 18px 44px #0007;
}

.picker-search {
  width: 100%;
  min-height: 36px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--gs-line-hi);
  background: #10293d;
  color: var(--gs-ink);
  font-size: 13px;
  outline: none;
}

.picker-search:focus {
  border-color: var(--gs-gold);
}

.picker-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}

.picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--gs-ink-2);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}

.picker-row.is-active {
  background: rgba(211, 188, 142, 0.14);
  color: var(--gs-ink);
}

.picker-row.is-current .row-name {
  color: var(--gs-gold-hi);
}

.picker-row img,
.row-ph {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #efe9df;
}

.row-ph {
  display: grid;
  place-items: center;
  color: #6b5a3e;
  font-size: 12px;
}

.row-name {
  flex-shrink: 0;
}

.row-meta {
  margin-left: auto;
  color: var(--gs-ink-3);
  font-size: 11.5px;
}

.picker-none {
  padding: 12px;
  text-align: center;
  color: var(--gs-ink-3);
  font-size: 12px;
}

@media (max-width: 900px) {
  .picker-panel {
    position: fixed;
    left: 12px;
    right: 12px;
    top: 120px;
  }
}
</style>
