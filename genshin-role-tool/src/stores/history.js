import { defineStore } from 'pinia'
import { computed } from 'vue'
import { usePersist } from '@/composables/usePersist'
import { KEYS } from '@/utils/storage'

const MAX_ENTRIES = 500

export const useHistoryStore = defineStore('history', () => {
  const entries = usePersist(KEYS.history, [])

  const list = computed(() => entries.value || [])
  const count = computed(() => list.value.length)

  /**
   * @param {{ action: string, targetId: string|number, targetName: string, changes?: Array }} payload
   */
  function push(payload) {
    const entry = {
      hid: `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
      action: payload.action || 'update',
      targetId: payload.targetId,
      targetName: payload.targetName || '',
      changes: payload.changes || [],
    }
    const next = [entry, ...(entries.value || [])]
    entries.value = next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next
    return entry
  }

  function remove(hid) {
    entries.value = (entries.value || []).filter((e) => e.hid !== hid)
  }

  function clear() {
    entries.value = []
  }

  function byTarget(targetId) {
    return list.value.filter((e) => String(e.targetId) === String(targetId))
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(entries.value || []))
  }

  function replace(listIn) {
    entries.value = Array.isArray(listIn) ? listIn.slice(0, MAX_ENTRIES) : []
  }

  return {
    entries,
    list,
    count,
    push,
    remove,
    clear,
    byTarget,
    snapshot,
    replace,
    MAX_ENTRIES,
  }
})
