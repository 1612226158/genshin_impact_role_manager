import { defineStore } from 'pinia'
import { ref } from 'vue'

let seq = 0

export const useToastStore = defineStore('toast', () => {
  const items = ref([])

  function push(message, type = 'info', duration = 2600) {
    const id = ++seq
    items.value = [...items.value, { id, message, type }].slice(-3)
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }

  function dismiss(id) {
    items.value = items.value.filter((t) => t.id !== id)
  }

  const ok = (m) => push(m, 'ok')
  const warn = (m) => push(m, 'warn')
  const err = (m) => push(m, 'err', 3600)

  return { items, push, dismiss, ok, warn, err }
})
