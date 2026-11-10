<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BirthdayCardCanvas from '@/components/BirthdayCardCanvas.vue'
import StyledSelect from '@/components/StyledSelect.vue'
import { useAlbumStore } from '@/stores/album'
import { useToastStore } from '@/stores/toast'
import { lockScroll, unlockScroll } from '@/utils/scrollLock'

const props = defineProps({
  character: { type: Object, default: null },
  open: { type: Boolean, default: false },
  greeting: { type: String, default: '' },
})
const emit = defineEmits(['update:open'])

const album = useAlbumStore()
const toast = useToastStore()
const router = useRouter()

const dialog = ref(null)
const canvasRef = ref(null)
const previewRef = ref(null)
const saving = ref(false)
const exporting = ref(false)

/* ---------- 画幅 ---------- */
const RATIOS = [
  { key: '1:1', label: '1:1', w: 1080, h: 1080 },
  { key: '3:4', label: '3:4', w: 1080, h: 1440 },
  { key: '4:3', label: '4:3', w: 1440, h: 1080 },
  { key: 'free', label: '自由', w: 1200, h: 1200 },
]
const ART_MODES = [
  { value: 'poster', label: '海报（竖版全身）' },
  { value: 'card', label: '卡牌（方形头像）' },
  { value: 'both', label: '两者都放（海报 + 卡牌插图）' },
]
const artMode = ref('poster')
const ratio = ref('3:4')
const size = reactive({ w: 1080, h: 1440 })

function applyRatio(key) {
  ratio.value = key
  const preset = RATIOS.find((r) => r.key === key)
  if (key !== 'free' && preset) {
    size.w = preset.w
    size.h = preset.h
  }
}

function setFreeSize(axis, value) {
  const n = Math.min(2400, Math.max(480, Math.round(Number(value) || 0)))
  if (!n) return
  size[axis] = n
  ratio.value = 'free'
}

/* ---------- 文案与装饰 ---------- */
const texts = reactive({ name: '', meta: '', greeting: '', sign: '', footer: '原神角色工具 · 素材版权归 miHoYo 所有' })
const show = reactive({ icon: true, halo: true, stars: true, frame: true, meta: true, sign: true, footer: true })
const art = reactive({ scale: 1, x: 0, y: 0 })
/* 「两者都放」时卡牌插图的独立取景 */
const cardArt = reactive({ scale: 1, x: 0, y: 0 })

const config = computed(() => ({
  width: size.w,
  height: size.h,
  artMode: artMode.value,
  texts: { ...texts },
  show: { ...show },
  art: { ...art },
  card: { ...cardArt },
}))

const TOGGLES = [
  { key: 'icon', label: '元素图标' },
  { key: 'halo', label: '元素光晕' },
  { key: 'stars', label: '星点底纹' },
  { key: 'frame', label: '金色内框' },
  { key: 'meta', label: '副标题' },
  { key: 'sign', label: '落款' },
  { key: 'footer', label: '页脚版权' },
]

function resetAll() {
  applyRatio('3:4')
  artMode.value = 'poster'
  Object.assign(texts, {
    name: '',
    meta: '',
    greeting: props.greeting || '',
    sign: '',
    footer: '原神角色工具 · 素材版权归 miHoYo 所有',
  })
  Object.assign(show, { icon: true, halo: true, stars: true, frame: true, meta: true, sign: true, footer: true })
  Object.assign(art, { scale: 1, x: 0, y: 0 })
  Object.assign(cardArt, { scale: 1, x: 0, y: 0 })
  toast.push('已重置为默认版式')
}

/* ---------- 立绘取景：拖拽 + 滑块 ---------- */
let drag = null
const clamp1 = (v) => Math.max(-1, Math.min(1, +v.toFixed(3)))

function onPointerDown(e) {
  const cv = previewRef.value?.querySelector('canvas')
  if (!cv || !canvasRef.value?.hitTest) return
  const rect = cv.getBoundingClientRect()
  const cssScale = cv.width / rect.width
  const cx = (e.clientX - rect.left) * cssScale
  const cy = (e.clientY - rect.top) * cssScale
  // 卡牌插图优先命中：它叠在海报之上
  const target = canvasRef.value.hitTest(cx, cy) || 'poster'
  const area = canvasRef.value.rectOf(target)
  const store = target === 'card' ? cardArt : art
  drag = {
    target,
    startX: e.clientX,
    startY: e.clientY,
    ox: store.x,
    oy: store.y,
    cssScale,
    // 归一化基准取各自区域尺寸：卡牌更小，同一手势下相对位移更大（速率不同）
    w: area?.w || cv.width,
    h: area?.h || cv.height,
  }
  try {
    previewRef.value.setPointerCapture?.(e.pointerId)
  } catch {
    /* 合成事件可能没有有效 pointerId */
  }
  e.preventDefault()
}

