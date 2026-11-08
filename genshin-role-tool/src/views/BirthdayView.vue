<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '@/components/PageHead.vue'
import BirthdayCardCanvas from '@/components/BirthdayCardCanvas.vue'
import BirthdayCalendar from '@/components/BirthdayCalendar.vue'
import ElementBadge from '@/components/ElementBadge.vue'
import { useCharacterStore } from '@/stores/character'
import { useAlbumStore } from '@/stores/album'
import { useToastStore } from '@/stores/toast'
import { assetUrl } from '@/utils/asset'
import { pickGreeting } from '@/utils/greetings'

const store = useCharacterStore()
const album = useAlbumStore()
const toast = useToastStore()
const router = useRouter()

const now = new Date()
const todayM = now.getMonth() + 1
const todayD = now.getDate()

const qMonth = ref(todayM)
const qDay = ref(todayD)
const browseMonth = ref(todayM)

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/** 无年份概念：固定 12 个月的日历长度；2 月按 29 天（存在 2/29 生日） */
const CAL_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function daysInMonth(m) {
  return CAL_DAYS[m - 1] || 30
}

const dayOptions = computed(() => Array.from({ length: daysInMonth(qMonth.value) }, (_, i) => i + 1))

watch(qMonth, (m) => {
  if (qDay.value > daysInMonth(m)) qDay.value = daysInMonth(m)
})

const withBirthday = computed(() =>
  store.all.filter((c) => c.playable && c.birthdayMonth && c.birthdayDay)
)

/** 同日查询：2/28 与 2/29 互相兼顾（班尼特为闰年生日） */
const queryResults = computed(() => {
  const m = qMonth.value
  const d = qDay.value
  const exact = withBirthday.value.filter((c) => c.birthdayMonth === m && c.birthdayDay === d)
  let leapHint = []
  if (m === 2 && d === 28) {
    leapHint = withBirthday.value.filter((c) => c.birthdayMonth === 2 && c.birthdayDay === 29)
  } else if (m === 2 && d === 29) {
    leapHint = []
  }
  return { exact, leapHint, all: [...exact, ...leapHint] }
})

const monthGroups = computed(() => {
  const map = new Map()
  for (const c of withBirthday.value) {
    if (c.birthdayMonth !== browseMonth.value) continue
    const key = c.birthdayDay
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(c)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, list]) => ({ day, list }))
})

const monthCount = computed(() => monthGroups.value.reduce((s, g) => s + g.list.length, 0))

/* 日历视图：按日聚合当月生日，点击直接进入角色详情 */
const calendarDays = computed(() => daysInMonth(browseMonth.value))
const byDay = computed(() => {
  const map = {}
  for (const c of withBirthday.value) {
    if (c.birthdayMonth !== browseMonth.value) continue
    ;(map[c.birthdayDay] || (map[c.birthdayDay] = [])).push(c)
  }
  return map
})

function goCharacter(c) {
  if (c?.id) router.push(`/c/${c.id}`)
}

const noBirthday = computed(() => store.all.filter((c) => !c.birthdayMonth || !c.birthdayDay))

/** 距离最近的生日 */
function daysUntil(m, d) {
  const y = now.getFullYear()
  const realDay = Math.min(d, new Date(y, m, 0).getDate())
  let target = new Date(y, m - 1, realDay)
  const base = new Date(y, now.getMonth(), now.getDate())
  if (target < base) {
    const ny = y + 1
    const nd = Math.min(d, new Date(ny, m, 0).getDate())
    target = new Date(ny, m - 1, nd)
  }
  return Math.round((target - base) / 86400000)
}

