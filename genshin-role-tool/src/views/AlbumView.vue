<script setup>
import { computed, ref, watch } from 'vue'
import PageHead from '@/components/PageHead.vue'
import CollageCanvas from '@/components/CollageCanvas.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useAlbumStore } from '@/stores/album'
import { useToastStore } from '@/stores/toast'
import { useAlbumUrls } from '@/composables/useAlbumUrls'

const album = useAlbumStore()
const toast = useToastStore()

const urls = useAlbumUrls(computed(() => album.list))

const filter = ref('全部')
const FILTERS = [
  { key: '全部', label: '全部' },
  { key: 'official', label: '收藏' },
  { key: 'upload', label: '上传' },
  { key: 'card', label: '成品' },
]

const filtered = computed(() =>
  filter.value === '全部' ? album.list : album.list.filter((i) => i.kind === filter.value)
)

/* ---------- 上传 ---------- */
const fileInput = ref(null)
const dragging = ref(false)
const uploading = ref(false)

async function handleFiles(files) {
  if (!files?.length) return
  uploading.value = true
  let ok = 0
  const failed = []
  for (const f of files) {
    const res = await album.addUpload(f)
    if (res.ok) ok += 1
    else failed.push(`${f.name}:${res.reason === 'size' ? '超过 10MB' : res.reason === 'type' ? '非图片' : '失败'}`)
  }
  uploading.value = false
  if (ok) toast.ok(`已上传 ${ok} 张图片`)
  if (failed.length) toast.err(`有 ${failed.length} 张未导入：${failed[0]}`)
  if (fileInput.value) fileInput.value.value = ''
}

function onPick(e) {
  handleFiles([...e.target.files])
}

function onDrop(e) {
  dragging.value = false
  handleFiles([...e.dataTransfer.files])
}

/* ---------- 选择与拼图 ---------- */
const selected = ref([])
const template = ref('grid2')
const collageRef = ref(null)
const savingCollage = ref(false)

const TEMPLATES = [
  { key: 'grid2', label: '四宫格 2×2', slots: 4 },
  { key: 'grid3', label: '九宫格 3×3', slots: 9 },
  { key: 'strip3', label: '长条三连 1×3', slots: 3 },
  { key: 'hero', label: '主图 + 四小图', slots: 5 },
]

const slots = computed(() => TEMPLATES.find((t) => t.key === template.value)?.slots || 4)
const emptySlots = computed(() => Math.max(0, slots.value - selected.value.length))

function toggleSelect(item) {
  const i = selected.value.indexOf(item.aid)
  if (i >= 0) {
    selected.value.splice(i, 1)
  } else {
    if (selected.value.length >= 9) {
      toast.warn('最多选择 9 张')
      return
    }
    selected.value.push(item.aid)
  }
}

function orderOf(aid) {
  const i = selected.value.indexOf(aid)
  return i >= 0 ? i + 1 : 0
}

