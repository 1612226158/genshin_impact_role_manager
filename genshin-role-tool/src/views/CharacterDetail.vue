<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ElementBadge from '@/components/ElementBadge.vue'
import CharacterRail from '@/components/CharacterRail.vue'
import StoryReader from '@/components/StoryReader.vue'
import FlipArtwork from '@/components/FlipArtwork.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { useEditorStore } from '@/stores/editor'
import { useCompareQueueStore } from '@/stores/compareQueue'
import { useCharacterStore } from '@/stores/character'
import { useAlbumStore } from '@/stores/album'
import { useToastStore } from '@/stores/toast'
import { assetUrl } from '@/utils/asset'
import { nationIcon } from '@/utils/element'

const route = useRoute()
const router = useRouter()
const store = useCharacterStore()
const album = useAlbumStore()
const toast = useToastStore()
const editor = useEditorStore()
const compareQueue = useCompareQueueStore()

const tab = ref('stats')

const character = computed(() => store.get(route.params.id))

async function toggleCompare() {
  const id = character.value?.id
  if (!id || compareQueue.full) return
  if (compareQueue.has(id)) {
    compareQueue.remove(id)
    return
  }
  if (!compareQueue.add(id) || !compareQueue.full) return

  const [left, right] = compareQueue.entries
  try {
    const failure = await router.push({ name: 'compare', query: { a: left.id, b: right.id } })
    if (!failure) {
      compareQueue.clear()
      return
    }
  } catch {
    toast.err('未能打开对比页，请重试')
  }
  compareQueue.remove(id)
}

/* 故事正文按需加载（占原数据 96%，不参与首屏） */
const storyLoading = ref(false)
async function loadStoryIfNeeded() {
  const id = route.params.id
  if (!id || store.hasStory(id)) return
  storyLoading.value = true
  try {
    await store.ensureStory(id)
  } finally {
    storyLoading.value = false
  }
}

/* 海报预加载：骨架 → 图片就绪再显示，避免空白与跳版 */
const posterReady = ref(false)

const paintings = computed(() => character.value?.images?.paintings || [])
const activePainting = ref(0)

watch(() => route.params.id, () => {
  activePainting.value = 0
  tab.value = 'stats'
})

watch(tab, (value) => {
  if (value === 'story') loadStoryIfNeeded()
  const behavior = document.documentElement.classList.contains('no-motion') ? 'instant' : 'smooth'
  window.scrollTo({ top: 0, behavior })
})

const paintingSrc = computed(() => assetUrl(paintings.value[activePainting.value]?.file || ''))

watch(
  paintingSrc,
  (src) => {
    if (!src) {
      posterReady.value = true
      return
    }
    posterReady.value = false
    const img = new Image()
    img.decoding = 'async'
    const done = () => {
      posterReady.value = true
    }
    img.onload = done
    img.onerror = done
    img.src = src
  },
  { immediate: true }
)

onMounted(() => {
  if (tab.value === 'story') loadStoryIfNeeded()
})

const nationIconSrc = computed(() => {
  const p = nationIcon(character.value?.nation)
  return p ? assetUrl(p) : ''
})

const statRows = computed(() => {
  const c = character.value
  if (!c) return []
  return [
    { k: '国度', v: c.nation || '—' },
    { k: '所属', v: c.affiliation || '—' },
    { k: '元素', v: c.element || '—' },
    { k: '武器', v: c.weapon || '—' },
    { k: '星级', v: c.star ? `${c.star} 星` : '—' },
    { k: '生日', v: c.birthday || '—' },
    { k: '命之座', v: c.constellation || '—' },
    { k: '定位', v: c.role || '—' },
  ]
})

const cvRows = computed(() => {
  const cv = character.value?.cv || {}
  return [
    { k: '中', v: cv['中'] },
    { k: '日', v: cv['日'] },
    { k: '英', v: cv['英'] },
    { k: '韩', v: cv['韩'] },
  ].filter((r) => r.v)
})