const upcoming = computed(() => {
  const list = withBirthday.value
    .map((c) => ({ c, days: daysUntil(c.birthdayMonth, c.birthdayDay) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days)
  return list.slice(0, 5)
})

/* ---------- 生日卡 ---------- */
const selectedId = ref('')
const template = ref('portrait')
const greeting = ref('')

const selected = computed(() => store.get(selectedId.value) || queryResults.value.all[0] || null)

watch(
  selected,
  (c) => {
    if (c) greeting.value = pickGreeting(c.element, c.id)
  },
  { immediate: true }
)

onMounted(() => {
  if (queryResults.value.all.length) {
    selectedId.value = queryResults.value.all[0].id
    return
  }
  // 当天没有角色过生日时，默认选中最近的一位，保证生日卡区域不空着
  const first = upcoming.value[0]
  if (first) {
    selectedId.value = first.c.id
    browseMonth.value = first.c.birthdayMonth
  } else {
    selectedId.value = withBirthday.value[0]?.id || ''
  }
})

const cardRef = ref(null)
const saving = ref(false)

async function downloadCard() {
  if (!selected.value) {
    toast.warn('先选择一个角色')
    return
  }
  const blob = await cardRef.value?.exportBlob()
  if (!blob) {
    toast.err('生成失败，请稍后重试')
    return
  }
  const el = document.createElement('a')
  const url = URL.createObjectURL(blob)
  el.href = url
  el.download = `原神-${selected.value.name}-生日卡.png`
  document.body.appendChild(el)
  el.click()
  el.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  toast.ok('生日卡已下载')
}

async function saveCard() {
  if (!selected.value) return
  saving.value = true
  try {
    const blob = await cardRef.value?.exportBlob()
    if (!blob) throw new Error('empty')
    await album.addCard(blob, {
      title: `${selected.value.name} 生日卡`,
      characterId: selected.value.id,
      kind: 'card',
    })
    toast.ok('已保存到相册')
  } catch {
    toast.err('保存失败，可能是存储空间不足')
  } finally {
    saving.value = false
  }
}

function selectChar(c) {
  selectedId.value = c.id
}

function avatarOf(c) {
  return assetUrl(c.images?.avatar || c.images?.avatar_hd || '')
}
</script>

<template>
  <div class="page">
    <PageHead
      eyebrow="Birthday"
      title="生日工具"
      :desc="`已收录 ${withBirthday.length} 位角色的生日 · 今天是 ${todayM} 月 ${todayD} 日`"
    />

    <div class="banner gs-panel">
      <span class="banner-label">最近的生日</span>
      <div class="banner-list">
        <button
          v-for="u in upcoming"
          :key="u.c.id"
          type="button"
          class="banner-item"
          @click="selectChar(u.c); browseMonth = u.c.birthdayMonth"
        >
          <img v-if="avatarOf(u.c)" :src="avatarOf(u.c)" :alt="u.c.name" />
          <span class="bn">{{ u.c.name }}</span>
          <span class="bd">{{ u.days === 0 ? '就是今天' : `${u.days} 天后` }}</span>
        </button>
      </div>
    </div>

    <div class="layout">
      <div class="main">
        <section class="panel gs-panel">
          <header class="phead">
            <h2>同日查询</h2>
            <div class="qbar">
              <select v-model.number="qMonth" aria-label="月份">
                <option v-for="m in MONTHS" :key="m" :value="m">{{ m }} 月</option>
              </select>
              <select v-model.number="qDay" aria-label="日期">
                <option v-for="d in dayOptions" :key="d" :value="d">{{ d }} 日</option>
              </select>
              <button type="button" class="mini-btn" @click="qMonth = todayM; qDay = todayD">
                今天
              </button>
              <span class="count">命中 <b>{{ queryResults.all.length }}</b> 位</span>
            </div>
          </header>

          <div v-if="queryResults.all.length" class="results">
            <button
              v-for="c in queryResults.all"
              :key="c.id"
              type="button"
              class="rcard"
              :class="{ on: String(selectedId) === String(c.id) }"
              @click="selectChar(c)"
            >
              <img v-if="avatarOf(c)" :src="avatarOf(c)" :alt="c.name" loading="lazy" />
              <span class="rn">{{ c.name }}</span>
              <span class="rt">{{ c.title || c.nation }}</span>
              <span v-if="c.birthdayDay === 29 && c.birthdayMonth === 2" class="leap">闰年生日</span>
            </button>
          </div>
          <p v-else class="none">
            {{ qMonth }} 月 {{ qDay }} 日没有角色过生日，换一天看看？
          </p>
        </section>

        <section class="panel gs-panel">
          <header class="phead">
            <h2>按月浏览</h2>
            <span class="count">{{ browseMonth }} 月共 <b>{{ monthCount }}</b> 位</span>
          </header>

          <div class="mtabs">
            <button
              v-for="m in MONTHS"
              :key="m"
              type="button"
              class="mtab"
              :class="{ on: browseMonth === m }"
              @click="browseMonth = m"
            >
              {{ m }}月
              <em>{{ withBirthday.filter((c) => c.birthdayMonth === m).length }}</em>
            </button>
          </div>

          <!-- 按月浏览：日历网格（7 列骨架，无星期，2 月固定 29 天） -->
          <BirthdayCalendar
            :month="browseMonth"
            :days="calendarDays"
            :by-day="byDay"
            :today="{ month: todayM, day: todayD }"
            @pick="goCharacter"
          />
          <p v-if="!monthCount" class="none">这个月没有收录到生日。</p>
        </section>

        <section v-if="noBirthday.length" class="panel gs-panel">
          <header class="phead">
            <h2>未收录生日</h2>
            <span class="count">{{ noBirthday.length }} 条</span>
          </header>
          <div class="nolist">
            <span v-for="c in noBirthday" :key="c.id" class="notag">{{ c.name }}</span>
          </div>
          <p class="tip">这些条目没有生日数据（旅行者变体与「奇偶」杂项），不参与生日统计。</p>
        </section>
      </div>

      <aside class="side">
        <div class="panel gs-panel cardpanel">
          <header class="phead">
            <h2>生日卡</h2>
          </header>

          <BirthdayCardCanvas
            v-if="selected"
            ref="cardRef"
            :character="selected"
            :template="template"
            :greeting="greeting"
          />
          <p v-else class="none">先在上面选择一个角色。</p>

          <label class="fld">
            <span>模板</span>
            <select v-model="template">
              <option value="portrait">竖版 4:5 · 1080×1350</option>
              <option value="square">方版 1:1 · 1080×1080</option>
            </select>
          </label>

          <label class="fld">
            <span>祝贺语（最多 40 字）</span>
            <textarea v-model="greeting" rows="2" maxlength="40" />
          </label>

          <div class="ops">
            <button type="button" class="gs-btn primary" @click="downloadCard">下载 PNG</button>
            <button type="button" class="gs-btn" :disabled="saving" @click="saveCard">
              {{ saving ? '保存中…' : '保存到相册' }}
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 18px;
  margin-bottom: 16px;
  overflow: hidden;
}

.banner-label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--gs-gold-deep);
  letter-spacing: 0.14em;
}

