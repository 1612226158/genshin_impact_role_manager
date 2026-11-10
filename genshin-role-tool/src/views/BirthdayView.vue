<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '@/components/PageHead.vue'
import BirthdayCardModal from '@/components/BirthdayCardModal.vue'
import BirthdayCalendar from '@/components/BirthdayCalendar.vue'
import ElementBadge from '@/components/ElementBadge.vue'
import StyledSelect from '@/components/StyledSelect.vue'
import { useCharacterStore } from '@/stores/character'
import { useAlbumStore } from '@/stores/album'
import { useToastStore } from '@/stores/toast'
import { assetUrl } from '@/utils/asset'
import { pickGreeting } from '@/utils/greetings'
import { birthdayDaysInMonth as daysInMonth } from '@/utils/merge'
import { lockScroll, unlockScroll } from '@/utils/scrollLock'

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
const MONTH_OPTIONS = MONTHS.map((month) => ({ value: month, label: `${month} 月` }))

const dayOptions = computed(() =>
  Array.from({ length: daysInMonth(qMonth.value) }, (_, i) => ({ value: i + 1, label: `${i + 1} 日` }))
)

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

const picker = ref(null)
const pickedDate = ref(null)
const preferredAvatars = ref({})

function closePicker() {
  if (!picker.value?.open) return
  picker.value.close()
  unlockScroll()
  pickedDate.value = null
}

function goCharacter(c) {
  closePicker()
  router.push(`/c/${c.id}`)
}

async function pickBirthday(characters, day) {
  pickedDate.value = { month: browseMonth.value, day, characters }
  await nextTick()
  if (!picker.value || picker.value.open) return
  picker.value.showModal()
  lockScroll()
}

/* ---------- 月历轮播：循环轨道（首尾克隆）+ CSS 过渡，一次手势切一个月 ---------- */
const viewportRef = ref(null)
let wheelLock = 0
let wrapTimer
let snapFrame
const SLIDE_MS = 420

function motionOff() {
  return document.documentElement.classList.contains('no-motion')
}

function byDayFor(m) {
  const map = {}
  for (const c of withBirthday.value) {
    if (c.birthdayMonth !== m) continue
    ;(map[c.birthdayDay] || (map[c.birthdayDay] = [])).push(c)
  }
  return map
}

/** 每日生日索引按月份预计算，避免每次渲染重复聚合 */
const monthData = computed(() => {
  const o = {}
  for (const m of MONTHS) o[m] = { m, days: daysInMonth(m), byDay: byDayFor(m) }
  return o
})

/**
 * 轨道序列：12, 1, 2, …, 12, 1
 * 下标 0 是 12 月的克隆（向前翻的落脚点），下标 13 是 1 月的克隆（向后翻的落脚点）；
 * 落在克隆位后无动画瞬移到真实位，形成无缝循环。
 */
const SLIDES = [12, ...MONTHS, 1]

const monthCounts = computed(() => {
  const o = {}
  for (const m of MONTHS) o[m] = withBirthday.value.filter((c) => c.birthdayMonth === m).length
  return o
})
const monthCount = computed(() => monthCounts.value[browseMonth.value])

/** 轨道下标（0..13）；真实月份 m 对应下标 m */
const posIndex = ref(browseMonth.value)
/* 瞬移时不播动画 */
const jumping = ref(false)

const trackStyle = computed(() => ({
  transform: `translateX(${-posIndex.value * 100}%)`,
  '--slide-duration': `${SLIDE_MS}ms`,
}))

function snapToMonth() {
  posIndex.value = browseMonth.value
  if (jumping.value) return
  jumping.value = true
  snapFrame = requestAnimationFrame(() => {
    snapFrame = requestAnimationFrame(() => {
      jumping.value = false
    })
  })
}

function goMonth(month, direction = 0) {
  if (month === browseMonth.value) return
  clearTimeout(wrapTimer)
  const wasWrapping = posIndex.value !== browseMonth.value
  browseMonth.value = month

  // 克隆只用于过渡。关闭动效或中途再操作时，直接定位到实际月份。
  if (motionOff() || wasWrapping || jumping.value) {
    snapToMonth()
    return
  }

  if (direction > 0 && month === 1) posIndex.value = SLIDES.length - 1
  else if (direction < 0 && month === 12) posIndex.value = 0
  else posIndex.value = month

  if (posIndex.value !== month) {
    wrapTimer = setTimeout(snapToMonth, SLIDE_MS + 24)
  }
}