const storySections = computed(() => character.value?.story?.sections || [])
const albumItems = computed(() => album.byCharacter(route.params.id))

const collected = computed(() => {
  const c = character.value
  if (!c || !paintings.value.length) return false
  return paintings.value.every((p) => album.isCollected(c.id, p.file))
})

function toggleCollect() {
  const c = character.value
  if (!c) return
  if (!paintings.value.length) {
    toast.warn('该角色没有可收藏的立绘')
    return
  }
  if (collected.value) {
    paintings.value.forEach((p) => album.uncollect(c.id, p.file))
    toast.push('已从相册移除')
  } else {
    let n = 0
    paintings.value.forEach((p) => {
      if (album.collect({ characterId: c.id, characterName: c.name, painting: p })) n += 1
    })
    toast.ok(n ? `已收藏 ${n} 张立绘` : '该立绘已在相册中')
  }
}

function go(id) {
  if (id) router.push(`/c/${id}`)
}

/** 单张立绘的收藏/取消（装扮卡片墙交互） */
function isPaintingCollected(p) {
  return album.isCollected(character.value?.id, p.file)
}

function toggleOne(p) {
  const c = character.value
  if (!c) return
  if (isPaintingCollected(p)) {
    album.uncollect(c.id, p.file)
    toast.push('已从相册移除')
  } else {
    album.collect({ characterId: c.id, characterName: c.name, painting: p })
    toast.ok('已收藏到相册')
  }
}

</script>

