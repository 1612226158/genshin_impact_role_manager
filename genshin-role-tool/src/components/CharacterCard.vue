<script setup>
import { computed } from 'vue'
import ElementBadge from './ElementBadge.vue'
import { assetUrl } from '@/utils/asset'
import { rarityColors } from '@/utils/element'

const props = defineProps({
  character: { type: Object, required: true },
  edited: { type: Boolean, default: false },
  custom: { type: Boolean, default: false },
  /** 首屏内可见的卡片立即加载，其余懒加载，兼顾首屏稳定与总流量 */
  priority: { type: Boolean, default: false },
})

const img = computed(
  () => props.character.images?.avatar_hd || props.character.images?.avatar || ''
)
const rc = computed(() => rarityColors(props.character.star))
const stars = computed(() => '★'.repeat(props.character.star || 0))
</script>

<template>
  <article
    class="card"
    :class="{ 'is-broken': !character.playable }"
    :style="{ '--ra': rc.a, '--rb': rc.b }"
  >
    <div class="art">
      <img
        v-if="img"
        :src="assetUrl(img)"
        :alt="character.name"
        :loading="priority ? 'eager' : 'lazy'"
        :fetchpriority="priority ? 'high' : 'auto'"
        decoding="async"
        @error="$event.target.classList.add('is-fail')"
      />
      <div v-else class="art-empty">{{ (character.name || '?').slice(0, 1) }}</div>

      <span class="badge">
        <ElementBadge :element="character.element" size="sm" />
      </span>

      <span v-if="custom" class="flag flag-custom">自建</span>
      <span v-else-if="edited" class="flag flag-edit">已改</span>
    </div>

    <div class="label">
      <span class="name">{{ character.name }}</span>
      <span v-if="character.variant" class="variant">{{ character.variant }}</span>
      <span class="stars" :aria-label="`${character.star || 0} 星`">{{ stars }}</span>
    </div>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  border-radius: var(--gs-radius-card);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--gs-line);
  /* 与官方立绘自带的浅灰底同色，使图片边缘无缝融入卡面 */
  background: #f7f5f4;
  transition: transform 0.18s var(--gs-ease), box-shadow 0.18s var(--gs-ease),
    border-color 0.18s var(--gs-ease);
}

/* 稀有度：顶部细条 + 底部微光，不做整面叠色，避免污染人物色彩 */
.card::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--ra), var(--rb));
  z-index: 3;
  pointer-events: none;
}

.card::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 34%;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--ra) 10%, transparent));
  z-index: 1;
  pointer-events: none;
}

.card:hover {
  transform: translateY(-3px);
  border-color: var(--gs-line-hi);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(211, 188, 142, 0.18);
}

.art {
  position: relative;
  aspect-ratio: 686 / 800;
  overflow: hidden;
}

.art img {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  transition: transform 0.3s var(--gs-ease);
}

.card:hover .art img {
  transform: scale(1.035);
}

.art img.is-fail {
  opacity: 0;
}

.art-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--gs-font-display);
  font-size: 44px;
  color: #c3b28c;
}

.badge {
  position: absolute;
  z-index: 3;
  left: 7px;
  top: 7px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(10, 26, 40, 0.32);
  border: 1px solid rgba(237, 230, 214, 0.15);
  backdrop-filter: blur(2px);
}
.badge :deep(.el) { display: flex; align-items: center; justify-content: center; line-height: 1; }

.flag {
  position: absolute;
  z-index: 3;
  right: 7px;
  top: 7px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: #1a1208;
}

.flag-custom {
  background: linear-gradient(180deg, #f2e4c4, #d3bc8e);
}

.flag-edit {
  background: rgba(10, 26, 40, 0.8);
  color: var(--gs-gold-hi);
  border: 1px solid var(--gs-line-hi);
}

.label {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  background: linear-gradient(180deg, rgba(16, 32, 46, 0.92), rgba(9, 20, 31, 0.96));
  border-top: 1px solid rgba(211, 188, 142, 0.22);
}

.name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--gs-ink);
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.variant {
  font-size: 10px;
  color: var(--gs-ink-3);
  flex-shrink: 0;
}

.stars {
  margin-left: auto;
  font-size: 9px;
  letter-spacing: 0.5px;
  color: var(--gs-gold);
  flex-shrink: 0;
}

.is-broken .art img {
  filter: grayscale(0.85);
  opacity: 0.75;
}
</style>
