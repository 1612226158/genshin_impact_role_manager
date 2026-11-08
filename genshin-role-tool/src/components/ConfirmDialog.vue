<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { lockScroll, unlockScroll } from '@/utils/scrollLock'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
  inline: { type: Boolean, default: false },
})
const emit = defineEmits(['confirm', 'cancel'])

const panel = ref(null)
let locked = false

function onKey(e) {
  if (!props.open) return
  if (e.key === 'Escape') emit('cancel')
  if (e.key === 'Tab') {
    const focusables = panel.value?.querySelectorAll('button')
    if (!focusables?.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      if (!locked) { lockScroll(); locked = true }
      setTimeout(() => panel.value?.querySelector('button.primary, button.danger')?.focus(), 30)
    } else {
      if (locked) { unlockScroll(); locked = false }
    }
  }
)

onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  if (locked) unlockScroll()
})
</script>

<template>
  <Teleport to="body" :disabled="inline">
    <Transition name="pop">
      <div v-if="open" class="mask" @click.self="emit('cancel')">
        <div ref="panel" class="panel gs-panel" role="dialog" aria-modal="true">
          <h2>{{ title }}</h2>
          <p v-if="message" class="msg">{{ message }}</p>
          <slot />
          <div class="ops">
            <button type="button" class="gs-btn" @click="emit('cancel')">{{ cancelText }}</button>
            <button
              type="button"
              class="gs-btn"
              :class="danger ? 'danger' : 'primary'"
              @click="emit('confirm')"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: var(--gs-z-modal);
  background: rgba(4, 12, 20, 0.66);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 20px;
}

.panel {
  width: min(460px, 100%);
  padding: 24px 26px;
  background: var(--gs-panel-solid);
}

h2 {
  font-size: 17px;
  letter-spacing: 0.06em;
  color: var(--gs-gold-hi);
}

.msg {
  margin-top: 10px;
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--gs-ink-2);
  white-space: pre-wrap;
}

.ops {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

.gs-btn.danger {
  background: linear-gradient(180deg, #d9615a, #a8362f);
  border-color: #c04a43;
  color: #fff;
  font-weight: 600;
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.18s var(--gs-ease);
}
.pop-enter-active .panel,
.pop-leave-active .panel {
  transition: transform 0.18s var(--gs-ease);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
}
.pop-enter-from .panel,
.pop-leave-to .panel {
  transform: translateY(8px) scale(0.98);
}
</style>