<template>
  <div v-if="character" class="detail">
    <header class="dhead">
      <button type="button" class="back" aria-label="返回角色库" @click="router.push('/')">←</button>
      <ElementBadge :element="character.element" size="sm" />
      <img v-if="nationIconSrc" class="crumb-icon" :src="nationIconSrc" alt="" draggable="false" />
      <span class="crumb">{{ character.nation }} / {{ character.name }}</span>
    </header>

    <div class="body" :class="{ wide: tab !== 'stats' }">
      <!-- 左侧角色头像切换栏（对齐游戏内角色页） -->
      <CharacterRail :characters="store.all" :active-id="character.id" @select="go" />

      <!-- 分区菜单 -->
      <nav class="tabs" aria-label="角色分区">
        <button type="button" :class="{ on: tab === 'stats' }" @click="tab = 'stats'">属性</button>
        <button type="button" :class="{ on: tab === 'story' }" @click="tab = 'story'">背景故事</button>
        <button type="button" :class="{ on: tab === 'album' }" @click="tab = 'album'">
          相册 <em v-if="albumItems.length">{{ albumItems.length }}</em>
        </button>
      </nav>

      <!-- 中央立绘 -->
      <div class="stage">
        <div class="poster" :class="{ 'no-art': !paintingSrc }">
          <!-- 图片就绪前的骨架，占位尺寸与最终海报一致，避免跳版 -->
          <div v-if="paintingSrc && !posterReady" class="poster-skel" aria-hidden="true">
            <SkeletonBlock w="100%" h="100%" radius="10px" />
          </div>
          <Transition name="posterfade" mode="out-in">
            <FlipArtwork
              v-if="paintingSrc"
              :key="paintingSrc"
              :front="paintingSrc"
              :back="assetUrl(character.images?.avatar_hd || character.images?.avatar || '')"
              :name="character.name"
            />
            <div v-else key="none" class="poster-empty">
              <span>官方未提供立绘</span>
            </div>
          </Transition>
        </div>

        <div v-if="paintings.length > 1" class="thumbs">
          <button
            v-for="(p, i) in paintings"
            :key="p.file"
            type="button"
            class="thumb"
            :class="{ on: i === activePainting }"
            @click="activePainting = i"
          >
            <img :src="assetUrl(p.file)" :alt="p.label || `立绘 ${i + 1}`" />
          </button>
        </div>
      </div>

      <!-- 右侧信息 -->
      <aside class="side">
        <div class="name-row">
          <h1>{{ character.name }}</h1>
          <span v-if="character.variant" class="variant">{{ character.variant }}</span>
          <button type="button" class="gs-btn detail-edit" @click="editor.open(character.id, $event.currentTarget)">编辑</button>
        </div>
        <p class="title">{{ character.title || '—' }}</p>
        <p class="stars" :aria-label="`${character.star || 0} 星`">
          {{ '★'.repeat(character.star || 0) }}
        </p>

        <div class="rule"></div>

        <div class="actions">
          <button type="button" class="gs-btn album-action" :class="{ primary: !collected }" @click="toggleCollect">
            <span>{{ collected ? '已加入相册' : '加入相册' }}</span>
            <span v-if="collected" class="album-check" aria-hidden="true">✓</span>
          </button>
          <button type="button" class="gs-btn compare-add" :disabled="compareQueue.full" :aria-pressed="compareQueue.has(character.id)"
            :title="compareQueue.has(character.id) ? '再次点击取消对比' : undefined" @click="toggleCompare">
            {{ compareQueue.has(character.id) ? '已加入对比' : '加入对比' }}
          </button>
        </div>

        <Transition name="tabfade" mode="out-in">
          <div :key="tab" class="tab-body">
            <template v-if="tab === 'stats'">
          <dl class="stats">
            <div v-for="r in statRows" :key="r.k">
              <dt>{{ r.k }}</dt>
              <dd>{{ r.v }}</dd>
            </div>
          </dl>

          <div v-if="cvRows.length" class="cv">
            <p class="cv-title">配音</p>
            <div v-for="r in cvRows" :key="r.k" class="cv-row">
              <span class="cv-lang">{{ r.k }}</span>
              <span class="cv-name">{{ r.v }}</span>
            </div>
          </div>

          <p v-if="character.source" class="src">
            <a :href="character.source" target="_blank" rel="noopener noreferrer">数据来源</a>
          </p>
        </template>

        <template v-else-if="tab === 'story'">
          <!-- 正文按需加载：加载期间显示骨架，避免空白与布局跳动 -->
          <div v-if="storyLoading" class="story-skel" aria-busy="true" aria-label="正在加载背景故事">
            <SkeletonBlock w="100%" h="13px" />
            <SkeletonBlock w="96%" h="13px" />
            <SkeletonBlock w="88%" h="13px" />
            <SkeletonBlock w="72%" h="13px" />
            <SkeletonBlock w="100%" h="13px" />
            <SkeletonBlock w="64%" h="13px" />
          </div>
          <!-- 资料阅读器：左侧分节目录 + 右侧连续正文（对齐游戏内资料页） -->
          <StoryReader v-else-if="storySections.length" :key="character.id" :sections="storySections" />
          <p v-else class="empty-story">官方未提供背景故事文本。</p>
        </template>

        <template v-else>
          <!-- 装扮卡片墙：已收藏 = 解锁态，未收藏 = 锁定态 -->
          <div v-if="paintings.length" class="wall">
            <button
              v-for="(p, i) in paintings"
              :key="p.file"
              type="button"
              class="wcard"
              :class="{ locked: !isPaintingCollected(p) }"
              :title="isPaintingCollected(p) ? '点击取消收藏' : '点击收藏'"
              @click="toggleOne(p)"
            >
              <img :src="assetUrl(p.file)" :alt="p.label || `立绘 ${i + 1}`" loading="lazy" />
              <span class="wtag" :class="{ got: isPaintingCollected(p) }">
                {{ isPaintingCollected(p) ? '已收藏' : '未收藏' }}
              </span>
              <svg v-if="!isPaintingCollected(p)" class="wlock" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M8 10V7a4 4 0 0 1 8 0v3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <rect x="5.5" y="10" width="13" height="9" rx="2" fill="currentColor" />
              </svg>
              <span class="wname">{{ p.label || `立绘 ${i + 1}` }}</span>
            </button>
          </div>
          <p v-else class="empty-story">该角色没有可收藏的立绘。</p>

          <template v-if="albumItems.length">
            <p class="wall-sub">该角色的相册内容（{{ albumItems.length }}）</p>
            <div class="album-list">
              <div v-for="it in albumItems" :key="it.aid" class="album-item">
                <span>{{ it.title || it.label || '立绘' }}</span>
                <span class="album-kind">{{ it.kind === 'official' ? '收藏' : it.kind === 'card' ? '成品' : '上传' }}</span>
              </div>
            </div>
          </template>
        </template>
          </div>
        </Transition>
      </aside>
    </div>
  </div>

  <div v-else class="page">
    <div class="missing gs-panel">
      <p>未找到该角色，可能已被删除。</p>
      <button type="button" class="gs-btn" @click="router.push('/')">返回角色库</button>
    </div>
  </div>
