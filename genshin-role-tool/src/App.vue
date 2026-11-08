<script setup>
import Starfield from '@/components/Starfield.vue'
import TopBar from '@/components/TopBar.vue'
import ToastHost from '@/components/ToastHost.vue'
import { useSettingsStore } from '@/stores/settings'

// 应用根部激活动画开关监听：无论当前在哪个路由，<html>.no-motion 都随设置即时生效
useSettingsStore()

// 诊断开关：?nostarapp=1 不渲染星空组件（隔离 ResizeObserver + fixed canvas）
const noStarApp = new URLSearchParams(location.search).has('nostarapp')
</script>

<template>
  <Starfield v-if="!noStarApp" />
  <TopBar />
  <main>
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </main>
  <footer class="site-foot">
    <p>
      角色名称、背景故事与图片素材版权归
      <span class="gold">miHoYo / HoYoverse</span>
      所有，本项目仅供个人学习研究，不作商业用途。
    </p>
    <p class="credit">
      元素与国度图标由画师
      <a
        href="https://www.miyoushe.com/ys/collection/2085279"
        target="_blank"
        rel="noopener noreferrer"
        >DanielPYC</a
      >
      手绘并无偿分享（米游社）
    </p>
  </footer>
  <ToastHost />
</template>

<style scoped>
main {
  position: relative;
  z-index: var(--gs-z-content);
  min-height: calc(100vh - 62px - 68px);
}

.site-foot {
  position: relative;
  z-index: var(--gs-z-content);
  padding: 22px 28px 30px;
  text-align: center;
  color: var(--gs-ink-3);
  font-size: 12px;
  border-top: 1px solid var(--gs-line);
  max-width: 1440px;
  margin: 0 auto;
}

.gold {
  color: var(--gs-gold);
}

.credit {
  margin-top: 6px;
  font-size: 11px;
  opacity: 0.85;
}
</style>