function move(aid, dir) {
  const i = selected.value.indexOf(aid)
  const j = i + dir
  if (i < 0 || j < 0 || j >= selected.value.length) return
  const arr = [...selected.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  selected.value = arr
}

const selectedItems = computed(() =>
  selected.value.map((aid) => album.get(aid)).filter(Boolean)
)

const collageSources = computed(() =>
  selectedItems.value.map((i) => urls[i.aid]).filter(Boolean)
)

function clearSelection() {
  selected.value = []
}

async function exportCollage() {
  if (!selected.value.length) {
    toast.warn('先选择要拼图的图片')
    return
  }
  const blob = await collageRef.value?.exportBlob()
  if (!blob) return
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = `原神-拼图-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  toast.ok('拼图已导出')
}

async function saveCollage() {
  const blob = await collageRef.value?.exportBlob()
  if (!blob) return
  savingCollage.value = true
  try {
    await album.addCard(blob, { title: '拼图作品', kind: 'card' })
    toast.ok('已保存到相册')
  } catch {
    toast.err('保存失败，可能是存储空间不足')
  } finally {
    savingCollage.value = false
  }
}

/* ---------- 查看器 ---------- */
const viewerIndex = ref(-1)
const viewerItem = computed(() => (viewerIndex.value >= 0 ? filtered.value[viewerIndex.value] : null))

function openViewer(item) {
  viewerIndex.value = filtered.value.findIndex((i) => i.aid === item.aid)
}

function closeViewer() {
  viewerIndex.value = -1
}

function step(d) {
  const n = filtered.value.length
  if (!n) return
  viewerIndex.value = (viewerIndex.value + d + n) % n
}

const deleteTarget = ref(null)

async function doDelete() {
  if (!deleteTarget.value) return
  await album.remove(deleteTarget.value.aid)
  selected.value = selected.value.filter((a) => a !== deleteTarget.value.aid)
  deleteTarget.value = null
  closeViewer()
  toast.ok('已删除该相册项')
}

function downloadItem(item) {
  const url = urls[item.aid]
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = `${item.title || '原神图片'}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

watch(filter, () => {
  viewerIndex.value = -1
})
</script>

<template>
  <div
    class="page"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <PageHead
      eyebrow="Album"
      title="角色相册"
      :desc="`共 ${album.stats.total} 项 · 收藏 ${album.stats.official} · 上传 ${album.stats.upload} · 成品 ${album.stats.card}`"
    >
      <button type="button" class="gs-btn primary" @click="fileInput?.click()">
        ＋ 上传图片
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        hidden
        @change="onPick"
      />
      <button
        v-if="selected.length"
        type="button"
        class="gs-btn"
        @click="clearSelection"
      >
        清空选择 ({{ selected.length }})
      </button>
    </PageHead>

    <div v-if="uploading" class="uploading gs-panel">正在导入图片…</div>

    <div class="tabs">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        type="button"
        class="gs-pill"
        :class="{ 'is-on': filter === f.key }"
        @click="filter = f.key"
      >
        {{ f.label }}
      </button>
      <span class="tip-inline">点击图片加入拼图，拖拽文件到页面即可上传（单张 ≤ 10MB）</span>
    </div>

    <div class="layout">
      <section class="gallery">
        <div v-if="filtered.length" class="grid">
          <article
            v-for="it in filtered"
            :key="it.aid"
            class="tile"
            :class="{ picked: orderOf(it.aid) }"
            @click="toggleSelect(it)"
          >
            <img v-if="urls[it.aid]" :src="urls[it.aid]" :alt="it.title" loading="lazy" />
            <div v-else class="ph">读取中…</div>

            <span v-if="orderOf(it.aid)" class="order nums">{{ orderOf(it.aid) }}</span>
            <span class="kind">{{ it.kind === 'official' ? '收藏' : it.kind === 'upload' ? '上传' : '成品' }}</span>

            <div class="tools" @click.stop>
              <button type="button" title="查看" @click="openViewer(it)">⤢</button>
              <button type="button" title="下载" @click="downloadItem(it)">↓</button>
              <button type="button" title="删除" @click="deleteTarget = it">×</button>
            </div>

            <p class="cap">{{ it.title || it.label || '未命名' }}</p>
          </article>
        </div>

        <div v-else class="empty gs-panel">
          <p class="empty-title">相册还是空的</p>
          <p class="empty-desc">
            去角色详情页点「加入相册」收藏官方立绘，或直接上传本地图片。
          </p>
        </div>
      </section>

      <aside class="side">
        <div class="panel gs-panel">
          <header class="phead">
            <h2>拼图</h2>
            <span class="count">{{ selected.length }} / {{ slots }}</span>
          </header>

          <CollageCanvas
            ref="collageRef"
            :sources="collageSources"
            :template="template"
          />

          <p v-if="emptySlots" class="tip">还有 {{ emptySlots }} 格未填，导出会保留虚线空位。</p>

          <label class="fld">
            <span>模板</span>
            <select v-model="template">
              <option v-for="t in TEMPLATES" :key="t.key" :value="t.key">{{ t.label }}</option>
            </select>
          </label>

          <ul v-if="selectedItems.length" class="orderlist">
            <li v-for="(it, i) in selectedItems" :key="it.aid">
              <span class="idx nums">{{ i + 1 }}</span>
              <span class="ot">{{ it.title || it.label || '未命名' }}</span>
              <button type="button" class="mv" @click="move(it.aid, -1)">↑</button>
              <button type="button" class="mv" @click="move(it.aid, 1)">↓</button>
            </li>
          </ul>

          <div class="ops">
            <button type="button" class="gs-btn primary" @click="exportCollage">导出 PNG</button>
            <button type="button" class="gs-btn" :disabled="savingCollage" @click="saveCollage">
              {{ savingCollage ? '保存中…' : '存入相册' }}
            </button>
          </div>
        </div>
      </aside>
    </div>

    <!-- 查看器 -->
    <Teleport to="body">
      <div v-if="viewerItem" class="viewer" @click.self="closeViewer">
        <button type="button" class="vclose" @click="closeViewer">×</button>
        <button type="button" class="vnav left" @click="step(-1)">‹</button>
        <img v-if="urls[viewerItem.aid]" :src="urls[viewerItem.aid]" :alt="viewerItem.title" />
        <button type="button" class="vnav right" @click="step(1)">›</button>
        <div class="vbar">
          <span>{{ viewerItem.title }}</span>
          <span class="vcount nums">{{ viewerIndex + 1 }} / {{ filtered.length }}</span>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      :open="!!deleteTarget"
      title="删除这个相册项？"
      message="只会从相册移除，不会影响原始素材文件。若为上传图片，其本地副本也会被清理。"
      confirm-text="删除"
      danger
      @confirm="doDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>

<style scoped>
.page.dragging::after {
  content: '松开以上传图片';
  position: fixed;
  inset: 16px;
  z-index: var(--gs-z-toast);
  display: grid;
  place-items: center;
  border: 2px dashed var(--gs-gold);
  border-radius: 16px;
  background: rgba(7, 21, 33, 0.82);
  color: var(--gs-gold-hi);
  font-size: 16px;
  letter-spacing: 0.1em;
  pointer-events: none;
}

.uploading {
  padding: 10px 16px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--gs-gold);
}

.tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.tip-inline {
  font-size: 11.5px;
  color: var(--gs-ink-3);
  margin-left: 6px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 372px;
  gap: 16px;
  align-items: start;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 12px;
}

.tile {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--gs-line);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.18s var(--gs-ease);
}

