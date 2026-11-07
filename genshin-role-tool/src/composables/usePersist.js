import { ref, watch } from 'vue'
import { readJSON, writeJSON } from '@/utils/storage'

/**
 * 响应式 localStorage 状态
 * 写入做 120ms 节流，避免连续输入时每击键都序列化
 */
export function usePersist(key, initial, { throttle = 120 } = {}) {
  const state = ref(readJSON(key, typeof initial === 'function' ? initial() : initial))

  let timer = null
  let pending = false

  const flush = () => {
    timer = null
    if (!pending) return
    pending = false
    writeJSON(key, state.value)
  }

  watch(
    state,
    () => {
      pending = true
      if (timer) return
      timer = setTimeout(flush, throttle)
    },
    { deep: true }
  )

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
  }

  return state
}
