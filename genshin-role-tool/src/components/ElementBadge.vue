<script setup>
import { computed } from 'vue'
import { elementColor, elementGlyph } from '@/utils/element'

const props = defineProps({
  element: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
  showLabel: { type: Boolean, default: false },
})

const color = computed(() => elementColor(props.element))
const glyph = computed(() => elementGlyph(props.element))
</script>

<template>
  <span
    class="el"
    :class="[`is-${size}`]"
    :style="{ '--c': color }"
    :title="element || '无元素'"
  >
    <span class="el-glyph" aria-hidden="true">{{ glyph }}</span>
    <span v-if="showLabel" class="el-text">{{ element || '无元素' }}</span>
  </span>
</template>

<style scoped>
.el {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--c);
}

.el-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
  background: color-mix(in srgb, var(--c) 14%, transparent);
  font-family: var(--gs-font-display);
  line-height: 1;
}

.is-sm .el-glyph {
  width: 18px;
  height: 18px;
  font-size: 10px;
}

.is-md .el-glyph {
  width: 22px;
  height: 22px;
  font-size: 12px;
}

.is-lg .el-glyph {
  width: 30px;
  height: 30px;
  font-size: 15px;
}

.el-text {
  font-size: 13px;
}
</style>