</template>

<style scoped>
.detail {
  position: relative;
  max-width: 1440px;
  margin: 0 auto;
  padding: 14px 28px 60px;
}

.dhead {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0 14px;
  border-bottom: 1px solid var(--gs-line);
}

.back {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--gs-line);
  color: var(--gs-ink-2);
  transition: all 0.18s var(--gs-ease);
}

.back:hover {
  border-color: var(--gs-gold);
  color: var(--gs-gold-hi);
}

.crumb {
  font-size: 13px;
  color: var(--gs-ink-2);
  letter-spacing: 0.04em;
}

.crumb-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  filter: drop-shadow(0 0 4px rgba(211, 188, 142, 0.4));
}

.body {
  position: relative;
  z-index: 2;
  /* flex 而非 grid：grid-template-columns 的 minmax(0,1fr) ↔ minmax(240px,340px)
     无法插值（实测瞬时跳变），改用可插值的 max-width 让立绘列连续收窄 */
  display: flex;
  gap: 22px;
  padding-top: 18px;
  align-items: flex-start;
}

/* 故事 / 相册页签：立绘列收窄（平滑），右侧换宽面板 */
.body.wide .stage {
  max-width: 340px;
}

/* 立绘随之等比缩放（高度收一档，与列宽过渡同步） */
.body.wide :deep(.flip-artwork) {
  height: min(560px, calc(100vh - 320px));
}

.body.wide .side {
  flex: 1 1 0;
  min-width: 0;
  max-height: calc(100vh - 200px);
  /* 面板本身不滚动：头部（名称/称号/星级/按钮）固定，只有下方 tab-body 内容滚动 */
  display: flex;
  flex-direction: column;
  padding: 8px 16px 16px;
}

.body.wide .tab-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 10px;
  margin-top: 4px;
}

.tabs {
  flex: 0 0 104px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 16px;
}

.tabs button {
  position: relative;
  text-align: left;
  padding: 10px 10px 10px 18px;
  font-size: 14px;
  color: var(--gs-ink-3);
  letter-spacing: 0.1em;
  transition: color 0.18s var(--gs-ease);
}

.tabs button::before {
  content: '◇';
  position: absolute;
  left: 2px;
  top: 50%;
  transform: translateY(-50%) scale(0.6);
  color: var(--gs-gold-deep);
  opacity: 0;
  transition: all 0.18s var(--gs-ease);
}

.tabs button:hover {
  color: var(--gs-ink-2);
}

.tabs button.on {
  color: var(--gs-gold-hi);
}

.tabs button.on::before {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}

.tabs em {
  font-style: normal;
  font-size: 10px;
  color: var(--gs-gold-deep);
  margin-left: 4px;
}

.stage {
  flex: 1 1 0;
  min-width: 0;
  /* 显式起点：max-width 从 none 出发不可插值，100% ↔ 340px 才可过渡 */
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  /* 与左栏「属性」按钮、右栏姓名同一顶线 */
  padding-top: 16px;
  /* 立绘列收窄的过渡（max-width 可插值，grid 轨道不可） */
  transition: max-width 0.34s var(--gs-ease);
}

.poster {
  position: relative;
  width: 100%;
  max-height: calc(100vh - 210px);
  display: flex;
  justify-content: center;
}

