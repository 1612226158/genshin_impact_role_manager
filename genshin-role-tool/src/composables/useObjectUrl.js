import { onBeforeUnmount, ref, watch } from 'vue'
import { blobUrl } from '@/utils/idb'

/**
 * 把 IndexedDB 中的 blob 转为可渲染的 objectURL，并在组件卸载时释放
 * 反复切换详情页不会累积 blob URL
 */
export function useObjectUrl(source, { immediate = true } = {}) {
  const url = ref('')

  let current = ''

  const revoke = () => {
    if (current) {
      URL.revokeObjectURL(current)
      current = ''
    }
  }

  const load = async (id) => {
    revoke()
    url.value = ''
    if (!id) return
    try {
      const next = await blobUrl(id)
      if (!next) return
      current = next
      url.value = next
    } catch {
      url.value = ''
    }
  }

  if (immediate) {
    if (typeof source === 'object' && source !== null && 'value' in source) {
      watch(source, (v) => load(v), { immediate: true })
    } else {
      load(source)
    }
  }

  onBeforeUnmount(revoke)

  return { url, load, revoke }
}
