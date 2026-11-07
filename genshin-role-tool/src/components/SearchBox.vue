<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '搜索角色名 / 称号 / 所属 / CV' },
})
const emit = defineEmits(['update:modelValue'])

const inner = ref(props.modelValue)
let timer = null

watch(
  () => props.modelValue,
  (v) => {
    if (v !== inner.value) inner.value = v
  }
)

function onInput(e) {
  inner.value = e.target.value
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => emit('update:modelValue', inner.value), 150)
}

function clear() {
  inner.value = ''
  emit('update:modelValue', '')
}

onBeforeUnmount(() => timer && clearTimeout(timer))
</script>

<template>
  <label class="search">
    <span class="icon" aria-hidden="true">⌕</span>
    <input
      type="search"
      :value="inner"
      :placeholder="placeholder"
      aria-label="搜索角色"
      @input="onInput"
    />
    <button v-if="inner" type="button" class="clear" aria-label="清空搜索" @click="clear">×</button>
  </label>
</template>

<style scoped>
.search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 36px;
  min-width: 260px;
  border: 1px solid var(--gs-line);
  border-radius: 999px;
  background: rgba(8, 24, 38, 0.6);
  transition: border-color 0.18s var(--gs-ease);
}

.search:focus-within {
  border-color: var(--gs-gold);
}

.icon {
  color: var(--gs-gold-deep);
  font-size: 15px;
  line-height: 1;
}

input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  outline: none;
  font-size: 13px;
  color: var(--gs-ink);
}

input::placeholder {
  color: var(--gs-ink-3);
}

input::-webkit-search-cancel-button {
  display: none;
}

.clear {
  color: var(--gs-ink-3);
  font-size: 16px;
  line-height: 1;
  padding: 2px 4px;
}

.clear:hover {
  color: var(--gs-gold);
}

@media (max-width: 900px) {
  .search {
    min-width: 0;
    flex: 1;
  }
}
</style>