/* 海报骨架：绝对定位覆盖在 .poster 上，尺寸随容器，不改变布局 */
.poster-skel {
  position: absolute;
  inset: 0;
  z-index: 0;
}

/* 故事正文骨架：与 StoryReader 首屏行高接近，减少加载完成后的位移 */
.story-skel {
  display: grid;
  gap: 10px;
  padding: 6px 0 14px;
  max-width: 62ch;
}

.poster img {
  max-height: calc(100vh - 210px);
  width: auto;
  max-width: 100%;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.5);
  /* 立绘为官方海报，边缘加一层金色细边压住浅色底 */
  outline: 1px solid rgba(211, 188, 142, 0.28);
  outline-offset: -1px;
}

.poster-empty {
  width: 100%;
  min-height: 320px;
  display: grid;
  place-items: center;
  border: 1px dashed var(--gs-line-hi);
  border-radius: var(--gs-radius-panel);
  color: var(--gs-ink-3);
  font-size: 13px;
}

.thumbs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.thumb {
  width: 46px;
  height: 62px;
  padding: 0;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--gs-line);
  opacity: 0.65;
  transition: all 0.18s var(--gs-ease);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb.on,
.thumb:hover {
  opacity: 1;
  border-color: var(--gs-gold);
}

.side {
  flex: 0 0 380px;
  min-width: 0;
  /* 顶部 16px 与「属性」按钮同一顶线 */
  padding: 16px 16px 18px;
  border-left: 1px solid var(--gs-line);
  background: linear-gradient(90deg, rgba(7, 21, 33, 0.46), rgba(7, 21, 33, 0.12));
  border-radius: 0 8px 8px 0;
}

.name-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.detail-edit {
  flex: 0 0 auto;
  align-self: flex-start;
  margin-left: auto;
  border-color: var(--gs-line);
  padding: 4px 10px;
  color: var(--gs-ink-2);
  font-size: 12px;
  white-space: nowrap;
}

/* 「属性」页签：右栏顶线与左侧「属性」按钮、中央海报对齐
   （故事/相册页签走 .body.wide 的紧凑 8px 头部，不在此列） */
.body:not(.wide) .side {
  padding-top: 16px;
}

.side h1 {
  font-size: 30px;
  letter-spacing: 0.06em;
  color: var(--gs-ink);
  overflow-wrap: anywhere;
}

.variant {
  font-size: 12px;
  color: var(--gs-ink-3);
}

.title {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--gs-gold);
  letter-spacing: 0.18em;
}

.stars {
  margin-top: 6px;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--gs-gold);
}

.rule {
  height: 1px;
  margin: 16px 0 14px;
  background: linear-gradient(90deg, var(--gs-line-hi), transparent 70%);
}

.stats {
  display: grid;
  gap: 0;
}

.stats div {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 7px 2px;
  border-bottom: 1px dashed rgba(211, 188, 142, 0.12);
}

.stats dt {
  width: 62px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--gs-ink-3);
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.stats dt::before {
  content: '◇';
  font-size: 8px;
  color: var(--gs-gold-deep);
  opacity: 0.8;
}

.stats dd {
  margin: 0;
  font-size: 13.5px;
  color: var(--gs-ink);
  font-variant-numeric: tabular-nums;
}

.cv {
  margin-top: 16px;
}

.cv-title {
  font-size: 11px;
  color: var(--gs-gold-deep);
  letter-spacing: 0.2em;
  margin-bottom: 6px;
}

.cv-row {
  display: flex;
  gap: 10px;
  padding: 4px 2px;
  font-size: 12.5px;
}

.cv-lang {
  width: 18px;
  color: var(--gs-ink-3);
}

.cv-name {
  color: var(--gs-ink-2);
}

.src {
  margin-top: 14px;
  font-size: 11.5px;
}

.empty-story {
  font-size: 13px;
  color: var(--gs-ink-3);
  padding: 20px 0;
}

