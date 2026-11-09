<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PageHead from '@/components/PageHead.vue'
import CharacterPicker from '@/components/CharacterPicker.vue'
import ElementBadge from '@/components/ElementBadge.vue'
import { useCharacterStore } from '@/stores/character'
import { assetUrl } from '@/utils/asset'
import { nationIcon } from '@/utils/element'

const store = useCharacterStore()
const route = useRoute()
const router = useRouter()

const pool = computed(() => store.all.filter((c) => !c.__deleted))
const playable = computed(() => pool.value.filter((c) => c.playable))

/* 初始选择：优先读取 URL 参数，否则取前两个可玩角色，保证页面一进来就有内容 */
function initialId(key, fallbackIndex) {
  const fromQuery = String(route.query[key] || '')
  if (fromQuery && pool.value.some((c) => String(c.id) === fromQuery)) return fromQuery
  const fallback = playable.value[fallbackIndex] || pool.value[fallbackIndex]
  return fallback ? String(fallback.id) : ''
}

const idA = ref(initialId('a', 0))
const idB = ref(initialId('b', 1))

const pick = (id) => store.get(id)
const a = computed(() => pick(idA.value))
const b = computed(() => pick(idB.value))

const rows = computed(() => {
  const list = [
    { key: 'star', label: '星级', get: (c) => (c?.star ? `${'★'.repeat(Math.min(c.star, 5))}` : '—') },
    { key: 'element', label: '元素', get: (c) => c?.element || '无', badge: true },
    { key: 'weapon', label: '武器', get: (c) => c?.weapon || '—' },
    { key: 'nation', label: '国度', get: (c) => c?.nation || '—', nation: true },
    { key: 'affiliation', label: '所属', get: (c) => c?.affiliation || '—' },
    { key: 'birthday', label: '生日', get: (c) => c?.birthday || '—' },
    { key: 'constellation', label: '命之座', get: (c) => c?.constellation || '—' },
    { key: 'role', label: '定位', get: (c) => c?.role || '—' },
    { key: 'title', label: '称号', get: (c) => c?.title || '—' },
    { key: 'cv-cn', label: '中文 CV', get: (c) => c?.cv?.['中'] || '—' },
    { key: 'cv-jp', label: '日文 CV', get: (c) => c?.cv?.['日'] || '—' },
    { key: 'cv-en', label: '英文 CV', get: (c) => c?.cv?.['英'] || '—' },
    { key: 'cv-kr', label: '韩文 CV', get: (c) => c?.cv?.['韩'] || '—' },
  ]
  return list.map((r) => {
    const va = r.get(a.value)
    const vb = r.get(b.value)
    return { ...r, va, vb, diff: Boolean(a.value && b.value) && va !== vb }
  })
})

const diffCount = computed(() => rows.value.filter((r) => r.diff).length)

function swap() {
  const t = idA.value
  idA.value = idB.value
  idB.value = t
}

/* 选择写入 URL，便于分享与回退 */
watch([idA, idB], () => {
  const query = { ...route.query }
  if (idA.value) query.a = idA.value
  else delete query.a
  if (idB.value) query.b = idB.value
  else delete query.b
  router.replace({ path: '/compare', query })
})

const avatarOf = (c) => assetUrl(c?.images?.avatar_hd || c?.images?.avatar || '')
</script>

