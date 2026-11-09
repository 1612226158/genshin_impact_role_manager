<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { assetUrl } from '@/utils/asset'
import { lockScroll, unlockScroll } from '@/utils/scrollLock'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ElementBadge from '@/components/ElementBadge.vue'
import StyledSelect from '@/components/StyledSelect.vue'
import { useCharacterStore } from '@/stores/character'
import { useToastStore } from '@/stores/toast'
import { NATIONS, WEAPONS, elementIcon, nationIcon } from '@/utils/element'
import { birthdayDaysInMonth, parseBirthday } from '@/utils/merge'

const props = defineProps({ characterId: { type: String, required: true }, returnFocus: { default: null } })
const emit = defineEmits(['close'])
const dialog = ref(null)
let returnFocus
let locked = false
const router = useRouter()
const store = useCharacterStore()
const toast = useToastStore()

const isNew = computed(() => props.characterId === 'new')
const source = computed(() => (isNew.value ? null : store.get(props.characterId)))

const emptyCharacter = () => ({
  name: '',
  title: '',
  nation: '蒙德',
  region_official: '',
  affiliation: '',
  element: '火',
  weapon: '单手剑',
  star: 5,
  birthday: '',
  constellation: '',
  role: '',
  cv: { 中: '', 日: '', 英: '', 韩: '' },
  images: { avatar: '', avatar_hd: '', paintings: [] },
  story: { summary: '', sections: [] },
})

const form = reactive(emptyCharacter())
const origin = ref(null)
const dirty = ref(false)
const errors = reactive({})


const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/* 选择项统一走组件库 StyledSelect（带元素/国度图标），不使用系统原生 select */
const iconUrl = (p) => (p ? assetUrl(p) : '')
const nationOpts = NATIONS.map((n) => ({ value: n, label: n, icon: iconUrl(nationIcon(n)) }))
const elementOpts = computed(() =>
  store.elementOrder.map((e) => ({ value: e, label: e, icon: iconUrl(elementIcon(e)) }))
)
const weaponOpts = WEAPONS.map((w) => ({ value: w, label: w }))
const starOpts = [5, 4, 3, 2, 1].map((s) => ({ value: s, label: `${s} 星` }))
const monthOpts = [{ value: '', label: '不设置生日' }, ...MONTHS.map((m) => ({ value: m, label: `${m} 月` }))]

const bdMonth = ref('')
const bdDay = ref('')
const dayOpts = computed(() =>
  Array.from({ length: birthdayDaysInMonth(bdMonth.value) }, (_, i) => ({ value: i + 1, label: `${i + 1} 日` }))
)

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}

