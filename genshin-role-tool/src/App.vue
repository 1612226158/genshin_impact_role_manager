<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import Starfield from '@/components/Starfield.vue'
import TopBar from '@/components/TopBar.vue'
import ToastHost from '@/components/ToastHost.vue'
import { useSettingsStore } from '@/stores/settings'
import { useCharacterStore } from '@/stores/character'
import { useEditorStore } from '@/stores/editor'
const CharacterEditorModal = defineAsyncComponent(() => import('@/components/CharacterEditorModal.vue'))
const editor = useEditorStore()

// 应用根部激活动画开关监听：无论当前在哪个路由，<html>.no-motion 都随设置即时生效
const settings = useSettingsStore()
const route = useRoute()
const characters = useCharacterStore()
const sceneElement = computed(() => characters.get(route.params.id)?.element || '')

// 诊断开关：?nostarapp=1 不渲染星空组件（隔离 ResizeObserver + fixed canvas）
//           ?noview=1  不渲染路由视图与页脚（只留顶栏，隔离各页面内容）
const noStarApp = new URLSearchParams(location.search).has('nostarapp')
const noView = new URLSearchParams(location.search).has('noview')
</script>

<template>
  <Starfield v-if="!noStarApp" :element="sceneElement" :motion="settings.settings.motion !== 'off'" />
  <TopBar />
  <main v-if="!noView">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </main>
  <footer v-if="!noView" class="site-foot">
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
  <CharacterEditorModal v-if="editor.characterId" :key="editor.characterId" :character-id="editor.characterId" :return-focus="editor.opener" @close="editor.close" />
</template>

<style scoped>
main {
  position: relative;
  z-index: var(--gs-z-content);
  /* 固定顶栏（63px）的补偿偏移，防止页面内容被遮挡 */
  padding-top: 63px;
  min-height: calc(100vh - 63px - 68px);
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