.album-list {
  display: grid;
  gap: 6px;
}

.album-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--gs-line);
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--gs-ink-2);
}

.album-kind {
  color: var(--gs-gold-deep);
  font-size: 11px;
}

/* 装扮卡片墙：解锁 / 锁定 */
.wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
}

.body.wide .wall {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px;
}

.wcard {
  position: relative;
  padding: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--gs-line-hi);
  cursor: pointer;
  transition: all 0.18s var(--gs-ease);
}

.wcard img {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  object-position: top;
  background: #0d2233;
}

.wcard:hover {
  border-color: var(--gs-gold);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

.wcard.locked img {
  filter: grayscale(0.9) brightness(0.55);
}

.wtag {
  position: absolute;
  left: 6px;
  top: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  background: linear-gradient(180deg, var(--gs-gold-hi), var(--gs-gold));
  color: #1a1208;
  font-weight: 600;
}

.wtag.got {
  background: rgba(6, 18, 28, 0.82);
  color: var(--gs-gold-hi);
  border: 1px solid var(--gs-line-hi);
}

.wlock {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 14px;
  height: 14px;
  color: rgba(237, 230, 214, 0.75);
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}

.wname {
  display: block;
  padding: 5px 8px;
  font-size: 11px;
  color: var(--gs-ink-2);
  background: rgba(9, 22, 33, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.wall-sub {
  margin-top: 18px;
  font-size: 11px;
  color: var(--gs-gold-deep);
  letter-spacing: 0.16em;
  margin-bottom: 8px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 18px;
}

.body.wide .actions {
  margin-bottom: 22px;
}

.actions .gs-btn {
  gap: 5px;
  min-height: 34px;
  padding: 5px 12px;
  font-size: 12.5px;
  white-space: nowrap;
}

.compare-add:disabled {
  cursor: default;
  opacity: 0.68;
}

.compare-add[aria-pressed='true'] {
  border-color: var(--gs-gold-deep);
  color: var(--gs-gold-hi);
}

.missing {
  padding: 50px 24px;
  text-align: center;
  color: var(--gs-ink-2);
}

.missing .gs-btn {
  margin-top: 16px;
}

/* 页签内容与立绘的平滑切换：卡片滑动而非纯淡入 */
.tabfade-enter-active,
.tabfade-leave-active {
  transition: opacity 0.2s var(--gs-ease), transform 0.24s var(--gs-ease);
}
.tabfade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.tabfade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.posterfade-enter-active,
.posterfade-leave-active {
  transition: opacity 0.24s var(--gs-ease);
}
.posterfade-enter-from,
.posterfade-leave-to {
  opacity: 0;
}

@media (max-width: 1200px) {
  .body {
    gap: 14px;
  }
  .body.wide .stage {
    max-width: 300px;
  }
  .side {
    flex-basis: 320px;
  }
  .side h1 {
    font-size: 24px;
  }
}

@media (max-width: 900px) {
  .detail {
    padding: 12px 14px 50px;
  }
  .body.wide .side,
  .side {
    padding: 14px;
  }
  .body,
  .body.wide {
    flex-direction: column;
    gap: 12px;
  }
  /* 纵向排列后 flex-basis 作用在高度上：必须改为内容自适应，否则舞台高度塌成 0 */
  .stage {
    flex: 1 1 auto;
    max-width: none;
    width: 100%;
  }
  .body.wide .stage,
  .body.wide .side,
  .side {
    max-width: none;
    flex: 0 0 auto;
    width: 100%;
  }
  .tabs {
    flex: 0 0 auto;
    width: 100%;
  }
  .body.wide .side {
    max-height: none;
    overflow: visible;
  }
  .tabs {
    flex-direction: row;
    padding-top: 0;
    border-bottom: 1px solid var(--gs-line);
  }
  .tabs button {
    padding: 8px 10px;
  }
  .tabs button::before {
    display: none;
  }
  .poster,
  .poster img {
    max-height: 58vh;
  }
}
</style>
