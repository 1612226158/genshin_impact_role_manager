<script setup>
defineProps({
  label: { type: String, default: '' },
  options: { type: Array, required: true },
  modelValue: { type: [String, Number], default: '全部' },
  allLabel: { type: String, default: '全部' },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="chip-row">
    <span v-if="label" class="chip-label">{{ label }}</span>
    <div class="chips">
      <button
        type="button"
        class="gs-pill"
        :class="{ 'is-on': modelValue === '全部' }"
        @click="emit('update:modelValue', '全部')"
      >
        {{ allLabel }}
        <em v-if="options.length" class="cnt">{{ options.reduce((s, o) => s + o.count, 0) }}</em>
      </button>
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        class="gs-pill"
        :class="{ 'is-on': String(modelValue) === String(o.value) }"
        @click="emit('update:modelValue', o.value)"
      >
        {{ o.value }}
        <em v-if="o.count != null" class="cnt">{{ o.count }}</em>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chip-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 7px 0;
}

.chip-label {
  flex-shrink: 0;
  width: 42px;
  padding-top: 7px;
  font-size: 12px;
  color: var(--gs-ink-3);
  letter-spacing: 0.08em;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.cnt {
  font-style: normal;
  font-size: 11px;
  opacity: 0.72;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 900px) {
  .chip-row {
    flex-direction: column;
    gap: 6px;
  }
  .chip-label {
    width: auto;
    padding-top: 0;
  }
}
</style>
