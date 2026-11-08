import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

export const useEditorStore = defineStore('editor', () => {
  const characterId = ref(null)
  const opener = shallowRef(null)
  const open = (id, trigger) => { opener.value = trigger || document.activeElement; characterId.value = String(id) }
  const close = () => { characterId.value = null }
  return { characterId, opener, open, close }
})
