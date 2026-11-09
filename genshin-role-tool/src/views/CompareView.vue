<script setup>
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PageHead from '@/components/PageHead.vue'
import CharacterPicker from '@/components/CharacterPicker.vue'
import ElementBadge from '@/components/ElementBadge.vue'
import { useCharacterStore } from '@/stores/character'
import { assetUrl } from '@/utils/asset'
import { elementColor, elementIcon, nationIcon } from '@/utils/element'

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
const compareScene = inject('compareScene')
watch([() => a.value?.element, () => b.value?.element], (elements) => {
  compareScene.value = elements
}, { immediate: true })
onBeforeUnmount(() => { compareScene.value = null })

const CV_LANGUAGES = [
  { key: '中', label: '中文 CV' },
  { key: '日', label: '日文 CV' },
  { key: '英', label: '英文 CV' },
  { key: '韩', label: '韩文 CV' },
]
const cvIndex = ref(0)

function cycleCv() {
  cvIndex.value = (cvIndex.value + 1) % CV_LANGUAGES.length
}

const rows = computed(() => {
  const language = CV_LANGUAGES[cvIndex.value]
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
    { key: 'cv', label: language.label, get: (c) => c?.cv?.[language.key] || '—' },
  ]
  return list.map((r) => {
    const va = r.get(a.value)
    const vb = r.get(b.value)
    return { ...r, va, vb, diff: Boolean(a.value && b.value) && va !== vb }
  })
})

const diffCount = computed(() => rows.value.filter((r) => r.diff).length)
const swapping = ref(false)

async function swap() {
  swapping.value = true
  const t = idA.value
  idA.value = idB.value
  idB.value = t
  await nextTick()
  swapping.value = false
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

const sides = computed(() => [
  { key: 'a', character: a.value },
  { key: 'b', character: b.value },
])

function posterOf(character) {
  const images = character?.images
  return assetUrl(images?.paintings?.find((painting) => painting.file)?.file || images?.avatar_hd || images?.avatar)
}

function pulsePoster(event) {
  if (document.documentElement.classList.contains('no-motion')) return
  const image = event.currentTarget.querySelector('img')
  const flare = event.currentTarget.querySelector('.poster-flare')
  for (const part of [image, flare]) {
    part.getAnimations().forEach((animation) => animation.cancel())
  }
  image.animate([
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(1.045)', filter: 'brightness(1.16)', offset: 0.32 },
    { transform: 'scale(1)', filter: 'brightness(1)' },
  ], { duration: 420, easing: 'ease-out' })
  flare.animate([
    { opacity: 0, transform: 'scale(.96)' },
    { opacity: 0.85, offset: 0.24 },
    { opacity: 0, transform: 'scale(1.17)' },
  ], { duration: 560, easing: 'ease-out' })
}
</script>

<template>
  <div class="page">
    <PageHead eyebrow="Compare" title="角色对比" :desc="`并排比较两位角色的属性、命座与声优；当前有 ${diffCount} 项存在差异`">
      <button type="button" class="gs-btn" :disabled="!a || !b" @click="swap">交换左右</button>
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

    <TransitionGroup v-if="a || b" tag="section" name="compare-swap" class="compare-board"
      :move-class="swapping ? 'compare-swap-move' : 'compare-no-move'" @leave="(_, done) => done()"
      aria-label="角色属性对比" :style="{ '--panel-rows': rows.length + 1 }">
      <article v-for="{ key, character } in sides" :key="character && idA !== idB ? character.id : key" class="compare-panel gs-panel"
        :class="`side-${key}`" :style="{ '--accent': elementColor(character?.element) }">
        <button v-if="posterOf(character)" type="button" class="floating-poster" :aria-label="`点亮${character.name}海报`" @click="pulsePoster">
          <img :src="posterOf(character)" :alt="`${character.name} 立绘`" draggable="false" />
          <span class="poster-flare" aria-hidden="true"></span>
        </button>

        <header class="panel-head">
          <img v-if="elementIcon(character?.element)" class="panel-sigil" :src="assetUrl(elementIcon(character.element))" alt="" />
          <h2>
            <RouterLink v-if="character" class="col-name" :to="`/c/${character.id}`">{{ character.name }}</RouterLink>
            <span v-else class="col-empty">未选择角色</span>
          </h2>
          <p v-if="character?.title" class="col-title">{{ character.title }}</p>
        </header>

        <component v-for="r in rows" :is="r.key === 'cv' ? 'button' : 'div'" :key="r.key"
          class="cmp-row" :class="{ diff: r.diff }" :data-field="r.key"
          :type="r.key === 'cv' ? 'button' : undefined" :title="r.key === 'cv' ? '切换两侧的 CV 语言' : undefined"
          @click="r.key === 'cv' && cycleCv()">
          <span class="row-label">
            {{ r.label }}
            <span v-if="r.diff" class="diff-dot" title="存在差异" aria-label="存在差异"></span>
          </span>
          <span class="cell">
            <ElementBadge v-if="r.badge && character?.element" :element="character.element" size="sm" />
            <img v-else-if="r.nation && nationIcon(character?.nation)" class="cell-nation" :src="assetUrl(nationIcon(character.nation))" alt="" />
            <span>{{ key === 'a' ? r.va : r.vb }}</span>
          </span>
          <span v-if="r.key === 'cv'" class="cv-cycle-icon" aria-hidden="true">↻</span>
        </component>
      </article>
    </TransitionGroup>

    <p v-else class="empty">先在上方选择两位角色开始对比。</p>

    <p v-if="diffCount" class="tip">金色菱形标出两位角色的差异。</p>
  </div>
</template>

<style scoped>
.page {
  --art-width: clamp(138px, 16vw, 240px);
  --edge-space: calc(var(--art-width) * 0.57);
  --content-inset: calc(var(--art-width) * 0.46);
  --panel-gap: 24px;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 28px 60px;
}

.pickers,
.compare-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--panel-gap);
  margin-inline: var(--edge-space);
}

