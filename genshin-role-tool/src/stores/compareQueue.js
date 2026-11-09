import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useCharacterStore } from './character'

export const useCompareQueueStore = defineStore('compareQueue', () => {
  const characters = useCharacterStore()
  const ids = ref([])
  const entries = computed(() => ids.value.map((id) => characters.get(id)).filter(Boolean))
  const full = computed(() => entries.value.length === 2)

  function has(id) {
    return ids.value.includes(String(id))
  }

  function add(id) {
    if (full.value || has(id) || !characters.get(id)) return false
    ids.value = [...entries.value.map((character) => String(character.id)), String(id)]
    return true
  }

  function remove(id) {
    ids.value = ids.value.filter((key) => key !== String(id))
  }

  function clear() {
    ids.value = []
  }

  return { entries, full, has, add, remove, clear }
})
