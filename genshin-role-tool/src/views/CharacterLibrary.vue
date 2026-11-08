<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '@/components/PageHead.vue'
import SearchBox from '@/components/SearchBox.vue'
import FilterChips from '@/components/FilterChips.vue'
import CharacterCard from '@/components/CharacterCard.vue'
import StyledSelect from '@/components/StyledSelect.vue'
import { useEditorStore } from '@/stores/editor'
import { useCharacterStore } from '@/stores/character'
import { useSettingsStore } from '@/stores/settings'
import { useSmoothWheel } from '@/composables/useSmoothWheel'
import { assetUrl } from '@/utils/asset'
import { nationIcon, elementIcon } from '@/utils/element'

const router = useRouter()
const store = useCharacterStore()
const settings = useSettingsStore()
const editor = useEditorStore()
useSmoothWheel(() => settings.settings.motion !== 'off')

const nationOptions = computed(() =>
  store.nationOptions
    .map((o) => ({ ...o, icon: nationIcon(o.value) ? assetUrl(nationIcon(o.value)) : '' }))
)

const elementOptions = computed(() =>
  store.elementOptions
    .map((o) => ({ ...o, icon: elementIcon(o.value) ? assetUrl(elementIcon(o.value)) : '' }))
)

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


function openCharacter(c) {
  router.push(`/c/${c.id}`)
}

function toggleDir() {
  store.sort.dir = store.sort.dir === 'asc' ? 'desc' : 'asc'
}

function pinLeaving(el) {
  el.style.left = `${el.offsetLeft}px`
  el.style.top = `${el.offsetTop}px`
  el.style.width = `${el.offsetWidth}px`
  el.style.height = `${el.offsetHeight}px`
}
function unpin(el) {
  for (const key of ['left', 'top', 'width', 'height']) el.style[key] = ''
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

      <StyledSelect v-model="store.sort.key" :options="sortOptions" label="排序方式" compact class="library-sort" />
      <button type="button" class="dir" :title="store.sort.dir === 'asc' ? '升序' : '降序'" @click="toggleDir">
        {{ store.sort.dir === 'asc' ? '↑' : '↓' }}
      </button>

      <button type="button" class="gs-btn primary" @click="editor.open('new', $event.currentTarget)">
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
        :options="nationOptions"
        :model-value="store.filters.nation"
        all-label="全部国度"
        @update:model-value="store.filters.nation = $event"
      />
      <FilterChips
        label="元素"
        :options="elementOptions"
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

    <TransitionGroup tag="section" name="cards" class="grid" @before-leave="pinLeaving" @leave-cancelled="unpin" @after-leave="unpin">
      <button
        v-for="(c, i) in store.filtered"
        :key="c.id"
        type="button"
        class="cell" :style="{ '--i': Math.min(i, 12) }"
        @click="openCharacter(c)"
      >
        <CharacterCard
          :character="c"
          :edited="store.editedIds.has(String(c.id))"
          :custom="store.isCustom(c.id)"
          :priority="i < 15"
        />
      </button>
    </TransitionGroup>

    <div v-if="!store.filtered.length" class="empty gs-panel">
      <p class="empty-title">没有匹配的角色</p>
      <p class="empty-desc">试试换个关键词，或清除当前筛选条件。</p>
      <button type="button" class="gs-btn" @click="store.resetFilters()">清除全部筛选</button>
    </div>
  </div>
</template>

<style scoped>
.library-sort { width: 205px; }
.page :deep(.head-extra) > .gs-btn { height: 36px; padding: 0 16px; line-height: 1; white-space: nowrap; }
.page :deep(.head-extra) { align-items: center; }

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
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.cell {
  min-width: 0;
  padding: 0;
  text-align: left;
  display: block;
}

.cards-move { transition: transform .38s cubic-bezier(.22,.8,.25,1); }
.cards-enter-active { transition: opacity .24s ease, transform .3s var(--gs-ease); transition-delay: calc(var(--i) * 10ms); }
.cards-leave-active { position: absolute; transition: opacity .18s ease, transform .22s ease; pointer-events: none; }
.cards-enter-from, .cards-leave-to { opacity: 0; transform: translateY(12px) scale(.96); }

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