.pickers {
  position: relative;
  z-index: 2;
  margin-bottom: 18px;
}

.pick-slot {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pick-label {
  color: var(--gs-ink-3);
  font-size: 12px;
  text-align: center;
}

.compare-panel {
  position: relative;
  display: grid;
  grid-row: 1 / span var(--panel-rows);
  grid-template-rows: subgrid;
  min-width: 0;
  padding-bottom: 14px;
  border-color: color-mix(in srgb, var(--accent) 32%, var(--gs-line));
  background:
    radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--accent) 19%, transparent), transparent 50%),
    var(--gs-panel);
  text-align: center;
}

.side-a {
  grid-column: 1;
  --enter-x: -16px;
}

.side-b {
  grid-column: 2;
  --enter-x: 16px;
}

.compare-swap-move {
  transition: transform 0.52s var(--gs-ease);
}

.compare-swap-enter-active {
  animation: panel-enter 0.34s var(--gs-ease) both;
}

@keyframes panel-enter {
  from { opacity: 0; translate: var(--enter-x) 0; }
}

.floating-poster {
  position: absolute;
  z-index: 1;
  top: 42px;
  left: 0%;
  display: grid;
  place-items: center;
  width: var(--art-width);
  padding: 0;
  transform: translateX(-52%) rotate(-5deg);
  border-radius: 10px;
  transition: left 0.52s var(--gs-ease), transform 0.52s var(--gs-ease);
}

.side-b .floating-poster {
  left: 100%;
  transform: translateX(-48%) rotate(5deg);
}

.floating-poster img {
  grid-area: 1 / 1;
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: min(48vw, 540px);
  border: 1px solid var(--gs-line-hi);
  border-radius: 9px;
  box-shadow: 0 22px 42px #030c17b3, 0 0 28px color-mix(in srgb, var(--accent) 24%, transparent);
}

.floating-poster:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.floating-poster:active img {
  filter: brightness(1.12);
}

.poster-flare {
  grid-area: 1 / 1;
  align-self: stretch;
  width: 86%;
  border-radius: 9px;
  opacity: 0;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--accent) 42%, transparent), transparent 72%);
  box-shadow: inset 0 0 18px var(--accent), 0 0 32px var(--accent);
  pointer-events: none;
}

.panel-head {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 138px;
  margin-inline: var(--content-inset);
  border-bottom: 1px solid var(--gs-line-hi);
  padding: 16px 4px;
}

.panel-sigil {
  position: absolute;
  z-index: -1;
  inset: 50% auto auto 50%;
  width: 102px;
  height: 102px;
  object-fit: contain;
  opacity: 0.17;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.panel-head h2 {
  font-family: var(--gs-font-display);
  font-size: clamp(23px, 2.5vw, 37px);
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.col-name {
  color: var(--gs-ink);
}

.col-name:hover {
  color: var(--gs-gold-hi);
}

.col-title {
  margin-top: 7px;
  color: var(--gs-gold);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.col-empty {
  color: var(--gs-ink-3);
  font-size: 15px;
}

.cmp-row {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 2px;
  min-width: 0;
  margin-inline: var(--content-inset);
  border-bottom: 1px solid var(--gs-line);
  padding: 5px 6px;
}

.cmp-row.diff {
  background: linear-gradient(90deg, transparent, #d3bc8e13, transparent);
}

button.cmp-row {
  position: relative;
  padding-inline: 22px;
  border-radius: 6px;
}

button.cmp-row:hover,
button.cmp-row:focus-visible {
  background: #d3bc8e22;
}

.cv-cycle-icon {
  position: absolute;
  top: 50%;
  right: 6px;
  color: var(--gs-gold);
  transform: translateY(-50%);
}

.row-label {
  position: relative;
  color: var(--gs-ink-3);
  font-size: 11.5px;
}

.diff-dot {
  position: absolute;
  inset: 50% auto auto calc(100% + 7px);
  width: 4px;
  height: 4px;
  background: var(--gs-gold);
  transform: translateY(-50%) rotate(45deg);
}

.cell {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 100%;
  color: var(--gs-ink);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.cell-nation {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.empty,
.tip {
  text-align: center;
  color: var(--gs-ink-3);
}

.empty {
  padding: 40px 0;
}

.tip {
  margin-top: 12px;
  font-size: 12px;
}

@media (max-width: 780px) {
  .page {
    --art-width: 70px;
    --edge-space: 0px;
    --content-inset: 8px;
    --panel-gap: 10px;
    padding: 0 14px 40px;
  }

  .panel-head {
    min-height: 0;
    padding-top: 16px;
  }

  .compare-panel:has(.floating-poster) .panel-head {
    padding-top: 125px;
  }

  .floating-poster,
  .side-b .floating-poster {
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
  }

  .floating-poster img {
    max-height: 102px;
  }
}
</style>
