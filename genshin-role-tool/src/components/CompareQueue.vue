<script setup>
import { useCompareQueueStore } from '@/stores/compareQueue'
import { assetUrl } from '@/utils/asset'

const queue = useCompareQueueStore()
</script>

<template>
  <Transition name="fade">
    <aside v-if="queue.entries.length" class="compare-queue gs-panel" aria-labelledby="compare-queue-title">
      <RouterLink v-if="!queue.full" class="queue-detail" :to="`/c/${queue.entries[0].id}`"
        :aria-label="`查看${queue.entries[0].name}详情`" :title="`查看${queue.entries[0].name}详情`" />
      <header>
        <h2 id="compare-queue-title">对比队列</h2>
        <span class="queue-count nums" aria-live="polite">{{ queue.entries.length }} / 2</span>
      </header>
      <ul>
        <li v-for="character in queue.entries" :key="character.id" class="queue-entry">
          <img v-if="character.images?.avatar || character.images?.avatar_hd"
            :src="assetUrl(character.images.avatar || character.images.avatar_hd)" alt="" />
          <span>{{ character.name }}</span>
          <button type="button" class="queue-remove" :disabled="queue.full"
            :aria-label="`从对比队列移除${character.name}`" @click="queue.remove(character.id)">×</button>
        </li>
      </ul>
      <p>{{ queue.full ? '正在打开对比…' : '再加入一位角色即可开始对比' }}</p>
    </aside>
  </Transition>
</template>

<style scoped>
.compare-queue {
  position: fixed;
  z-index: var(--gs-z-drawer);
  right: 24px;
  bottom: 24px;
  width: min(235px, calc(100vw - 32px));
  padding: 12px 14px;
  border-color: var(--gs-line-hi);
  background: color-mix(in srgb, var(--gs-panel-solid) 92%, transparent);
  box-shadow: 0 12px 34px #030c1790;
}

.queue-detail {
  position: absolute;
  z-index: 1;
  inset: 0;
  border-radius: inherit;
}

.queue-detail:hover,
.queue-detail:focus-visible {
  outline: 1px solid var(--gs-gold);
  outline-offset: 1px;
}

header,
.queue-entry {
  display: flex;
  align-items: center;
  gap: 8px;
}

header {
  justify-content: space-between;
}

h2 {
  color: var(--gs-gold-hi);
  font-size: 14px;
}

.queue-count,
p {
  color: var(--gs-ink-2);
  font-size: 12px;
}

ul {
  display: grid;
  gap: 5px;
  margin: 8px 0;
  padding: 0;
  list-style: none;
}

.queue-entry {
  padding: 4px 6px;
  border-radius: 8px;
  background: #ffffff0a;
  font-size: 13px;
}

.queue-entry img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.queue-remove {
  position: relative;
  z-index: 2;
  flex: 0 0 28px;
  height: 28px;
  margin-left: auto;
  border-radius: 50%;
  color: var(--gs-ink-2);
}

.queue-remove:hover:not(:disabled) {
  background: #ffffff12;
  color: var(--gs-ink);
}

@media (max-width: 600px) {
  .compare-queue {
    right: 12px;
    bottom: 12px;
  }
}
</style>