.tile:hover {
  border-color: var(--gs-line-hi);
}

.tile.picked {
  border-color: var(--gs-gold);
  box-shadow: 0 0 0 1px var(--gs-gold), 0 8px 22px rgba(0, 0, 0, 0.4);
}

.tile img {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  display: block;
  background: #10293d;
}

.ph {
  aspect-ratio: 3 / 4;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--gs-ink-3);
}

.order {
  position: absolute;
  left: 8px;
  top: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--gs-gold);
  color: #1a1208;
  font-size: 12px;
  font-weight: 700;
}

.kind {
  position: absolute;
  right: 8px;
  top: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 10px;
  color: var(--gs-gold-hi);
  background: rgba(6, 18, 28, 0.78);
  border: 1px solid var(--gs-line-hi);
}

.tools {
  position: absolute;
  right: 6px;
  bottom: 34px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.18s var(--gs-ease);
}

.tile:hover .tools {
  opacity: 1;
}

.tools button {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(6, 18, 28, 0.82);
  border: 1px solid var(--gs-line);
  color: var(--gs-ink-2);
  font-size: 12px;
  line-height: 1;
}

.tools button:hover {
  color: var(--gs-gold-hi);
  border-color: var(--gs-gold);
}

.cap {
  padding: 6px 9px;
  font-size: 11.5px;
  color: var(--gs-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(9, 22, 33, 0.9);
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
  margin-top: 8px;
  color: var(--gs-ink-3);
  font-size: 13px;
}

.side {
  position: sticky;
  top: 78px;
}

.panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.phead {
  display: flex;
  align-items: center;
  gap: 10px;
}

.phead h2 {
  font-size: 15px;
  color: var(--gs-gold-hi);
  letter-spacing: 0.08em;
}

.count {
  margin-left: auto;
  font-size: 12px;
  color: var(--gs-ink-3);
}

.tip {
  font-size: 11.5px;
  color: var(--gs-gold-deep);
}

.fld {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.fld > span {
  font-size: 11.5px;
  color: var(--gs-ink-3);
}

.fld select {
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--gs-line);
  background: rgba(6, 20, 32, 0.6);
  color: var(--gs-ink);
  font-size: 13px;
  outline: none;
}

.fld option {
  background: #10293d;
}

.orderlist {
  display: grid;
  gap: 4px;
  max-height: 168px;
  overflow-y: auto;
}

.orderlist li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.idx {
  color: var(--gs-gold-deep);
  width: 14px;
}

.ot {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gs-ink-2);
}

.mv {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--gs-line);
  color: var(--gs-ink-3);
  font-size: 11px;
  line-height: 1;
}

.mv:hover {
  color: var(--gs-gold);
  border-color: var(--gs-gold);
}

.ops {
  display: flex;
  gap: 8px;
}

.ops .gs-btn {
  flex: 1;
}

.ops .gs-btn:disabled {
  opacity: 0.6;
}

.viewer {
  position: fixed;
  inset: 0;
  z-index: var(--gs-z-modal);
  background: rgba(3, 10, 17, 0.94);
  display: grid;
  place-items: center;
  padding: 40px 80px;
}

.viewer img {
  max-width: 100%;
  max-height: 86vh;
  object-fit: contain;
  border-radius: 8px;
}

.vclose {
  position: absolute;
  top: 18px;
  right: 24px;
  font-size: 26px;
  color: var(--gs-ink-2);
}

.vnav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid var(--gs-line-hi);
  color: var(--gs-ink);
  font-size: 22px;
}

.vnav.left {
  left: 20px;
}

.vnav.right {
  right: 20px;
}

.vnav:hover {
  border-color: var(--gs-gold);
  color: var(--gs-gold-hi);
}

.vbar {
  position: absolute;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 14px;
  font-size: 12.5px;
  color: var(--gs-ink-2);
}

.vcount {
  color: var(--gs-ink-3);
}

@media (max-width: 1200px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
  }
  .viewer {
    padding: 20px;
  }
}
</style>
