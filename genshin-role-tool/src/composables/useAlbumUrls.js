import { onBeforeUnmount, reactive, watch } from 'vue'
import { assetUrl } from '@/utils/asset'
import { blobUrl } from '@/utils/idb'

/**
 * 为相册项解析可渲染的 URL：
 * - official 直接引用静态素材
 * - upload / card 从 IndexedDB 取 blob 并生成 objectURL
 * 项被移除或组件卸载时释放 objectURL，避免内存泄漏
 */
export function useAlbumUrls(itemsRef) {
  const map = reactive({})
  let alive = true

  async function sync(list) {
    const keep = new Set((list || []).map((i) => i.aid))

    for (const aid of Object.keys(map)) {
      if (!keep.has(aid)) {
        if (map[aid]?.startsWith('blob:')) URL.revokeObjectURL(map[aid])
        delete map[aid]
      }
    }

    for (const it of list || []) {
      if (map[it.aid]) continue
      if (it.kind === 'official' && it.ref) {
        map[it.aid] = assetUrl(it.ref)
        continue
      }
      if (it.mediaId) {
        const url = await blobUrl(it.mediaId)
        if (url && alive) map[it.aid] = url
      }
    }
  }

  watch(itemsRef, (v) => sync(v), { immediate: true })

  onBeforeUnmount(() => {
    alive = false
    for (const url of Object.values(map)) {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  })

  return map
}
