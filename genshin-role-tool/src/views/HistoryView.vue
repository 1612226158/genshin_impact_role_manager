<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '@/components/PageHead.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import StyledSelect from '@/components/StyledSelect.vue'
import { useHistoryStore } from '@/stores/history'
import { useCharacterStore } from '@/stores/character'
import { useToastStore } from '@/stores/toast'
import { FIELD_LABELS } from '@/utils/merge'

const router = useRouter()
const history = useHistoryStore()
const store = useCharacterStore()
const toast = useToastStore()

const actionFilter = ref('全部')
const charFilter = ref('全部')

const ACTIONS = {
  update: { label: '修改', tone: 'edit' },
  create: { label: '新建', tone: 'new' },
  delete: { label: '隐藏', tone: 'del' },
  reset: { label: '恢复默认', tone: 'reset' },
  restore: { label: '撤销恢复', tone: 'undo' },
}

const charOptions = computed(() => {
  const seen = new Map()
  for (const e of history.list) {
    if (!seen.has(String(e.targetId))) seen.set(String(e.targetId), e.targetName)
  }
  return [
    { value: '全部', label: '全部角色' },
    ...[...seen].map(([id, name]) => ({ value: id, label: name || `#${id}` })),
  ]
})

const filtered = computed(() =>
  history.list.filter((e) => {
    if (actionFilter.value !== '全部' && ACTIONS[e.action]?.label !== actionFilter.value) {
      return false
    }
    if (charFilter.value !== '全部' && String(e.targetId) !== charFilter.value) return false
    return true
  })
)

function fmt(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`
}

function short(v) {
  if (v == null || v === '') return '（空）'
  const s = typeof v === 'object' ? '…' : String(v)
  return s.length > 26 ? `${s.slice(0, 26)}…` : s
}

function undo(e) {
  const res = store.undoEntry(e)
  if (res.ok) {
    toast.ok(res.partial?.length ? `已撤销，${res.partial.join('、')} 因被覆盖未回滚` : '已撤销该条记录')
  } else if (res.reason === 'conflict') {
    toast.err(`无法撤销：${res.fields.join('、')} 已被后续修改覆盖`)
  } else if (res.reason === 'not-found') {
    toast.err('目标角色已不存在')
  } else {
    toast.warn('该记录没有可撤销的字段')
  }
}

const clearTarget = ref(false)
function doClear() {
  history.clear()
  clearTarget.value = false
  toast.ok('编辑记录已清空')
}

const actionOptions = [
  { value: '全部', label: '全部动作' },
  ...Object.values(ACTIONS).map(({ label }) => ({ value: label, label })),
]
</script>

<template>
  <div class="page">
    <PageHead
      eyebrow="History"
      title="编辑记录"
      :desc="`共 ${history.count} 条记录，本地上限 ${history.MAX_ENTRIES} 条`"
    >
      <StyledSelect v-model="actionFilter" :options="actionOptions" label="动作" compact class="history-filter" />
      <StyledSelect v-model="charFilter" :options="charOptions" label="角色" compact class="history-filter" />
      <button v-if="history.count" type="button" class="gs-btn" @click="clearTarget = true">
        清空记录
      </button>
    </PageHead>

    <div v-if="filtered.length" class="timeline">
      <article v-for="e in filtered" :key="e.hid" class="entry gs-panel">
        <div class="rail">
          <span class="dot" :class="`t-${ACTIONS[e.action]?.tone || 'edit'}`"></span>
        </div>
        <div class="content">
          <header>
            <span class="tag" :class="`t-${ACTIONS[e.action]?.tone || 'edit'}`">
              {{ ACTIONS[e.action]?.label || e.action }}
            </span>
            <button
              type="button"
              class="who"
              @click="e.targetId && router.push(`/c/${e.targetId}`)"
            >
              {{ e.targetName || `#${e.targetId}` }}
            </button>
            <time class="nums">{{ fmt(e.ts) }}</time>
            <button type="button" class="undo" @click="undo(e)">撤销</button>
          </header>

          <ul v-if="e.changes?.length" class="changes">
            <li v-for="(c, i) in e.changes" :key="i">
              <span class="fname">{{ FIELD_LABELS[c.field] || c.field }}</span>
              <span class="before">{{ short(c.before) }}</span>
              <span class="arrow">→</span>
              <span class="after">{{ short(c.after) }}</span>
            </li>
          </ul>
          <p v-else class="nochange">无字段级变更（仅状态变化）</p>
        </div>
      </article>
    </div>

    <div v-else class="empty gs-panel">
      <p class="empty-title">还没有编辑记录</p>
      <p class="empty-desc">修改任意角色字段后，这里会留下可撤销的痕迹。</p>
      <button type="button" class="gs-btn" @click="router.push('/')">去角色库</button>
    </div>

    <ConfirmDialog
      :open="clearTarget"
      title="清空全部编辑记录？"
      message="记录清空后无法恢复，但角色数据本身不受影响。"
      confirm-text="确认清空"
      danger
      @confirm="doClear"
      @cancel="clearTarget = false"
    />
  </div>
</template>

<style scoped>
.history-filter {
  width: min(152px, 100%);
}

.timeline {
  display: grid;
  gap: 10px;
  padding-left: 4px;
}

.entry {
  display: grid;
  grid-template-columns: 26px 1fr;
  gap: 8px;
  padding: 14px 16px;
}

.rail {
  position: relative;
  display: flex;
  justify-content: center;
}

.rail::before {
  content: '';
  position: absolute;
  top: 12px;
  bottom: -26px;
  width: 1px;
  background: var(--gs-line);
}

.entry:last-child .rail::before {
  display: none;
}

.dot {
  width: 7px;
  height: 7px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--gs-gold);
  box-shadow: 0 0 10px rgba(211, 188, 142, 0.5);
}

.dot.t-new {
  background: #7fd6a0;
}
.dot.t-del {
  background: #f0776f;
}
.dot.t-reset {
  background: #7cb8e8;
}
.dot.t-undo {
  background: #d3bc8e;
}

.content header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tag {
  font-size: 11px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--gs-line-hi);
  color: var(--gs-gold);
}

.tag.t-new {
  color: #7fd6a0;
  border-color: rgba(127, 214, 160, 0.4);
}
.tag.t-del {
  color: #f0776f;
  border-color: rgba(240, 119, 111, 0.4);
}
.tag.t-reset {
  color: #7cb8e8;
  border-color: rgba(124, 184, 232, 0.4);
}

.who {
  font-size: 13.5px;
  color: var(--gs-ink);
  font-weight: 600;
}

.who:hover {
  color: var(--gs-gold-hi);
}

time {
  font-size: 11.5px;
  color: var(--gs-ink-3);
}

.undo {
  margin-left: auto;
  font-size: 12px;
  color: var(--gs-ink-3);
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.undo:hover {
  color: var(--gs-gold);
  border-color: var(--gs-line-hi);
}

.changes {
  margin-top: 8px;
  display: grid;
  gap: 4px;
}

.changes li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  flex-wrap: wrap;
}

.fname {
  color: var(--gs-ink-3);
  min-width: 58px;
}

.before {
  color: var(--gs-ink-3);
  text-decoration: line-through;
  text-decoration-color: rgba(240, 119, 111, 0.5);
}

.arrow {
  color: var(--gs-gold-deep);
  font-size: 11px;
}

.after {
  color: var(--gs-ink);
}

.nochange {
  margin-top: 8px;
  font-size: 12px;
  color: var(--gs-ink-3);
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
</style>