let moveFrame = 0
let pendingMove = null

function onPointerMove(e) {
  if (!drag) return
  const dx = ((e.clientX - drag.startX) * drag.cssScale) / (drag.w / 2)
  const dy = ((e.clientY - drag.startY) * drag.cssScale) / (drag.h / 2)
  pendingMove = { x: clamp1(drag.ox + dx), y: clamp1(drag.oy + dy) }
  // 一帧只回写一次状态：pointermove 可达 120Hz，逐次写会连带触发侧栏重渲染
  if (moveFrame) return
  moveFrame = requestAnimationFrame(() => {
    moveFrame = 0
    if (!drag || !pendingMove) return
    const store = drag.target === 'card' ? cardArt : art
    store.x = pendingMove.x
    store.y = pendingMove.y
    pendingMove = null
  })
}
function onPointerUp() {
  // 抬手先落定尚未提交的最后一帧，避免 rAF 未执行就结束导致丢失末次位移
  if (drag && pendingMove) {
    const store = drag.target === 'card' ? cardArt : art
    store.x = pendingMove.x
    store.y = pendingMove.y
    pendingMove = null
  }
  // 画布会按相纸边界夹紧位移，这里把生效值同步回状态，
  // 否则滑块会停在越界值上，回拖时出现「死区」
  if (drag && canvasRef.value?.effectiveOffsets) {
    const e = canvasRef.value.effectiveOffsets()
    art.x = e.art.x
    art.y = e.art.y
    cardArt.x = e.card.x
    cardArt.y = e.card.y
  }
  drag = null
}

/* ---------- 导出 ---------- */
const FORMAT_OPTIONS = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WebP' },
]
const format = ref('image/png')
const quality = ref(0.92)
const hd = ref(false)
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

async function buildBlob() {
  if (!canvasRef.value?.exportBlob) return null
  return canvasRef.value.exportBlob({
    type: format.value,
    quality: quality.value,
    scale: hd.value ? 2 : 1,
  })
}

