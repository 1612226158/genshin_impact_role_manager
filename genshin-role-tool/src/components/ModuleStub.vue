<script setup>
import PageHead from '@/components/PageHead.vue'

defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  stage: { type: String, default: '' },
  items: { type: Array, default: () => [] },
})
</script>

<template>
  <div class="page">
    <PageHead :eyebrow="eyebrow" :title="title" :desc="desc" />
    <div class="stub gs-panel">
      <p class="stub-stage">{{ stage }}</p>
      <ul v-if="items.length" class="stub-list">
        <li v-for="it in items" :key="it">{{ it }}</li>
      </ul>
      <p class="stub-foot">该模块将在对应里程碑实现。</p>
    </div>
  </div>
</template>

<style scoped>
.stub {
  padding: 26px 28px;
  color: var(--gs-ink-2);
}

.stub-stage {
  font-family: var(--gs-font-display);
  font-size: 16px;
  color: var(--gs-gold-hi);
  letter-spacing: 0.06em;
}

.stub-list {
  margin-top: 14px;
  font-size: 13.5px;
  color: var(--gs-ink-2);
  display: grid;
  gap: 8px;
}

.stub-list li::before {
  content: '◇';
  color: var(--gs-gold-deep);
  margin-right: 8px;
  font-size: 10px;
}

.stub-foot {
  margin-top: 18px;
  font-size: 12.5px;
  color: var(--gs-ink-3);
}
</style>
