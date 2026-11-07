import { computed } from 'vue'
import { defineStore } from 'pinia'
import { usePersist } from '@/composables/usePersist'
import { KEYS } from '@/utils/storage'
import { delBlob, makeMediaId, putBlob } from '@/utils/idb'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const useAlbumStore = defineStore('album', () => {
  const items = usePersist(KEYS.album, [])

  const list = computed(() =>
    [...(items.value || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  )

  const stats = computed(() => {
    const l = items.value || []
    return {
      total: l.length,
      official: l.filter((i) => i.kind === 'official').length,
      upload: l.filter((i) => i.kind === 'upload').length,
      card: l.filter((i) => i.kind === 'card').length,
    }
  })

  function isCollected(characterId, file) {
    return (items.value || []).some(
      (i) =>
        i.kind === 'official' &&
        String(i.characterId) === String(characterId) &&
        i.ref === file
    )
  }

  function collect({ characterId, characterName, painting }) {
    if (!painting?.file) return null
    if (isCollected(characterId, painting.file)) return null
    const item = {
      aid: makeMediaId('a'),
      kind: 'official',
      ref: painting.file,
      label: painting.label || '',
      title: characterName || '',
      characterId: String(characterId),
      mediaId: '',
      createdAt: Date.now(),
    }
    items.value = [...(items.value || []), item]
    return item
  }

  function uncollect(characterId, file) {
    const target = (items.value || []).find(
      (i) =>
        i.kind === 'official' &&
        String(i.characterId) === String(characterId) &&
        i.ref === file
    )
    if (!target) return false
    items.value = (items.value || []).filter((i) => i.aid !== target.aid)
    return true
  }

  async function addUpload(file, { title = '' } = {}) {
    if (!file) return { ok: false, reason: 'empty' }
    if (!file.type.startsWith('image/')) return { ok: false, reason: 'type' }
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'size' }

    const mediaId = makeMediaId('u')
    await putBlob(mediaId, file)
    const item = {
      aid: makeMediaId('a'),
      kind: 'upload',
      ref: '',
      label: '',
      title: title || file.name || '本地上传',
      characterId: '',
      mediaId,
      createdAt: Date.now(),
    }
    items.value = [...(items.value || []), item]
    return { ok: true, item }
  }

  async function addCard(blob, { title = '生日卡', characterId = '', kind = 'card' } = {}) {
    const mediaId = makeMediaId('k')
    await putBlob(mediaId, blob)
    const item = {
      aid: makeMediaId('a'),
      kind,
      ref: '',
      label: '',
      title,
      characterId: String(characterId || ''),
      mediaId,
      createdAt: Date.now(),
    }
    items.value = [...(items.value || []), item]
    return item
  }

  async function remove(aid) {
    const target = (items.value || []).find((i) => i.aid === aid)
    if (!target) return false
    if (target.mediaId) await delBlob(target.mediaId)
    items.value = (items.value || []).filter((i) => i.aid !== aid)
    return true
  }

  async function clearAll() {
    const mediaIds = (items.value || []).map((i) => i.mediaId).filter(Boolean)
    for (const id of mediaIds) await delBlob(id)
    items.value = []
  }

  function get(aid) {
    return (items.value || []).find((i) => i.aid === aid) || null
  }

  function byCharacter(characterId) {
    return list.value.filter((i) => String(i.characterId) === String(characterId))
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(items.value || []))
  }

  function replace(next) {
    items.value = Array.isArray(next) ? next : []
  }

  return {
    items,
    list,
    stats,
    isCollected,
    collect,
    uncollect,
    addUpload,
    addCard,
    remove,
    clearAll,
    get,
    byCharacter,
    snapshot,
    replace,
    MAX_UPLOAD_BYTES,
  }
})
