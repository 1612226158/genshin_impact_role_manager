<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '@/components/PageHead.vue'
import SearchBox from '@/components/SearchBox.vue'
import FilterChips from '@/components/FilterChips.vue'
import CharacterCard from '@/components/CharacterCard.vue'
import { useCharacterStore } from '@/stores/character'

const router = useRouter()
const store = useCharacterStore()

const starOptions = computed(() => {
  const list = [{ value: '5', count: store.all.filter((c) => c.star === 5).length }]
  list.push({ value: '4', count: store.all.filter((c) => c.star === 4).length })
  const none = store.all.filter((c) => !c.star).length
  if (none) list.push({ value: '无', count: none })
  return list
})

const sourceOptions = computed(() => [
  { value: '官方', count: store.all.filter((c) => !store.isCustom(c.id)).length },
  { value: '自建', count: store.stats.custom },
  { value: '已编辑', count: store.stats.edited },
])

const sortOptions = [
  { value: 'default', label: '默认（国度 · 星级）' },
  { value: 'name', label: '名称' },
  { value: 'star', label: '星级' },
  { value: 'birthday', label: '生日' },
  { value: 'recent', label: '最近编辑' },
]

const busy = ref(false)

function openCharacter(c) {
  router.push(`/c/${c.id}`)
}

function toggleDir() {
  store.sort.dir = store.sort.dir === 'asc' ? 'desc' : 'asc'
}

const hiddenCount = computed(() => store.stats.hidden)
</script>

<template>
  <div class="page">
    <PageHead
      eyebrow="Library"
      title="角色库"
      :desc="`共 ${store.stats.total} 个角色条目 · 自建 ${store.stats.custom} · 已修改 ${store.stats.edited}${hiddenCount ? ` · 已隐藏 ${hiddenCount}` : ''}`"
    >
      <SearchBox v-model="store.kw.text" />

      <label class="sort">
        <span>排序</span>
        <select v-model="store.sort.key" aria-label="排序方式">
          <option v-for="o in sortOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <button type="button" class="dir" :title="store.sort.dir === 'asc' ? '升序' : '降序'" @click="toggleDir">
        {{ store.sort.dir === 'asc' ? '↑' : '↓' }}
      </button>

      <button type="button" class="gs-btn primary" @click="router.push('/c/new/edit')">
        ＋ 新建角色
      </button>
      <button
        v-if="store.activeFilterCount"
        type="button"
        class="gs-btn"
        @click="store.resetFilters()"
      >
        清除筛选 ({{ store.activeFilterCount }})
      </button>
    </PageHead>

    <section class="filters gs-panel">
      <FilterChips
        label="国度"
        :options="store.nationOptions"
        :model-value="store.filters.nation"
        all-label="全部国度"
        @update:model-value="store.filters.nation = $event"
      />
      <FilterChips
        label="元素"
        :options="store.elementOptions"
        :model-value="store.filters.element"
        all-label="全部元素"
        @update:model-value="store.filters.element = $event"
      />
      <FilterChips
        label="星级"
        :options="starOptions"
        :model-value="store.filters.star"
        all-label="全部星级"
        @update:model-value="store.filters.star = $event"
      />
      <FilterChips
        label="武器"
        :options="store.weaponOptions"
        :model-value="store.filters.weapon"
        all-label="全部武器"
        @update:model-value="store.filters.weapon = $event"
      />
      <FilterChips
        label="来源"
        :options="sourceOptions"
        :model-value="store.filters.source"
        all-label="全部来源"
        @update:model-value="store.filters.source = $event"
      />
    </section>

    <div class="result-line">
      <span>显示 <b class="nums">{{ store.filtered.length }}</b> 条</span>
      <span v-if="store.kw.text" class="kw">关键词「{{ store.kw.text }}」</span>
    </div>

    <section v-if="store.filtered.length" class="grid" :class="{ busy }">
      <button
        v-for="(c, i) in store.filtered"
        :key="c.id"
        type="button"
        class="cell"
        @click="openCharacter(c)"
      >
        <CharacterCard
          :character="c"
          :edited="store.editedIds.has(String(c.id))"
          :custom="store.isCustom(c.id)"
          :priority="i < 15"
        />
      </button>
    </section>

    <div v-else class="empty gs-panel">
      <p class="empty-title">没有匹配的角色</p>
      <p class="empty-desc">试试换个关键词，或清除当前筛选条件。</p>
      <button type="button" class="gs-btn" @click="store.resetFilters()">清除全部筛选</button>
    </div>
  </div>
</template>

<style scoped>
.sort {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--gs-line);
  border-radius: 999px;
  background: rgba(8, 24, 38, 0.6);
  font-size: 12.5px;
  color: var(--gs-ink-3);
}

.sort select {
  border: none;
  background: none;
  outline: none;
  color: var(--gs-ink);
  font-size: 13px;
  cursor: pointer;
  max-width: 180px;
}

.sort select option {
  background: #10293d;
  color: var(--gs-ink);
}

.dir {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--gs-line);
  color: var(--gs-gold);
  background: rgba(8, 24, 38, 0.6);
  font-size: 14px;
  transition: border-color 0.18s var(--gs-ease);
}

.dir:hover {
  border-color: var(--gs-gold);
}

.filters {
  padding: 12px 18px 14px;
  margin-bottom: 16px;
}

.result-line {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--gs-ink-3);
  margin-bottom: 12px;
}

.result-line b {
  color: var(--gs-gold-hi);
}

.kw {
  color: var(--gs-gold-deep);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.cell {
  padding: 0;
  text-align: left;
  display: block;
}

.empty {
  padding: 56px 24px;
  text-align: center;
}

.empty-title {
  font-family: var(--gs-font-display);
  font-size: 17px;
  color: var(--gs-gold-hi);
}

.empty-desc {
  margin: 8px 0 18px;
  color: var(--gs-ink-3);
  font-size: 13px;
}

@media (min-width: 1600px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  }
}

@media (max-width: 900px) {
  .filters {
    padding: 10px 12px;
  }
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 8px;
  }
}
</style>
