<script setup>
/** 叠加卡片式立绘：与编辑弹窗的 editor-art 同一套视觉（倾斜叠层 + 投影 + 装饰边框） */
import { computed } from 'vue'
import { assetUrl } from '@/utils/asset'

const props = defineProps({
  srcs: { type: Array, default: () => [] },
  alt: { type: String, default: '角色立绘' },
  height: { type: String, default: '300px' },
  placeholder: { type: String, default: '暂无立绘' },
  /** 兼容纯路径数组或 { file } 对象数组 */
  keyByFile: Boolean,
})

const list = computed(() =>
  props.srcs
    .map((s) => (typeof s === 'string' ? s : s?.file))
    .filter(Boolean)
    .slice(0, 3)
)
</script>

<template>
  <div class="painting-stack" :style="{ '--stack-h': height }">
    <img
      v-for="(src, i) in list"
      :key="src"
      :src="assetUrl(src)"
      :alt="alt"
      :style="{ '--layer': i }"
      draggable="false"
      loading="lazy"
    />
    <div v-if="!list.length" class="painting-placeholder">{{ placeholder }}</div>
  </div>
</template>

<style scoped>
.painting-stack {
  position: relative;
  /* 图片是绝对定位，不参与内在宽度计算；必须显式占满父容器，
     否则在 align-items:center 的 flex 容器里会收缩成 0 宽 */
  width: 100%;
  height: var(--stack-h, 300px);
  perspective: 1000px;
}

.painting-stack img {
  position: absolute;
  width: 90%;
  height: 100%;
  left: 5%;
  top: 0;
  object-fit: contain;
  border-radius: 8px;
  filter: drop-shadow(0 15px 20px #0008);
  transform: translate(calc(var(--layer) * 9px), calc(var(--layer) * -10px)) rotate(calc((var(--layer) - 1) * 5deg));
  z-index: calc(4 - var(--layer));
}

/* 叠层装饰卡：即使只有一张立绘也保留「卡片堆」的观感；
   左右内缩更大，让装饰框贴合窄长的立绘，而不是横向撑满 */
.painting-stack::before,
.painting-stack::after {
  content: '';
  position: absolute;
  inset: 18px 26%;
  border: 1px solid var(--gs-line-hi);
  border-radius: 10px;
  background: #18374d88;
  transform: rotate(7deg);
  z-index: -1;
}

.painting-stack::after {
  transform: rotate(-5deg);
}

.painting-placeholder {
  display: grid;
  place-content: center;
  height: 100%;
  text-align: center;
  color: var(--gs-ink-3);
  line-height: 2;
}

/* 窄屏收紧高度，避免立绘区挤占对比表 */
@media (max-width: 900px) {
  .painting-stack {
    height: min(200px, var(--stack-h));
  }
}
</style>