async function exportImage() {
  if (!props.character) return
  exporting.value = true
  try {
    const blob = await buildBlob()
    if (!blob) throw new Error('empty')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `原神-${props.character.name}-生日卡.${EXT[format.value] || 'png'}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast.ok(`已导出 ${EXT[format.value].toUpperCase()}${hd.value ? '（2×）' : ''}`)
  } catch {
    toast.err('导出失败，请稍后重试')
  } finally {
    exporting.value = false
  }
}

async function exportToCollage() {
  if (!props.character) return
  saving.value = true
  try {
    const blob = await buildBlob()
    if (!blob) throw new Error('empty')
    const item = await album.addCard(blob, {
      title: `${props.character.name} 生日卡`,
      characterId: props.character.id,
      kind: 'card',
    })
    toast.ok('已加入相册，正在打开拼图')
    close()
    router.push({ path: '/album', query: { pick: item?.aid || '' } })
  } catch {
    toast.err('保存失败，可能是存储空间不足')
  } finally {
    saving.value = false
  }
}

/* ---------- 开关 ---------- */
function close() {
  emit('update:open', false)
}
function onCancel(e) {
  e.preventDefault()
  close()
}

watch(
  () => props.open,
  async (v) => {
    if (v) {
      resetAll()
      await nextTick()
      dialog.value?.showModal()
      lockScroll()
    } else {
      dialog.value?.close()
      unlockScroll()
    }
  }
)

onBeforeUnmount(() => {
  cancelAnimationFrame(moveFrame)
  if (dialog.value?.open) unlockScroll()
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="card-dialog" aria-labelledby="card-title" @cancel="onCancel" @click.self="close">
      <div class="card-shell">
        <header class="chead">
          <div>
            <p class="eyebrow">Birthday Card</p>
            <h1 id="card-title">{{ character?.name || '角色' }} · 生日卡制作</h1>
          </div>
          <div class="head-ops">
            <button type="button" class="gs-btn" @click="resetAll">重置版式</button>
            <button type="button" class="gs-btn" @click="close">关闭</button>
          </div>
        </header>

        <div class="cbody">
          <div
            ref="previewRef"
            class="preview"
            :class="{ dragging: Boolean(drag) }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <BirthdayCardCanvas v-if="character" ref="canvasRef" :character="character" :config="config" />
            <p class="hint">拖拽海报或卡牌可分别调整取景（各自速率不同）· 也可用右侧滑块微调</p>
          </div>

          <aside class="controls" aria-label="卡片设置">
            <section class="blk">
              <h2>画幅</h2>
              <div class="row">
                <button
                  v-for="r in RATIOS"
                  :key="r.key"
                  type="button"
                  class="gs-pill"
                  :class="{ 'is-on': ratio === r.key }"
                  @click="applyRatio(r.key)"
                >
                  {{ r.label }}
                </button>
              </div>
              <div class="row sizes">
                <label class="num">
                  <span>宽</span>
                  <input :value="size.w" type="number" min="480" max="2400" step="10" @change="setFreeSize('w', $event.target.value)" />
                </label>
                <label class="num">
                  <span>高</span>
                  <input :value="size.h" type="number" min="480" max="2400" step="10" @change="setFreeSize('h', $event.target.value)" />
                </label>
                <span class="ratio-note">{{ (size.w / size.h).toFixed(2) }} : 1</span>
              </div>
            </section>

            <section class="blk">
              <h2>立绘来源</h2>
              <StyledSelect v-model="artMode" :options="ART_MODES" label="立绘来源" hide-label />
            </section>

            <section class="blk">
              <h2>立绘取景</h2>

              <!-- 海报（或单张卡牌）取景 -->
              <template v-if="artMode !== 'card'">
                <p v-if="artMode === 'both'" class="sub-title">海报</p>
                <label class="range">
                  <span>缩放 {{ Math.round(art.scale * 100) }}%</span>
                  <input v-model.number="art.scale" type="range" min="0.6" max="2" step="0.02" />
                </label>
                <label class="range">
                  <span>水平 {{ Math.round(art.x * 100) }}</span>
                  <input v-model.number="art.x" type="range" min="-1" max="1" step="0.02" />
                </label>
                <label class="range">
                  <span>垂直 {{ Math.round(art.y * 100) }}</span>
                  <input v-model.number="art.y" type="range" min="-1" max="1" step="0.02" />
                </label>
              </template>

              <!-- 卡牌：两种放置方式共用「卡牌」这组标题 -->
              <template v-if="artMode === 'card'">
                <p class="sub-title">卡牌</p>
                <label class="range">
                  <span>缩放 {{ Math.round(art.scale * 100) }}%</span>
                  <input v-model.number="art.scale" type="range" min="0.6" max="2" step="0.02" />
                </label>
                <label class="range">
                  <span>水平 {{ Math.round(art.x * 100) }}</span>
                  <input v-model.number="art.x" type="range" min="-1" max="1" step="0.02" />
                </label>
                <label class="range">
                  <span>垂直 {{ Math.round(art.y * 100) }}</span>
                  <input v-model.number="art.y" type="range" min="-1" max="1" step="0.02" />
                </label>
              </template>

              <!-- 两者都放：卡牌插图独立取景 -->
              <template v-if="artMode === 'both'">
                <p class="sub-title">卡牌插图</p>
                <label class="range">
                  <span>缩放 {{ Math.round(cardArt.scale * 100) }}%</span>
                  <input v-model.number="cardArt.scale" type="range" min="0.4" max="1.8" step="0.02" />
                </label>
                <label class="range">
                  <span>水平 {{ Math.round(cardArt.x * 100) }}</span>
                  <input v-model.number="cardArt.x" type="range" min="-1" max="1" step="0.02" />
                </label>
                <label class="range">
                  <span>垂直 {{ Math.round(cardArt.y * 100) }}</span>
                  <input v-model.number="cardArt.y" type="range" min="-1" max="1" step="0.02" />
                </label>
              </template>
            </section>

            <section class="blk">
              <h2>文案</h2>
              <label class="field">
                <span>名字</span>
                <input v-model="texts.name" type="text" maxlength="16" :placeholder="character?.name || '角色名'" />
              </label>
              <label class="field">
                <span>副标题</span>
                <input v-model="texts.meta" type="text" maxlength="40" placeholder="留空则自动生成（生日 · 命座 · 元素）" />
              </label>
              <label class="field">
                <span>祝福语</span>
                <textarea v-model="texts.greeting" rows="2" maxlength="60" placeholder="最多两行" />
              </label>
              <div class="two">
                <label class="field">
                  <span>落款</span>
                  <input v-model="texts.sign" type="text" maxlength="16" placeholder="如：旅行者" />
                </label>
                <label class="field">
                  <span>页脚</span>
                  <input v-model="texts.footer" type="text" maxlength="40" />
                </label>
              </div>
            </section>

            <section class="blk">
              <h2>显示元素</h2>
              <div class="toggles">
                <label v-for="t in TOGGLES" :key="t.key" class="toggle">
                  <input v-model="show[t.key]" type="checkbox" />
                  <span>{{ t.label }}</span>
                </label>
              </div>
            </section>

            <section class="blk">
              <h2>导出</h2>
              <div class="row">
                <StyledSelect v-model="format" :options="FORMAT_OPTIONS" label="导出格式" hide-label compact class="fmt-select" />
                <label class="toggle">
                  <input v-model="hd" type="checkbox" />
                  <span>2× 高清</span>
                </label>
              </div>
              <label v-if="format !== 'image/png'" class="range">
                <span>画质 {{ Math.round(quality * 100) }}%</span>
                <input v-model.number="quality" type="range" min="0.5" max="1" step="0.02" />
              </label>
              <p class="out-note">
                输出尺寸 {{ size.w * (hd ? 2 : 1) }} × {{ size.h * (hd ? 2 : 1) }} px ·
                {{ EXT[format].toUpperCase() }}
              </p>
              <div class="ops">
                <button type="button" class="gs-btn primary" :disabled="exporting" @click="exportImage">
                  {{ exporting ? '导出中…' : '导出图片' }}
                </button>
                <button type="button" class="gs-btn" :disabled="saving" @click="exportToCollage">
                  {{ saving ? '保存中…' : '导出到拼图' }}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.card-dialog {
  width: min(1180px, calc(100vw - 40px));
  max-width: none;
  height: min(900px, calc(100dvh - 48px));
  margin: auto;
  padding: 0;
  border: 1px solid var(--gs-line-hi);
  border-radius: 18px;
  color: var(--gs-ink);
  background: #0c2438;
  overflow: hidden;
}

.card-dialog::backdrop {
  background: #030c16cc;
  backdrop-filter: blur(6px);
}

.card-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--gs-line);
}

.eyebrow {
  margin: 0 0 2px;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--gs-ink-3);
  text-transform: uppercase;
}

.chead h1 {
  margin: 0;
  font-family: var(--gs-font-display);
  font-size: 20px;
  font-weight: 500;
}

.head-ops {
  display: flex;
  gap: 8px;
}

.cbody {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
}

.preview {
  position: relative;
  display: grid;
  place-items: center;
  padding: 22px;
  background: radial-gradient(ellipse at 50% 30%, #14324a, #08161f 70%);
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}

.preview.dragging {
  cursor: grabbing;
}

.preview :deep(.card-canvas) {
  max-height: 100%;
  max-width: 100%;
  width: auto;
}

.hint {
  position: absolute;
  bottom: 10px;
  left: 0;
  right: 0;
  margin: 0;
  text-align: center;
  font-size: 11px;
  color: rgba(226, 216, 196, 0.55);
}

.controls {
  overflow-y: auto;
  padding: 16px 18px 26px;
  border-left: 1px solid var(--gs-line);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.blk h2 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--gs-ink-3);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--gs-line-hi);
  background: transparent;
  color: var(--gs-ink-2);
  font-size: 12.5px;
  cursor: pointer;
}

.chip.on {
  border-color: var(--gs-gold);
  color: var(--gs-gold-hi);
  background: rgba(211, 188, 142, 0.12);
}

.sizes {
  margin-top: 8px;
}

.num {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--gs-ink-3);
}

.num input {
  width: 74px;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--gs-line-hi);
  background: #10293d;
  color: var(--gs-ink);
  font-size: 12px;
}

.ratio-note {
  font-size: 11.5px;
  color: var(--gs-ink-3);
}

.sub-title {
  margin: 2px 0 6px;
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--gs-gold);
}

.range {
  display: grid;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--gs-ink-2);
}

.range input[type='range'] {
  width: 100%;
  accent-color: var(--gs-gold);
}

.field {
  display: grid;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--gs-ink-2);
}

.field input,
.field textarea,
.sel {
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--gs-line-hi);
  background: #10293d;
  color: var(--gs-ink);
  font-size: 12.5px;
  font-family: inherit;
  resize: vertical;
}

.sel {
  width: auto;
  min-width: 92px;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.toggles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--gs-ink-2);
}

.toggle input {
  accent-color: var(--gs-gold);
}

.out-note {
  margin: 6px 0 10px;
  font-size: 11.5px;
  color: var(--gs-ink-3);
}

.ops {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .card-dialog {
    width: calc(100vw - 16px);
    height: calc(100dvh - 20px);
  }
  .cbody {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(200px, 46%) minmax(0, 1fr);
  }
  .controls {
    border-left: 0;
    border-top: 1px solid var(--gs-line);
  }
  .toggles {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
