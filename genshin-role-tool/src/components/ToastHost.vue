<script setup>
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <Teleport to="body">
    <div class="host" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="t in toast.items" :key="t.id" class="item" :class="`is-${t.type}`">
          <span class="mark" aria-hidden="true">{{
            t.type === 'ok' ? '✓' : t.type === 'warn' ? '!' : t.type === 'err' ? '×' : '◇'
          }}</span>
          <span class="text">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.host {
  position: fixed;
  z-index: var(--gs-z-toast);
  left: 50%;
  bottom: 34px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 18px;
  border-radius: 999px;
  background: rgba(12, 32, 48, 0.94);
  border: 1px solid var(--gs-line-hi);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  font-size: 13px;
  color: var(--gs-ink);
  backdrop-filter: blur(10px);
}

.mark {
  color: var(--gs-gold);
  font-size: 12px;
}

.is-ok .mark {
  color: #7fd6a0;
}

.is-warn {
  border-color: rgba(207, 167, 38, 0.55);
}

.is-warn .mark {
  color: #e6c25a;
}

.is-err {
  border-color: rgba(237, 79, 69, 0.6);
}

.is-err .mark {
  color: #f0776f;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s var(--gs-ease);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
