<script setup>
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

/* 主航区：常用页面 */
const primaryNavs = [
  { to: '/', label: '角色库', key: 'library' },
  { to: '/birthday', label: '生日', key: 'birthday' },
  { to: '/album', label: '相册', key: 'album' },
  { to: '/compare', label: '对比', key: 'compare' },
]

/* 右侧次航区：低频页面（记录 / 设置） */
const secondaryNavs = [
  { to: '/history', label: '记录', key: 'history' },
  { to: '/settings', label: '设置', key: 'settings' },
]

const activeKey = computed(() => route.meta?.nav || '')
</script>

<template>
  <header class="topbar">
    <div class="bar-inner">
      <RouterLink to="/" class="brand">
        <span class="brand-mark" aria-hidden="true">◇</span>
        <span class="brand-text">
          <strong>原神</strong>
          <em>角色工具</em>
        </span>
      </RouterLink>

      <nav class="nav" aria-label="主导航">
        <RouterLink
          v-for="n in primaryNavs"
          :key="n.key"
          :to="n.to"
          class="nav-item"
          :class="{ 'is-active': activeKey === n.key }"
        >
          {{ n.label }}
        </RouterLink>
      </nav>

      <div class="tail">
        <slot name="tail" />
      </div>

      <nav class="nav-sub" aria-label="次级导航">
        <RouterLink
          v-for="n in secondaryNavs"
          :key="n.key"
          :to="n.to"
          class="nav-item sub-item"
          :class="{ 'is-active': activeKey === n.key }"
        >
          {{ n.label }}
        </RouterLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  /* fixed 而非 sticky：钉死在视口顶部，不依赖滚动容器机制
     （sticky 在特定 Edge 版本下会被窗口管理故障波及） */
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 63px;
  z-index: var(--gs-z-bar);
  backdrop-filter: blur(14px);
  background: linear-gradient(180deg, rgba(7, 21, 33, 0.92), rgba(7, 21, 33, 0.62));
  border-bottom: 1px solid var(--gs-line);
}

.bar-inner {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 28px;
  height: 62px;
  display: flex;
  align-items: center;
  gap: 28px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--gs-ink);
  flex-shrink: 0;
}

.brand-mark {
  color: var(--gs-gold);
  font-size: 18px;
  line-height: 1;
}

.brand-text {
  display: flex;
  align-items: baseline;
  gap: 7px;
  font-family: var(--gs-font-display);
}

.brand-text strong {
  font-size: 18px;
  letter-spacing: 0.12em;
  color: var(--gs-gold-hi);
}

.brand-text em {
  font-style: normal;
  font-size: 12px;
  letter-spacing: 0.16em;
  color: var(--gs-ink-3);
}

.nav {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.nav-item {
  position: relative;
  padding: 0 14px;
  height: 62px;
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  color: var(--gs-ink-2);
  transition: color 0.18s var(--gs-ease);
}

.nav-item:hover {
  color: var(--gs-ink);
}

.nav-item.is-active {
  color: var(--gs-gold-hi);
}

.nav-item.is-active::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gs-gold), transparent);
}

.tail {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 右侧次级导航：沿用主导航的选中样式（金色文字 + 底部渐变下划线），
   仅字号与左右内距略小，视觉权重略低 */
.nav-sub {
  display: flex;
  align-items: center;
  gap: 0;
  margin-left: -12px;
  padding-left: 12px;
  border-left: 1px solid var(--gs-line);
}

.sub-item {
  padding: 0 10px;
  font-size: 13px;
}

.sub-item.is-active::after {
  left: 10px;
  right: 10px;
}

@media (max-width: 900px) {
  .bar-inner {
    padding: 0 16px;
    gap: 12px;
    height: 56px;
  }
  .brand-text em {
    display: none;
  }
  .nav-item {
    padding: 0 9px;
    height: 56px;
    font-size: 13px;
  }
  .nav-item.is-active::after {
    left: 9px;
    right: 9px;
    bottom: 11px;
  }
}
</style>
