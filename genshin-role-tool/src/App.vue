<script setup>
import Starfield from '@/components/Starfield.vue'
import TopBar from '@/components/TopBar.vue'
import ToastHost from '@/components/ToastHost.vue'
</script>

<template>
  <Starfield />
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
</style>
