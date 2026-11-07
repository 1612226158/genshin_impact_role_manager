<script setup>
import { computed, ref } from 'vue'
import PageHead from '@/components/PageHead.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useSettingsStore } from '@/stores/settings'
import { useCharacterStore } from '@/stores/character'
import { useHistoryStore } from '@/stores/history'
import { useAlbumStore } from '@/stores/album'
import { useToastStore } from '@/stores/toast'
import { downloadBlob } from '@/utils/canvas'

const settings = useSettingsStore()
const store = useCharacterStore()
const history = useHistoryStore()
const album = useAlbumStore()
const toast = useToastStore()

const importInput = ref(null)
const pendingImport = ref(null)
const importMode = ref('overwrite')

const overview = computed(() => [
  { k: '角色总数', v: store.stats.total },
  { k: '官方角色', v: store.stats.base },
  { k: '自建角色', v: store.stats.custom },
  { k: '已修改', v: store.stats.edited },
  { k: '已隐藏', v: store.stats.hidden },
  { k: '编辑记录', v: history.count },
  { k: '相册项', v: album.stats.total },
])

function doExport() {
  const payload = settings.exportAll()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`
  downloadBlob(blob, `原神角色工具-备份-${stamp}.json`)
  toast.ok('已导出数据备份（不含图片二进制）')
}

function onPickImport(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result))
      const v = settings.validate(data)
      if (!v.ok) {
        toast.err(v.reason === 'version' ? '备份版本高于当前应用' : '文件格式不正确')
        return
      }
      pendingImport.value = data
    } catch {
      toast.err('无法解析该 JSON 文件')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function doImport() {
  if (!pendingImport.value) return
  const res = settings.importAll(pendingImport.value, {
    overwrite: importMode.value === 'overwrite',
  })
  pendingImport.value = null
  if (res.ok) {
    toast.ok(
      `导入完成：覆盖层 ${res.counts.overrides} · 自建 ${res.counts.customs} · 记录 ${res.counts.history}`
    )
  } else {
    toast.err('导入失败')
  }
}

const confirmState = ref('')
const CONFIRMS = {
  history: {
    title: '清空全部编辑记录？',
    message: '记录清空后不可恢复，角色数据本身不受影响。',
    confirmText: '清空记录',
    run: () => {
      settings.resetHistory()
      toast.ok('编辑记录已清空')
    },
  },
  album: {
    title: '清空整个相册？',
    message: '所有收藏项、上传图片与成品图都会删除。原始素材文件不受影响。',
    confirmText: '清空相册',
    run: async () => {
      await settings.resetAlbum()
      toast.ok('相册已清空')
    },
  },
  all: {
    title: '重置全部本地数据？',
    message:
      '将删除：所有角色修改、自建角色、编辑记录、相册内容。\n官方原始数据不会被删除，操作不可撤销。',
    confirmText: '确认重置',
    run: async () => {
      await settings.resetEverything()
      toast.ok('已恢复为初始状态')
    },
  },
}

const current = computed(() => CONFIRMS[confirmState.value] || null)

async function runConfirm() {
  await current.value?.run()
  confirmState.value = ''
}

const storageText = computed(() => (settings.storageOk ? '可用' : '不可用（可能处于隐私模式）'))
</script>

<template>
  <div class="page">
    <PageHead
      eyebrow="Settings"
      title="设置"
      desc="数据备份、恢复与清理。所有数据仅保存在本机浏览器中，不会上传到任何服务器。"
    />

    <section class="block gs-panel">
      <h2>数据概况</h2>
      <div class="stats">
        <div v-for="o in overview" :key="o.k">
          <span class="k">{{ o.k }}</span>
          <span class="v nums">{{ o.v }}</span>
        </div>
      </div>
      <p class="line">
        本地存储：<b :class="settings.storageOk ? 'ok' : 'bad'">{{ storageText }}</b>
        <span class="sep">·</span>
        数据结构版本 v{{ settings.SCHEMA_VERSION }}
      </p>
    </section>

    <section class="block gs-panel">
      <h2>备份与恢复</h2>
      <p class="desc">
        导出为 JSON，包含角色修改、自建角色、编辑记录与相册索引。
        <b>不含已上传图片与生成图片的二进制</b>，这些内容保存在浏览器的 IndexedDB 中，无法随 JSON 迁移。
      </p>
      <div class="row">
        <button type="button" class="gs-btn primary" @click="doExport">导出数据备份</button>
        <button type="button" class="gs-btn" @click="importInput?.click()">导入备份文件</button>
        <input ref="importInput" type="file" accept="application/json,.json" hidden @change="onPickImport" />
        <label class="mode">
          <input v-model="importMode" type="radio" value="overwrite" />
          覆盖当前数据
        </label>
        <label class="mode">
          <input v-model="importMode" type="radio" value="merge" />
          与当前数据合并
        </label>
      </div>
    </section>

    <section class="block gs-panel">
      <h2>清理</h2>
      <div class="danger-row">
        <div class="ditem">
          <div>
            <p class="dt">清空编辑记录</p>
            <p class="dd">保留数据，仅删除可撤销的历史条目。</p>
          </div>
          <button type="button" class="gs-btn" @click="confirmState = 'history'">清空</button>
        </div>
        <div class="ditem">
          <div>
            <p class="dt">清空相册</p>
            <p class="dd">删除全部相册项与其中的图片副本。</p>
          </div>
          <button type="button" class="gs-btn" @click="confirmState = 'album'">清空</button>
        </div>
        <div class="ditem">
          <div>
            <p class="dt">重置全部本地数据</p>
            <p class="dd">回到初始状态，官方原始数据不受影响。</p>
          </div>
          <button type="button" class="gs-btn danger" @click="confirmState = 'all'">重置</button>
        </div>
      </div>
    </section>

    <section class="block gs-panel">
      <h2>关于</h2>
      <dl class="about">
        <div>
          <dt>数据集</dt>
          <dd>138 个角色条目，含背景故事、四语 CV、头像与官方立绘</dd>
        </div>
        <div>
          <dt>数据来源</dt>
          <dd>原神官网角色页与米游社观测枢</dd>
        </div>
        <div>
          <dt>技术栈</dt>
          <dd>Vue 3 + Vite，纯前端，无后端服务、无网络请求</dd>
        </div>
        <div>
          <dt>存储方式</dt>
          <dd>文本数据存 localStorage，图片二进制存 IndexedDB</dd>
        </div>
        <div>
          <dt>版权</dt>
          <dd>
            角色名称、背景故事与图片素材版权归
            <b>miHoYo / HoYoverse</b>
            所有。本项目仅供个人学习研究，不作商业用途，不对外分发素材。
          </dd>
        </div>
      </dl>
    </section>

    <ConfirmDialog
      :open="!!current"
      :title="current?.title || ''"
      :message="current?.message || ''"
      :confirm-text="current?.confirmText || '确认'"
      danger
      @confirm="runConfirm"
      @cancel="confirmState = ''"
    />

    <ConfirmDialog
      :open="!!pendingImport"
      title="导入备份数据？"
      :message="`将按「${importMode === 'overwrite' ? '覆盖' : '合并'}」方式导入：覆盖层 ${
        Object.keys(pendingImport?.overrides || {}).length
      } 条、自建 ${(pendingImport?.customs || []).length} 个、记录 ${
        (pendingImport?.history || []).length
      } 条、相册索引 ${(pendingImport?.albumMeta || []).length} 条。`"
      confirm-text="开始导入"
      @confirm="doImport"
      @cancel="pendingImport = null"
    />
  </div>
</template>

<style scoped>
.block {
  padding: 20px 22px;
  margin-bottom: 14px;
}

.block h2 {
  font-size: 15px;
  color: var(--gs-gold-hi);
  letter-spacing: 0.08em;
  margin-bottom: 14px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.stats > div {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--gs-line);
  background: rgba(255, 255, 255, 0.02);
}

.k {
  display: block;
  font-size: 11.5px;
  color: var(--gs-ink-3);
}

.v {
  font-size: 20px;
  color: var(--gs-gold-hi);
  font-family: var(--gs-font-display);
}

.line {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--gs-ink-3);
}

.line b.ok {
  color: #7fd6a0;
}

.line b.bad {
  color: #f0776f;
}

.sep {
  margin: 0 8px;
  opacity: 0.5;
}

.desc {
  font-size: 12.5px;
  color: var(--gs-ink-2);
  line-height: 1.85;
  margin-bottom: 14px;
}

.desc b {
  color: var(--gs-gold);
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.mode {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--gs-ink-2);
  cursor: pointer;
}

.mode input {
  accent-color: var(--gs-gold);
}

.danger-row {
  display: grid;
  gap: 10px;
}

.ditem {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--gs-line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.ditem > div {
  flex: 1;
}

.dt {
  font-size: 13.5px;
  color: var(--gs-ink);
}

.dd {
  font-size: 11.5px;
  color: var(--gs-ink-3);
  margin-top: 2px;
}

.gs-btn.danger {
  color: #f0776f;
  border-color: rgba(240, 119, 111, 0.4);
}

.gs-btn.danger:hover {
  background: rgba(240, 119, 111, 0.12);
  color: #ff9d96;
}

.about {
  display: grid;
  gap: 10px;
}

.about div {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 12px;
  font-size: 12.5px;
}

.about dt {
  color: var(--gs-ink-3);
}

.about dd {
  margin: 0;
  color: var(--gs-ink-2);
  line-height: 1.8;
}

.about b {
  color: var(--gs-gold);
}

@media (max-width: 900px) {
  .about div {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