<template>
  <div class="page">
    <PageHead eyebrow="Compare" title="角色对比" :desc="`并排比较两位角色的属性、命座与声优；当前有 ${diffCount} 项存在差异`">
      <button type="button" class="gs-btn" :disabled="!a || !b" @click="swap">交换左右</button>
      <RouterLink v-if="a" class="gs-btn" :to="`/c/${a.id}`">查看 {{ a.name }} 详情</RouterLink>
    </PageHead>

    <section class="pickers">
      <div class="pick-slot">
        <span class="pick-label">角色 A</span>
        <CharacterPicker v-model="idA" :characters="pool" :exclude="idB" label="选择左侧角色" />
      </div>
      <div class="pick-slot">
        <span class="pick-label">角色 B</span>
        <CharacterPicker v-model="idB" :characters="pool" :exclude="idA" label="选择右侧角色" />
      </div>
    </section>

    <section v-if="a || b" class="panel gs-panel">
      <div class="cmp" :class="{ single: !a || !b }">
        <header class="cmp-head">
          <span class="col-label" aria-hidden="true"></span>
          <div v-for="(c, i) in [a, b]" :key="i" class="col-head">
            <template v-if="c">
              <img v-if="avatarOf(c)" class="col-avatar" :src="avatarOf(c)" :alt="`${c.name} 头像`" />
              <div class="col-meta">
                <RouterLink class="col-name" :to="`/c/${c.id}`">{{ c.name }}</RouterLink>
                <span class="col-title">{{ c.title || '—' }}</span>
              </div>
            </template>
            <span v-else class="col-empty">未选择角色</span>
          </div>
        </header>

        <div v-for="r in rows" :key="r.key" class="cmp-row" :class="{ diff: r.diff }">
          <span class="row-label">
            {{ r.label }}
            <em v-if="r.diff" class="diff-dot" title="存在差异" aria-label="存在差异"></em>
          </span>
          <div class="cell">
            <ElementBadge v-if="r.badge && a?.element" :element="a.element" size="sm" />
            <img v-else-if="r.nation && nationIcon(a?.nation)" class="cell-nation" :src="assetUrl(nationIcon(a.nation))" alt="" />
            <span>{{ r.va }}</span>
          </div>
          <div class="cell">
            <ElementBadge v-if="r.badge && b?.element" :element="b.element" size="sm" />
            <img v-else-if="r.nation && nationIcon(b?.nation)" class="cell-nation" :src="assetUrl(nationIcon(b.nation))" alt="" />
            <span>{{ r.vb }}</span>
          </div>
        </div>
      </div>
    </section>

    <p v-else class="empty">先在上方选择两位角色开始对比。</p>

    <p class="tip">星标处表示两者取值不同；只想看某一侧时，可用上方选择器随时替换。</p>
  </div>
</template>

<style scoped>
.page {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 28px 60px;
}

.pickers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 18px;
}

.pick-slot {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pick-label {
  font-size: 12px;
  color: var(--gs-ink-3);
  letter-spacing: 0.04em;
}

.panel {
  padding: 8px 18px 14px;
}

.cmp-head,
.cmp-row {
  display: grid;
  grid-template-columns: 110px 1fr 1fr;
  gap: 12px;
  align-items: center;
}

.cmp-head {
  padding: 14px 0 12px;
  border-bottom: 1px solid var(--gs-line);
}

.col-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.col-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
  background: #efe9df;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.45);
}

.col-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.col-name {
  color: var(--gs-ink);
  font-family: var(--gs-font-display);
  font-size: 19px;
  text-decoration: none;
}

.col-name:hover {
  color: var(--gs-gold-hi);
}

.col-title {
  font-size: 11.5px;
  color: var(--gs-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-empty {
  color: var(--gs-ink-3);
  font-size: 13px;
}

.cmp-row {
  padding: 9px 2px;
  border-bottom: 1px solid rgba(237, 230, 214, 0.06);
  font-size: 13px;
  color: var(--gs-ink-2);
}

.cmp-row.diff {
  background: linear-gradient(90deg, rgba(211, 188, 142, 0.07), transparent 60%);
}

.row-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--gs-ink-3);
  font-size: 12px;
}

.diff-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--gs-gold);
}

.cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  word-break: break-word;
}

.cell-nation {
  width: 18px;
  height: 18px;
  object-fit: contain;
  opacity: 0.9;
}

.empty {
  padding: 40px 0;
  text-align: center;
  color: var(--gs-ink-3);
}

.tip {
  margin-top: 12px;
  font-size: 11.5px;
  color: var(--gs-ink-3);
}

@media (max-width: 900px) {
  .page {
    padding: 0 14px 40px;
  }
  .pickers {
    grid-template-columns: 1fr;
  }
  .cmp-head,
  .cmp-row {
    grid-template-columns: 78px 1fr 1fr;
    gap: 8px;
  }
  .col-name {
    font-size: 15px;
  }
  .cmp-row {
    font-size: 12px;
  }
}
</style>