.banner-list {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.banner-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px 4px 4px;
  border-radius: 999px;
  border: 1px solid var(--gs-line);
  background: rgba(255, 255, 255, 0.02);
  flex-shrink: 0;
  transition: all 0.18s var(--gs-ease);
}

.banner-item:hover {
  border-color: var(--gs-gold);
}

.banner-item img {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  background: #efe9df;
}

.bn {
  font-size: 12.5px;
  color: var(--gs-ink);
}

.bd {
  font-size: 11px;
  color: var(--gs-gold-deep);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 372px;
  gap: 16px;
  align-items: start;
}

.main {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.panel {
  padding: 16px 18px 18px;
}

.phead {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.phead h2 {
  font-size: 15px;
  color: var(--gs-gold-hi);
  letter-spacing: 0.08em;
}

.qbar {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 7px;
}

.qbar select,
.fld select {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--gs-line);
  background: rgba(6, 20, 32, 0.6);
  color: var(--gs-ink);
  font-size: 13px;
  outline: none;
}

.qbar option,
.fld option {
  background: #10293d;
}

.mini-btn {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--gs-line);
  font-size: 12px;
  color: var(--gs-ink-2);
}

.mini-btn:hover {
  border-color: var(--gs-gold);
  color: var(--gs-gold-hi);
}

.count {
  font-size: 12px;
  color: var(--gs-ink-3);
}

.count b {
  color: var(--gs-gold-hi);
}

.results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.rcard {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--gs-line);
  background: rgba(255, 255, 255, 0.02);
  text-align: left;
  transition: all 0.18s var(--gs-ease);
}

.rcard:hover,
.rcard.on {
  border-color: var(--gs-gold);
  background: rgba(211, 188, 142, 0.08);
}

.rcard img {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  background: #efe9df;
  margin-bottom: 4px;
}

.rn {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--gs-ink);
}

.rt {
  font-size: 11px;
  color: var(--gs-ink-3);
}

.leap {
  position: absolute;
  right: 8px;
  top: 8px;
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 999px;
  color: #7cb8e8;
  border: 1px solid rgba(124, 184, 232, 0.45);
}

.none {
  font-size: 13px;
  color: var(--gs-ink-3);
  padding: 8px 0 4px;
}

.mtabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.mtab {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--gs-line);
  font-size: 12.5px;
  color: var(--gs-ink-2);
  transition: all 0.18s var(--gs-ease);
}

.mtab em {
  font-style: normal;
  font-size: 10px;
  color: var(--gs-ink-3);
  margin-left: 3px;
}

.mtab:hover {
  border-color: var(--gs-line-hi);
}

.mtab.on {
  color: #1a1208;
  background: linear-gradient(180deg, var(--gs-gold-hi), var(--gs-gold));
  border-color: var(--gs-gold);
  font-weight: 600;
}

.mtab.on em {
  color: rgba(26, 18, 8, 0.6);
}

.groups {
  display: grid;
  gap: 8px;
}

.group {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 10px;
  align-items: start;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(211, 188, 142, 0.1);
}

.gday {
  font-size: 12.5px;
  color: var(--gs-gold-deep);
  padding-top: 5px;
}

.glist {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gitem {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px 4px 6px;
  border-radius: 999px;
  border: 1px solid var(--gs-line);
  transition: all 0.18s var(--gs-ease);
}

.gitem:hover,
.gitem.on {
  border-color: var(--gs-gold);
  background: rgba(211, 188, 142, 0.08);
}

.gn {
  font-size: 12.5px;
  color: var(--gs-ink);
}

.gt {
  font-size: 10.5px;
  color: var(--gs-ink-3);
}

.nolist {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.notag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px dashed var(--gs-line);
  color: var(--gs-ink-3);
}

.tip {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--gs-ink-3);
}

.side {
  position: sticky;
  top: 78px;
}

.cardpanel {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.fld textarea {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--gs-line);
  background: rgba(6, 20, 32, 0.6);
  color: var(--gs-ink);
  font-size: 12.5px;
  line-height: 1.7;
  resize: vertical;
  outline: none;
  font-family: inherit;
}

.fld textarea:focus {
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
  cursor: default;
}

@media (max-width: 1200px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
  }
}
</style>
