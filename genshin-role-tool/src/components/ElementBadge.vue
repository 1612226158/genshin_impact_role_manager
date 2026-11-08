<script setup>
import { computed } from 'vue'
import { elementColor, elementGlyph, elementIcon } from '@/utils/element'
import { assetUrl } from '@/utils/asset'

const props = defineProps({
  element: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
  showLabel: { type: Boolean, default: false },
})

const color = computed(() => elementColor(props.element))
const glyph = computed(() => elementGlyph(props.element))
const iconSrc = computed(() => {
  const p = elementIcon(props.element)
  return p ? assetUrl(p) : ''
})
</script>

<template>
  <span
    class="el"
    :class="[`is-${size}`]"
    :style="{ '--c': color }"
    :title="element || '无元素'"
  >
    <img v-if="iconSrc" class="el-img" :src="iconSrc" alt="" draggable="false" />
    <span v-else class="el-glyph" aria-hidden="true">{{ glyph }}</span>
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

.el-img,
.el-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.el-img {
  object-fit: contain;
  /* 图标本身自带元素色，容器只做极淡的色底衬托 */
  background: color-mix(in srgb, var(--c) 16%, transparent);
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--c) 45%, transparent));
}

.is-sm .el-img,
.is-sm .el-glyph {
  width: 18px;
  height: 18px;
  padding: 1px;
}

.is-md .el-img,
.is-md .el-glyph {
  width: 22px;
  height: 22px;
  padding: 2px;
}

.is-lg .el-img,
.is-lg .el-glyph {
  width: 30px;
  height: 30px;
  padding: 3px;
}

.is-sm .el-glyph,
.is-md .el-glyph,
.is-lg .el-glyph {
  border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
  font-family: var(--gs-font-display);
  line-height: 1;
}

.is-sm .el-glyph {
  font-size: 10px;
}

.is-md .el-glyph {
  font-size: 12px;
}

.is-lg .el-glyph {
  font-size: 15px;
}

.el-text {
  font-size: 13px;
}
</style>
