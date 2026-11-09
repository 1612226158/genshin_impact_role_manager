<script setup>
/** 骨架占位块：只用背景动画，不参与布局测量，尊重应用的动效开关 */
defineProps({
  w: { type: String, default: '100%' },
  h: { type: String, default: '14px' },
  radius: { type: String, default: '6px' },
})
</script>

<template>
  <span class="sk" :style="{ width: w, height: h, borderRadius: radius }" aria-hidden="true" />
</template>

<style scoped>
.sk {
  display: block;
  background: linear-gradient(90deg, rgba(237, 230, 214, 0.06) 25%, rgba(237, 230, 214, 0.13) 37%, rgba(237, 230, 214, 0.06) 63%);
  background-size: 400% 100%;
  animation: sk-shimmer 1.4s ease-in-out infinite;
}

/* 关闭动效时停在静态底色，避免持续动画 */
:global(html.no-motion) .sk {
  animation: none;
  background: rgba(237, 230, 214, 0.08);
}

@keyframes sk-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}
</style>
