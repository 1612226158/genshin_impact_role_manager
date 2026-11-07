import { computed } from 'vue'
import { defineStore } from 'pinia'
import { usePersist } from '@/composables/usePersist'
import { KEYS, SCHEMA_VERSION, storageAvailable } from '@/utils/storage'
import { useCharacterStore } from './character'
import { useHistoryStore } from './history'
import { useAlbumStore } from './album'

const APP_TAG = 'genshin-role-tool'

export const useSettingsStore = defineStore('settings', () => {
  const settings = usePersist(KEYS.settings, {
    schemaVersion: SCHEMA_VERSION,
    lastVisited: '/',
  })

  const storageOk = computed(() => storageAvailable())

  /**
   * 导出全部文本数据
   * 注意：IndexedDB 中的二进制图片无法放入 JSON，导出时仅保留元数据
   */
  function exportAll() {
    const character = useCharacterStore()
    const history = useHistoryStore()
    const album = useAlbumStore()
    const snap = character.snapshot()
    return {
      app: APP_TAG,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      overrides: snap.overrides,
      customs: snap.customs,
      history: history.snapshot(),
      albumMeta: album.snapshot(),
    }
  }

  function validate(payload) {
    if (!payload || payload.app !== APP_TAG) return { ok: false, reason: 'format' }
    const version = Number(payload.schemaVersion || 0)
    if (version > SCHEMA_VERSION) return { ok: false, reason: 'version' }
    if (payload.overrides && typeof payload.overrides !== 'object') {
      return { ok: false, reason: 'format' }
    }
    if (payload.customs && !Array.isArray(payload.customs)) return { ok: false, reason: 'format' }
    return { ok: true }
  }

  function countOf(payload) {
    return {
      overrides: Object.keys(payload.overrides || {}).length,
      customs: (payload.customs || []).length,
      history: (payload.history || []).length,
      album: (payload.albumMeta || []).length,
    }
  }

  function importAll(payload, { overwrite = true } = {}) {
    const v = validate(payload)
    if (!v.ok) return v

    const character = useCharacterStore()
    const history = useHistoryStore()
    const album = useAlbumStore()

    if (overwrite) {
      character.replaceState({
        overrides: payload.overrides || {},
        customs: payload.customs || [],
      })
      history.replace(payload.history || [])
      album.replace(payload.albumMeta || [])
    } else {
      character.mergeImport({
        overrides: payload.overrides || {},
        customs: payload.customs || [],
      })
      history.replace([...(payload.history || []), ...history.snapshot()])
      album.replace([...(album.snapshot() || []), ...(payload.albumMeta || [])])
    }

    return { ok: true, counts: countOf(payload), mode: overwrite ? 'overwrite' : 'merge' }
  }

  function resetCharacters() {
    useCharacterStore().replaceState({ overrides: {}, customs: [] })
  }

  function resetHistory() {
    useHistoryStore().replace([])
  }

  async function resetAlbum() {
    const album = useAlbumStore()
    await album.clearAll()
  }

  async function resetEverything() {
    resetCharacters()
    resetHistory()
    await resetAlbum()
  }

  return {
    settings,
    storageOk,
    exportAll,
    importAll,
    validate,
    resetCharacters,
    resetHistory,
    resetAlbum,
    resetEverything,
    SCHEMA_VERSION,
  }
})