function step(direction) {
  const nextMonth = (browseMonth.value - 1 + direction + MONTHS.length) % MONTHS.length + 1
  goMonth(nextMonth, direction)
}

/** 滚轮切月：横向滚轮与普通纵向滚轮都支持；循环轮播因此不再有边界 */
function onWheel(e) {
  if (e.ctrlKey || e.metaKey) return
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (!delta) return
  e.preventDefault()
  const now = performance.now()
  if (now < wheelLock) return
  wheelLock = now + SLIDE_MS + 40
  step(delta > 0 ? 1 : -1)
}

function onTrackKey(e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  viewportRef.value.focus({ preventScroll: true })
  step(e.key === 'ArrowLeft' ? -1 : 1)
}

onBeforeUnmount(() => {
  closePicker()
  clearTimeout(wrapTimer)
  cancelAnimationFrame(snapFrame)
})

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
    goMonth(first.c.birthdayMonth)
  } else {
    selectedId.value = withBirthday.value[0]?.id || ''
  }
})

const cardOpen = ref(false)

function openCard() {
  if (!selected.value) {
    toast.warn('先选择一个角色')
    return
  }
  cardOpen.value = true
}

function selectChar(c) {
  selectedId.value = c.id
}

async function makeBirthdayCard(c) {
  const { month, day, characters } = pickedDate.value
  if (characters.length > 1) {
    const monthAvatars = preferredAvatars.value[month]
    preferredAvatars.value[month] = { ...monthAvatars, [day]: c.id }
  }
  closePicker()
  selectChar(c)
  await nextTick()
  cardOpen.value = true
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
          @click="selectChar(u.c); goMonth(u.c.birthdayMonth)"
        >
          <img v-if="avatarOf(u.c)" :src="avatarOf(u.c)" :alt="u.c.name" />
          <span class="bn">{{ u.c.name }}</span>
          <span class="bd">{{ u.days === 0 ? '就是今天' : `${u.days} 天后` }}</span>
        </button>
      </div>
    </div>

    <div class="layout">
      <div class="main">
        <section class="panel gs-panel query-panel">
          <header class="phead">
            <h2>同日查询</h2>
            <div class="qbar">
              <StyledSelect v-model="qMonth" :options="MONTH_OPTIONS" label="月份" hide-label />
              <StyledSelect v-model="qDay" :options="dayOptions" label="日期" hide-label />
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
              @click="goMonth(m)"
            >
              {{ m }}月
              <em>{{ monthCounts[m] }}</em>
            </button>
          </div>

          <!-- 月历轮播：横向滑动区域，一次手势切换一个月 -->
          <div
            ref="viewportRef"
            class="cal-carousel"
            role="group"
            aria-roledescription="轮播"
            aria-label="按月浏览日历，使用滚轮或左右方向键切换月份"
            tabindex="0"
            @wheel="onWheel"
            @keydown="onTrackKey"
          >
            <div
              class="cal-track"
              :class="{ jumping }"
              :style="trackStyle"
            >
              <div
                v-for="(m, i) in SLIDES"
                :key="`${i}-${m}`"
                class="cal-slide"
                :aria-hidden="posIndex !== i"
                :inert="posIndex !== i"
              >
                <BirthdayCalendar
                  :month="monthData[m].m"
                  :days="monthData[m].days"
                  :by-day="monthData[m].byDay"
                  :today="{ month: todayM, day: todayD }"
                  :active-id="selected?.id"
                  :preferred-by-day="preferredAvatars[m]"
                  @pick="pickBirthday"
                />
              </div>
            </div>
          </div>
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
          <header class="phead card-head">
            <h2>{{ selected ? `${selected.name} · 生日卡` : '生日卡' }}</h2>
            <RouterLink v-if="selected" class="mini-btn" :to="`/c/${selected.id}`">角色详情</RouterLink>
          </header>

          <div class="card-launch">
            <p class="launch-row">
              <span class="launch-name">{{ selected ? selected.name : '未选择角色' }}</span>
              <span v-if="selected" class="launch-meta">{{ selected.element || '无' }} · {{ selected.birthday || '—' }}</span>
            </p>
            <p class="launch-desc">
              在工坊里可自由切换画幅（1:1 / 3:4 / 4:3 / 任意比例）、编辑文案与装饰、拖拽立绘取景，
              并导出 PNG / JPEG / WebP（含 2× 高清），或直接送进相册拼图。
            </p>
            <button type="button" class="gs-btn primary" :disabled="!selected" @click="openCard">
              打开生日卡工坊
            </button>
          </div>
        </div>
      </aside>
    </div>

    <BirthdayCardModal v-model:open="cardOpen" :character="selected" :greeting="greeting" />

    <dialog ref="picker" class="gs-panel birthday-picker" aria-labelledby="birthday-picker-title" @cancel.prevent="closePicker">
      <template v-if="pickedDate">
        <header class="phead">
          <h2 id="birthday-picker-title">{{ pickedDate.month }} 月 {{ pickedDate.day }} 日生日</h2>
          <button type="button" class="gs-btn" autofocus @click="closePicker">关闭</button>
        </header>
        <div class="picker-roles">
          <div v-for="c in pickedDate.characters" :key="c.id" class="picker-role">
            <button type="button" class="banner-item picker-character" :aria-label="`查看${c.name}详情`" @click="goCharacter(c)">
              <img v-if="avatarOf(c)" :src="avatarOf(c)" alt="" />
              <span class="bn">{{ c.name }}</span>
              <span class="bd">详情</span>
            </button>
            <button type="button" class="gs-btn primary picker-card" :aria-label="`制作${c.name}的生日卡`" @click="makeBirthdayCard(c)">
              制作生日卡
            </button>
          </div>
        </div>
      </template>
    </dialog>
  </div>
</template>

<style scoped>
.birthday-picker {
  width: min(420px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 18px;
  color: var(--gs-ink);
  background: #10293d;
}

.birthday-picker::backdrop {
  background: #030c16b8;
}

.birthday-picker .phead {
  justify-content: space-between;
}

.picker-roles {
  display: grid;
  gap: 8px;
}

.picker-role {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.picker-character {
  padding: 6px 12px;
  text-align: left;
}

.picker-character .bd {
  margin-left: auto;
}

.picker-card {
  white-space: nowrap;
}

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
  grid-template-columns: minmax(0, 1fr) clamp(300px, 30vw, 372px);
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

.query-panel {
  /* 下拉菜单需要盖过下方独立堆叠的月历面板。 */
  z-index: 1;
}

.qbar {
  margin-left: auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.qbar .styled-select {
  width: 96px;
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
  /* 收缩到内容宽再整体居中：首尾留白（padding）与两两间距（gap）同为 8px */
  width: fit-content;
  margin: 0 auto 14px;
  justify-content: center;
  gap: 8px;
  padding: 0 8px;
}

/* 月历轮播：视口裁剪 + 轨道位移过渡（一次手势切一个月） */
.cal-carousel {
  position: relative;
  overflow: hidden;
  outline: none;
}

.cal-carousel:focus-visible {
  box-shadow: 0 0 0 2px var(--gs-gold);
  border-radius: 10px;
}

.cal-track {
  display: flex;
  will-change: transform;
  transition: transform var(--slide-duration) cubic-bezier(0.22, 0.8, 0.25, 1);
}

/* 克隆位归位时禁用过渡，实现无缝循环 */
.cal-track.jumping {
  transition: none;
}

:global(html.no-motion) .cal-track {
  transition: none;
}

.cal-slide {
  flex: 0 0 100%;
  min-width: 0;
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

.card-launch {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0 6px;
}

.launch-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}

.launch-name {
  font-family: var(--gs-font-display);
  font-size: 20px;
  color: var(--gs-ink);
}

.launch-meta {
  font-size: 12px;
  color: var(--gs-ink-3);
}

.launch-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--gs-ink-3);
}

.cardpanel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-head {
  justify-content: space-between;
}

.card-head h2 {
  scroll-margin-top: 84px;
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

@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
  }
}
</style>