function loadIntoForm() {
  const c = source.value
  const base = c ? clone(c) : emptyCharacter()
  Object.assign(form, {
    name: base.name || '',
    title: base.title || '',
    nation: base.nation || '蒙德',
    region_official: base.region_official || '',
    affiliation: base.affiliation || '',
    element: base.element || '火',
    weapon: base.weapon || '单手剑',
    star: base.star || 5,
    birthday: base.birthday || '',
    constellation: base.constellation || '',
    role: base.role || '',
    cv: { 中: '', 日: '', 英: '', 韩: '', ...(base.cv || {}) },
    images: {
      avatar: base.images?.avatar || '',
      avatar_hd: base.images?.avatar_hd || '',
      paintings: clone(base.images?.paintings || []),
    },
    story: { summary: base.story?.summary || '', sections: clone(base.story?.sections || []) },
  })

  const m = /(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(form.birthday)
  bdMonth.value = m ? String(Number(m[1])) : ''
  bdDay.value = m ? String(Number(m[2])) : ''

  origin.value = clone({
    name: form.name,
    title: form.title,
    nation: form.nation,
    region_official: form.region_official,
    affiliation: form.affiliation,
    element: form.element,
    weapon: form.weapon,
    star: form.star,
    birthday: form.birthday,
    constellation: form.constellation,
    role: form.role,
    cv: form.cv,
    images: form.images,
    story: form.story,
  })
  dirty.value = false
}

const previewPaintings = computed(() => {
  const paths = form.images.paintings.map(p => p.file).filter(Boolean)
  if (!paths.length && form.images.avatar_hd) paths.push(form.images.avatar_hd)
  return paths.slice(0, 3)
})
onMounted(() => {
  loadIntoForm()
  returnFocus = props.returnFocus || document.activeElement
  dialog.value.showModal()
  lockScroll()
  locked = true
  dialog.value.querySelector('input')?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  removeGuard()
  dialog.value?.close()
  if (locked) unlockScroll()
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
})

function syncBirthday() {
  if (!bdMonth.value || Number(bdDay.value) > birthdayDaysInMonth(bdMonth.value)) {
    bdDay.value = ''
  }
  if (bdMonth.value && bdDay.value) {
    form.birthday = `${bdMonth.value}月${bdDay.value}日`
  } else {
    form.birthday = ''
  }
  delete errors.birthday
  dirty.value = true
}

function markDirty() {
  dirty.value = true
}

function validate() {
  Object.keys(errors).forEach((k) => delete errors[k])
  const star = Number(form.star)
  const birthday = form.birthday.trim()
  if (!form.name.trim()) errors.name = '名称不能为空'
  if (!star || star < 1 || star > 5) errors.star = '星级需在 1–5 之间'
  if ((bdMonth.value && !bdDay.value) || (birthday && birthday !== '——' && !parseBirthday(birthday).month)) {
    errors.birthday = '请选择有效的月份和日期，或选择不设置生日'
  }
  const dup = store.all.find(
    (c) =>
      c.name.trim() === form.name.trim() && String(c.id) !== String(props.characterId)
  )
  if (dup) errors.name = `已存在同名角色「${dup.name}」，仍可保存`
  return !errors.birthday && (!errors.name || errors.name.includes('仍可保存'))
}

function payload() {
  return {
    name: form.name.trim(),
    title: form.title.trim(),
    nation: form.nation,
    region_official: form.region_official.trim(),
    affiliation: form.affiliation.trim(),
    element: form.element,
    weapon: form.weapon,
    star: Number(form.star),
    birthday: form.birthday,
    constellation: form.constellation.trim(),
    role: form.role.trim(),
    cv: { ...form.cv },
    images: clone(form.images),
    story: clone(form.story),
  }
}

function save() {
  if (!validate()) {
    toast.warn('请先修正表单中的问题')
    return
  }
  const data = payload()
  if (isNew.value) {
    const id = store.createCharacter(data)
    toast.ok(`已创建角色「${data.name}」`)
    dirty.value = false
    emit('close')
    router.push(`/c/${id}`)
    return
  }
  const changes = store.saveCharacter(props.characterId, data)
  if (changes.length) {
    toast.ok(`已保存 ${changes.length} 项修改`)
  } else {
    toast.push('没有检测到改动')
  }
  dirty.value = false
  emit('close')
}

const showLeave = ref(false)
let pendingNavigation = null
function cancel() {
  if (dirty.value) { showLeave.value = true; return }
  emit('close')
}
const removeGuard = router.beforeEach(to => {
  if (!dirty.value) { emit('close'); return true }
  pendingNavigation = to.fullPath
  showLeave.value = true
  return false
})
function confirmLeave() {
  dirty.value = false
  showLeave.value = false
  emit('close')
  if (pendingNavigation) router.push(pendingNavigation)
}

/* 故事分节编辑 */
function addSection() {
  form.story.sections.push({ section: `角色故事${form.story.sections.length + 1}`, text: '' })
  markDirty()
}

function removeSection(i) {
  form.story.sections.splice(i, 1)
  markDirty()
}

/* 立绘路径编辑 */
const newPainting = ref('')
function addPainting() {
  const v = newPainting.value.trim()
  if (!v) return
  form.images.paintings.push({ label: '自定义', file: v })
  newPainting.value = ''
  markDirty()
}

function removePainting(i) {
  form.images.paintings.splice(i, 1)
  markDirty()
}

const canReset = computed(() => !isNew.value && store.getDefault(props.characterId))
const resetTarget = ref(false)

function doReset() {
  store.resetCharacter(props.characterId)
  resetTarget.value = false
  toast.ok('已恢复为官方原始数据')
  loadIntoForm()
  emit('close')
}

const deleteTarget = ref(false)
function doDelete() {
  store.softDelete(props.characterId)
  deleteTarget.value = false
  dirty.value = false
  toast.ok('角色已隐藏，可在设置中恢复')
  emit('close')
  router.push('/')
}

const isEdited = computed(() => store.editedIds.has(String(props.characterId)))
</script>

<template>
  <Teleport to="body">
  <dialog ref="dialog" class="character-editor-dialog" aria-labelledby="editor-title" @cancel.prevent="cancel" @click.self="cancel">
    <div class="editor-shell">
    <header class="ehead">
      <button type="button" class="back" @click="cancel">←</button>
      <div>
        <p class="eyebrow">{{ isNew ? 'NEW' : 'EDIT' }}</p>
        <h1 id="editor-title" class="page-title">{{ isNew ? '新建角色' : `编辑 · ${source?.name || ''}` }}</h1>
      </div>
      <div class="head-ops">
        <span v-if="isEdited" class="badge">已修改</span>
        <button type="button" class="gs-btn" @click="cancel">取消</button>
        <button type="button" class="gs-btn primary" @click="save">保存</button>
      </div>
    </header>

    <div class="editor-layout">
      <aside class="editor-art" aria-label="角色立绘预览">
        <div class="painting-stack">
          <img v-for="(src, i) in previewPaintings" :key="src" :src="assetUrl(src)" :alt="`${form.name || '新角色'}立绘预览`" :style="{ '--layer': i }" draggable="false" />
          <div v-if="!previewPaintings.length" class="painting-placeholder">添加立绘后<br />在这里预览</div>
        </div>
        <div class="art-caption"><ElementBadge :element="form.element" /><strong>{{ form.name || '你的新角色' }}</strong><span>{{ form.title || '角色档案' }}</span></div>
      </aside>
    <form class="form" @submit.prevent="save">
      <section class="block gs-panel">
        <h2>基础信息</h2>
        <div class="grid2">
          <label class="field">
            <span>名称 <em>*</em></span>
            <input v-model="form.name" type="text" maxlength="24" @input="markDirty" />
            <small v-if="errors.name" class="err">{{ errors.name }}</small>
          </label>
          <label class="field">
            <span>称号</span>
            <input v-model="form.title" type="text" maxlength="32" @input="markDirty" />
          </label>

          <div class="field">
            <span>国度</span>
            <StyledSelect
              v-model="form.nation"
              :options="nationOpts"
              hide-label label="国度"
              placeholder="选择国度"
              @update:model-value="markDirty"
            />
          </div>
          <label class="field">
            <span>所属</span>
            <input v-model="form.affiliation" type="text" @input="markDirty" />
          </label>

          <div class="field">
            <span>元素</span>
            <StyledSelect
              v-model="form.element"
              :options="elementOpts"
              hide-label label="元素"
              placeholder="选择元素"
              @update:model-value="markDirty"
            />
          </div>
          <div class="field">
            <span>武器</span>
            <StyledSelect
              v-model="form.weapon"
              :options="weaponOpts"
              hide-label label="武器"
              placeholder="选择武器"
              @update:model-value="markDirty"
            />
          </div>

          <div class="field">
            <span>星级</span>
            <StyledSelect
              v-model="form.star"
              :options="starOpts"
              hide-label label="星级"
              placeholder="选择星级"
              @update:model-value="markDirty"
            />
          </div>
          <div class="field">
            <span>生日</span>
            <div class="bd">
              <StyledSelect
                v-model="bdMonth"
                :options="monthOpts"
                hide-label label="生日月份"
                placeholder="月份"
                @update:model-value="syncBirthday"
              />
              <StyledSelect
                v-model="bdDay"
                :options="dayOpts"
                hide-label label="生日日期"
                :placeholder="bdMonth ? '选择日期' : '请先选择月份'"
                @update:model-value="syncBirthday"
              />
            </div>
            <small v-if="errors.birthday" class="err" role="alert">{{ errors.birthday }}</small>
          </div>

          <label class="field">
            <span>命之座</span>
            <input v-model="form.constellation" type="text" @input="markDirty" />
          </label>
          <label class="field">
            <span>定位</span>
            <input v-model="form.role" type="text" @input="markDirty" />
          </label>
        </div>

        <h3>配音</h3>
        <div class="grid4">
          <label v-for="k in ['中', '日', '英', '韩']" :key="k" class="field">
            <span>{{ k }}文 CV</span>
            <input v-model="form.cv[k]" type="text" @input="markDirty" />
          </label>
        </div>
      </section>

      <section class="block gs-panel">
        <h2>图片</h2>
        <label class="field">
          <span>头像大图（686×800）</span>
          <input v-model="form.images.avatar_hd" type="text" @input="markDirty" placeholder="assets/avatars/xxx_hd.webp" />
        </label>
        <label class="field">
          <span>头像小图（196×196）</span>
          <input v-model="form.images.avatar" type="text" @input="markDirty" placeholder="assets/avatars/xxx_icon.webp" />
        </label>

        <h3>立绘</h3>
        <ul class="paintings">
          <li v-for="(p, i) in form.images.paintings" :key="i">
            <input v-model="p.file" type="text" @input="markDirty" />
            <button type="button" class="mini" @click="removePainting(i)">移除</button>
          </li>
        </ul>
        <div class="add-row">
          <input v-model="newPainting" type="text" placeholder="assets/paintings/xxx.webp" />
          <button type="button" class="gs-btn" @click="addPainting">添加立绘</button>
        </div>
        <p class="tip">素材路径相对于站点根目录；也可从相册上传后复制其路径。</p>
      </section>

      <section class="block gs-panel">
        <h2>背景故事</h2>
        <div v-for="(s, i) in form.story.sections" :key="i" class="section-edit">
          <div class="sec-head">
            <input v-model="s.section" type="text" class="sec-name" @input="markDirty" />
            <button type="button" class="mini" @click="removeSection(i)">删除本节</button>
          </div>
          <textarea v-model="s.text" rows="6" @input="markDirty" />
        </div>
        <p v-if="!form.story.sections.length" class="tip">暂无故事分节。</p>
        <button type="button" class="gs-btn" @click="addSection">＋ 添加分节</button>
      </section>

      <footer class="foot">
        <button type="button" class="gs-btn primary" @click="save">保存修改</button>
        <button type="button" class="gs-btn" @click="cancel">取消</button>
        <span class="spacer"></span>
        <button v-if="canReset" type="button" class="gs-btn" @click="resetTarget = true">
          恢复默认
        </button>
        <button v-if="!isNew" type="button" class="gs-btn danger-ghost" @click="deleteTarget = true">
          删除角色
        </button>
      </footer>
    </form>
    </div>
    </div>

    <ConfirmDialog inline
      :open="showLeave"
      title="放弃未保存的修改？"
      message="离开后本次改动将不会保留。"
      confirm-text="放弃并离开"
      danger
      @confirm="confirmLeave"
      @cancel="showLeave = false"
    />

    <ConfirmDialog inline
      :open="resetTarget"
      title="恢复为官方原始数据？"
      message="该角色的所有本地修改都会被清除，此操作会记入编辑记录。"
      confirm-text="恢复默认"
      @confirm="doReset"
      @cancel="resetTarget = false"
    />

    <ConfirmDialog inline
      :open="deleteTarget"
      title="隐藏这个角色？"
      message="角色会从列表与生日工具中移除，原始数据不会删除，可随时恢复。"
      confirm-text="隐藏角色"
      danger
      @confirm="doDelete"
      @cancel="deleteTarget = false"
    />
  </dialog>
  </Teleport>
</template>

<style scoped>
.character-editor-dialog {
  width: min(1120px, calc(100vw - 48px)); max-width: none; height: min(880px, calc(100dvh - 56px));
  margin: auto; padding: 0; border: 1px solid var(--gs-line-hi); border-radius: 18px; color: var(--gs-ink);
  background: radial-gradient(ellipse at 10% 20%, #1c4859 0%, #10293d 40%, #071521 100%); overflow: hidden;
  box-shadow: 0 32px 100px #0009;
}
.character-editor-dialog::backdrop { background: #030c16b8; backdrop-filter: blur(8px); }
.editor-shell { height: 100%; display: flex; flex-direction: column; }
.editor-layout { display: grid; grid-template-columns: minmax(220px, 30%) minmax(0, 1fr); flex: 1; min-height: 0; }
.editor-art { position: relative; display: flex; flex-direction: column; justify-content: center; padding: 30px 22px 24px; isolation: isolate; }
.painting-stack { position: relative; height: 65%; min-height: 240px; perspective: 1000px; }
.painting-stack img { position: absolute; width: 90%; height: 100%; left: 5%; top: 0; object-fit: contain; border-radius: 8px; filter: drop-shadow(0 15px 20px #0008); transform: translate(calc(var(--layer) * 9px), calc(var(--layer) * -10px)) rotate(calc((var(--layer) - 1) * 5deg)); z-index: calc(4 - var(--layer)); }
.painting-stack::before, .painting-stack::after { content: ''; position: absolute; inset: 12px 8%; border: 1px solid var(--gs-line-hi); border-radius: 10px; background: #18374d88; transform: rotate(7deg); z-index: -1; }
.painting-stack::after { transform: rotate(-5deg); }
.painting-placeholder { display: grid; place-content: center; height: 100%; text-align: center; color: var(--gs-ink-3); line-height: 2; }
.art-caption { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 25px; }
.art-caption strong { font-family: var(--gs-font-display); font-size: 26px; }
.art-caption > span { font-size: 12px; color: var(--gs-gold); }
.ehead {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 24px;
  border-bottom: 1px solid var(--gs-line);
  margin-bottom: 0;
}

.back {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--gs-line);
  color: var(--gs-ink-2);
}

.back:hover {
  border-color: var(--gs-gold);
  color: var(--gs-gold-hi);
}

.eyebrow {
  font-size: 10.5px;
  letter-spacing: 0.3em;
  color: var(--gs-gold-deep);
}

.head-ops {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--gs-line-hi);
  color: var(--gs-gold);
}

.form { display: grid; gap: 16px; align-content: start; overflow-y: auto; min-height: 0; padding: 20px 24px 0 0; overscroll-behavior: contain; }

.block {
  padding: 20px 22px 22px;
}

.block h2 {
  font-size: 15px;
  color: var(--gs-gold-hi);
  letter-spacing: 0.08em;
  margin-bottom: 14px;
}

.block h3 {
  font-size: 13px;
  color: var(--gs-gold);
  margin: 18px 0 10px;
  letter-spacing: 0.06em;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 18px;
}

.grid4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

.field > span {
  font-size: 12px;
  color: var(--gs-ink-3);
  letter-spacing: 0.04em;
}

.field em {
  color: #f0776f;
  font-style: normal;
}

input[type='text'],
select,
textarea {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 8px;
  /* 与 StyledSelect 触发器完全一致的控件外观 */
  border: 1px solid var(--gs-line-hi);
  background: #10293d;
  color: var(--gs-ink);
  font-size: 13px;
  outline: none;
  transition: border-color 0.18s var(--gs-ease), background 0.18s var(--gs-ease);
}

input[type='text']:hover,
textarea:hover {
  border-color: var(--gs-gold);
  background: #17384e;
}

input[type='text']:focus,
select:focus,
textarea:focus {
  border-color: var(--gs-gold);
  background: #17384e;
}

select option {
  background: #10293d;
}

textarea {
  resize: vertical;
  line-height: 1.8;
  font-family: inherit;
}

.bd {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.err {
  color: #f0776f;
  font-size: 11.5px;
}

.paintings {
  display: grid;
  gap: 8px;
}

.paintings li {
  display: flex;
  gap: 8px;
}

.mini {
  flex-shrink: 0;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--gs-line);
  font-size: 12px;
  color: var(--gs-ink-3);
}

.mini:hover {
  color: #f0776f;
  border-color: rgba(240, 119, 111, 0.5);
}

.add-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  align-items: stretch;
}

.add-row input {
  flex: 1;
  min-width: 0;
}

.add-row .gs-btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

.tip {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--gs-ink-3);
}

.section-edit {
  margin-bottom: 14px;
  border: 1px solid var(--gs-line);
  border-radius: 10px;
  padding: 10px 12px;
}

.sec-head {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.sec-name {
  font-size: 13px !important;
  font-weight: 600;
}

.foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 0 20px;
}

.spacer {
  flex: 1;
}

.danger-ghost {
  color: #f0776f;
  border-color: rgba(240, 119, 111, 0.4);
}

@media (max-width: 760px) {
  .character-editor-dialog { width: calc(100vw - 20px); height: calc(100dvh - 24px); }
  .editor-layout { grid-template-columns: 1fr; grid-template-rows: 180px minmax(0, 1fr); }
  .editor-art { padding: 12px 20px; flex-direction: row; align-items: center; gap: 25px; }
  .painting-stack { width: 130px; height: 155px; min-height: 0; flex-shrink: 0; }
  .art-caption { margin-top: 0; }
  .art-caption strong { font-size: 20px; }
  .form { padding: 10px 14px 0; }
  .ehead { padding: 12px 14px; gap: 8px; }
  .page-title { font-size: 19px; }
  .head-ops { gap: 6px; }
  .head-ops .gs-btn { padding: 7px 13px; }
  .eyebrow, .badge { display: none; }
  .foot { flex-wrap: wrap; }
}
@media (max-width: 900px) {
  .grid2,
  .grid4 {
    grid-template-columns: 1fr;
  }
  .character-editor-dialog {
  width: min(1120px, calc(100vw - 48px)); max-width: none; height: min(880px, calc(100dvh - 56px));
  margin: auto; padding: 0; border: 1px solid var(--gs-line-hi); border-radius: 18px; color: var(--gs-ink);
  background: radial-gradient(ellipse at 10% 20%, #1c4859 0%, #10293d 40%, #071521 100%); overflow: hidden;
  box-shadow: 0 32px 100px #0009;
}
.character-editor-dialog::backdrop { background: #030c16b8; backdrop-filter: blur(8px); }
.editor-shell { height: 100%; display: flex; flex-direction: column; }
.editor-layout { display: grid; grid-template-columns: minmax(220px, 30%) minmax(0, 1fr); flex: 1; min-height: 0; }
.editor-art { position: relative; display: flex; flex-direction: column; justify-content: center; padding: 30px 22px 24px; isolation: isolate; }
.painting-stack { position: relative; height: 65%; min-height: 240px; perspective: 1000px; }
.painting-stack img { position: absolute; width: 90%; height: 100%; left: 5%; top: 0; object-fit: contain; border-radius: 8px; filter: drop-shadow(0 15px 20px #0008); transform: translate(calc(var(--layer) * 9px), calc(var(--layer) * -10px)) rotate(calc((var(--layer) - 1) * 5deg)); z-index: calc(4 - var(--layer)); }
.painting-stack::before, .painting-stack::after { content: ''; position: absolute; inset: 12px 8%; border: 1px solid var(--gs-line-hi); border-radius: 10px; background: #18374d88; transform: rotate(7deg); z-index: -1; }
.painting-stack::after { transform: rotate(-5deg); }
.painting-placeholder { display: grid; place-content: center; height: 100%; text-align: center; color: var(--gs-ink-3); line-height: 2; }
.art-caption { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 25px; }
.art-caption strong { font-family: var(--gs-font-display); font-size: 26px; }
.art-caption > span { font-size: 12px; color: var(--gs-gold); }
.ehead {
    flex-wrap: wrap;
  }
}
</style>
