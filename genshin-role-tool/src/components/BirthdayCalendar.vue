<script setup>
import { computed } from 'vue'
import { assetUrl } from '@/utils/asset'
import { elementColor } from '@/utils/element'

const props = defineProps({
  month: { type: Number, required: true },
  days: { type: Number, required: true },
  /** { [day]: character[] } */
  byDay: { type: Object, default: () => ({}) },
  today: { type: Object, default: () => ({ month: 0, day: 0 }) },
})
const emit = defineEmits(['pick'])

/** 无年份概念：仅按 12 个月排布，1 号固定第一列，因此不出现星期 */
const cells = computed(() =>
  Array.from({ length: props.days }, (_, i) => {
    const day = i + 1
    const list = props.byDay[day] || []
    return { day, list, first: list[0] || null }
  })
)

const isToday = (day) => props.today.month === props.month && props.today.day === day
const avatarOf = (c) => assetUrl(c?.images?.avatar || c?.images?.avatar_hd || '')

function pick(cell) {
  if (!cell.first) return
  emit('pick', cell.list, cell.day)
}
function onKey(e, cell) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    pick(cell)
  }
}
</script>

<template>
  <div class="cal">
    <div class="cal-grid">
      <div
        v-for="cell in cells"
        :key="cell.day"
        class="cell"
        :class="{ has: cell.first, multi: cell.list.length > 1, today: isToday(cell.day) }"
        :role="cell.first ? 'button' : undefined"
        :tabindex="cell.first ? 0 : undefined"
        :aria-haspopup="cell.list.length > 1 ? 'dialog' : undefined"
        :aria-label="cell.list.length > 1
          ? `${month} 月 ${cell.day} 日，${cell.list.length} 位角色生日，选择角色`
          : cell.first ? `${month} 月 ${cell.day} 日：${cell.first.name}，查看详情` : `${month} 月 ${cell.day} 日`"
        @click="pick(cell)"
        @keydown="onKey($event, cell)"
      >
        <span class="dnum nums">{{ cell.day }}</span>

        <template v-if="cell.first">
          <span class="who">
            <img
              v-if="avatarOf(cell.first)"
              class="face"
              :src="avatarOf(cell.first)"
              :alt="cell.first.name"
              loading="lazy"
              draggable="false"
              :style="{ '--c': elementColor(cell.first.element) }"
            />
            <span v-else class="face face-fallback" :style="{ '--c': elementColor(cell.first.element) }">
              {{ (cell.first.name || '?').slice(0, 1) }}
            </span>
          </span>
          <span v-if="cell.list.length > 1" class="more nums">+{{ cell.list.length - 1 }}</span>
          <span class="tip">{{ cell.first.name }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal-grid {
  display: grid;
  /* 固定 7 列：不出现星期标签，仅作为日历骨架 */
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  /* 限制整体宽度并居中，避免宽屏下左右边距不对称 */
  max-width: 780px;
  margin: 0 auto;
  width: 100%;
}

.cell {
  position: relative;
  aspect-ratio: 1;
  /* 兜底：任何情况下头像都不会溢出格子 */
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--gs-line);
  background: rgba(255, 255, 255, 0.014);
  transition: border-color 0.18s var(--gs-ease), background 0.18s var(--gs-ease),
    transform 0.18s var(--gs-ease);
}

.cell.has {
  cursor: pointer;
  border-color: rgba(211, 188, 142, 0.34);
  background: rgba(211, 188, 142, 0.05);
}

.cell.has:hover,
.cell.has:focus-visible {
  border-color: var(--gs-gold);
  background: rgba(211, 188, 142, 0.11);
  transform: translateY(-1px);
  outline: none;
}

.cell.today {
  box-shadow: inset 0 0 0 1px rgba(211, 188, 142, 0.55);
}

.dnum {
  position: absolute;
  top: 4px;
  left: 7px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.01em;
  color: var(--gs-ink-3);
  z-index: 2;
}

.cell.has .dnum {
  color: var(--gs-gold-hi);
}

/* 头像居中偏下但留出数字区域，且整体留在格子内 */
.who {
  position: absolute;
  left: 50%;
  bottom: 12%;
  transform: translateX(-50%);
  width: min(52%, 52px);
  height: min(52%, 52px);
  display: grid;
  place-items: center;
  z-index: 1;
}

.face {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  background: #efe9df;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5), 0 0 0 2px color-mix(in srgb, var(--c) 42%, transparent),
    0 3px 10px rgba(0, 0, 0, 0.35);
}

.face-fallback {
  display: grid;
  place-items: center;
  color: #6b5a3e;
  font-family: var(--gs-font-display);
  font-size: 15px;
  border-radius: 50%;
  background: rgba(240, 235, 224, 0.92);
}

.more {
  position: absolute;
  right: 4px;
  bottom: 4px;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 999px;
  color: #1a1208;
  background: var(--gs-gold);
  z-index: 3;
}

.tip {
  position: absolute;
  left: 50%;
  top: -22px;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  white-space: nowrap;
  color: var(--gs-ink);
  background: rgba(6, 18, 28, 0.94);
  border: 1px solid var(--gs-line-hi);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s var(--gs-ease);
  z-index: 4;
}

.cell.has:hover .tip,
.cell.has:focus-visible .tip {
  opacity: 1;
}

@media (max-width: 900px) {
  .cal-grid {
    gap: 4px;
  }
  .dnum {
    font-size: 10px;
    top: 3px;
    left: 4px;
  }
  .tip {
    display: none;
  }
}
</style>
