<script setup>
defineProps({
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
})
</script>

<template>
  <div class="page-head">
    <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
    <h1 class="page-title">{{ title }}</h1>
    <p v-if="desc" class="page-desc">{{ desc }}</p>
    <div class="head-extra">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.page-head {
  padding: 26px 0 18px;
  border-bottom: 1px solid var(--gs-line);
  margin-bottom: 22px;
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 0.32em;
  color: var(--gs-gold-deep);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.head-extra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}

.head-extra:empty {
  display: none;
}
</style>
