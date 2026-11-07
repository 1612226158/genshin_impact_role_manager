import { computed, reactive } from 'vue'
import { defineStore } from 'pinia'
import baseData from '@/data/characters.json'
import { usePersist } from '@/composables/usePersist'
import { KEYS } from '@/utils/storage'
import { CHARACTER_FIELDS, FIELD_LABELS, diffFields, mergeCharacter } from '@/utils/merge'
import { useHistoryStore } from './history'

const BASE_LIST = baseData.characters
const BASE_MAP = new Map(BASE_LIST.map((c) => [String(c.id), c]))
const NATION_ORDER = Object.keys(baseData.nations || {})

const ELEMENT_ORDER = ['火', '水', '冰', '雷', '草', '风', '岩']

export const useCharacterStore = defineStore('character', () => {
  const overrides = usePersist(KEYS.overrides, {})
  const customs = usePersist(KEYS.customs, [])

  /* ---------------- 合并视图 ---------------- */

  const all = computed(() => {
    const ov = overrides.value || {}
    const out = []

    for (const c of BASE_LIST) {
      const patch = ov[String(c.id)]
      if (patch?.__deleted) continue
      out.push(patch ? mergeCharacter(c, patch) : c)
    }

    for (const c of customs.value || []) {
      if (c.__deleted) continue
      out.push(c)
    }
    return out
  })

  const byId = computed(() => {
    const m = new Map()
    for (const c of all.value) m.set(String(c.id), c)
    return m
  })

  const get = (id) => byId.value.get(String(id)) || null
  const getDefault = (id) => BASE_MAP.get(String(id)) || null
  const isCustom = (id) => String(id).startsWith('c_')

  /* ---------------- 统计 ---------------- */

  const stats = computed(() => {
    const ov = overrides.value || {}
    const edited = Object.values(ov).filter((o) => o && !o.__deleted).length
    const hidden = Object.values(ov).filter((o) => o?.__deleted).length
    const custom = (customs.value || []).filter((c) => !c.__deleted).length
    return {
      total: all.value.length,
      base: BASE_LIST.length,
      edited,
      hidden,
      custom,
    }
  })

  const nationOptions = computed(() => {
    const counter = new Map()
    for (const c of all.value) {
      counter.set(c.nation, (counter.get(c.nation) || 0) + 1)
    }
    const ordered = [...NATION_ORDER, ...counter.keys()].filter(
      (n, i, arr) => arr.indexOf(n) === i && counter.has(n)
    )
    return ordered.map((n) => ({ value: n, count: counter.get(n) }))
  })

  const elementOptions = computed(() => {
    const counter = new Map()
    for (const c of all.value) {
      if (!c.element) continue
      counter.set(c.element, (counter.get(c.element) || 0) + 1)
    }
    const ordered = ELEMENT_ORDER.filter((e) => counter.has(e))
    for (const e of counter.keys()) {
      if (!ordered.includes(e)) ordered.push(e)
    }
    if (all.value.some((c) => !c.element)) {
      ordered.push('无')
    }
    return ordered.map((e) => ({
      value: e,
      count: e === '无' ? all.value.filter((c) => !c.element).length : counter.get(e),
    }))
  })

  const weaponOptions = computed(() => {
    const counter = new Map()
    for (const c of all.value) {
      if (!c.weapon) continue
      counter.set(c.weapon, (counter.get(c.weapon) || 0) + 1)
    }
    return [...counter.entries()].map(([value, count]) => ({ value, count }))
  })

  /* ---------------- 筛选与排序 ---------------- */

  const filters = reactive({
    nation: '全部',
    element: '全部',
    star: '全部',
    weapon: '全部',
    source: '全部',
  })
  const kw = reactive({ text: '' })
  const sort = reactive({ key: 'default', dir: 'asc' })

  const editedIds = computed(() => {
    const ov = overrides.value || {}
    return new Set(Object.keys(ov).filter((k) => ov[k] && !ov[k].__deleted))
  })

  function sortValue(c) {
    switch (sort.key) {
      case 'name':
        return c.name || ''
      case 'star':
        return c.star || 0
      case 'birthday':
        return (c.birthdayMonth || 13) * 100 + (c.birthdayDay || 32)
      case 'recent': {
        const o = (overrides.value || {})[String(c.id)]
        return o?.__editedAt || c.createdAt || 0
      }
      default:
        return 0
    }
  }

  const filtered = computed(() => {
    const text = kw.text.trim().toLowerCase()
    let list = all.value.filter((c) => {
      if (filters.nation !== '全部' && c.nation !== filters.nation) return false
      if (filters.element !== '全部') {
        if (filters.element === '无' ? Boolean(c.element) : c.element !== filters.element) {
          return false
        }
      }
      if (filters.star !== '全部' && String(c.star || '无') !== String(filters.star)) return false
      if (filters.weapon !== '全部' && c.weapon !== filters.weapon) return false
      if (filters.source === '自建' && !isCustom(c.id)) return false
      if (filters.source === '官方' && isCustom(c.id)) return false
      if (filters.source === '已编辑' && !editedIds.value.has(String(c.id))) return false
      if (text) {
        const hay = [
          c.name,
          c.title,
          c.affiliation,
          c.role,
          c.constellation,
          c.cv?.中,
          c.cv?.日,
          c.variant,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(text)) return false
      }
      return true
    })

    const dir = sort.dir === 'desc' ? -1 : 1
    list = [...list].sort((a, b) => {
      if (sort.key === 'default') {
        const na = NATION_ORDER.indexOf(a.nation)
        const nb = NATION_ORDER.indexOf(b.nation)
        if (na !== nb) return (na - nb) * dir
        if ((b.star || 0) !== (a.star || 0)) return ((b.star || 0) - (a.star || 0)) * dir
        return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN') * dir
      }
      const va = sortValue(a)
      const vb = sortValue(b)
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb), 'zh-Hans-CN') * dir
      }
      return (va - vb) * dir
    })
    return list
  })

  const activeFilterCount = computed(() => {
    let n = 0
    for (const k of ['nation', 'element', 'star', 'weapon', 'source']) {
      if (filters[k] !== '全部') n += 1
    }
    if (kw.text.trim()) n += 1
    return n
  })

  function resetFilters() {
    filters.nation = '全部'
    filters.element = '全部'
    filters.star = '全部'
    filters.weapon = '全部'
    filters.source = '全部'
    kw.text = ''
  }

  /* ---------------- 写操作 ---------------- */

  const history = useHistoryStore()

  function applyPatch(id, patch) {
    const key = String(id)
    if (isCustom(key)) {
      customs.value = (customs.value || []).map((c) =>
        String(c.id) === key ? mergeCharacter(c, patch) : c
      )
      return
    }
    const prev = (overrides.value || {})[key] || {}
    overrides.value = {
      ...(overrides.value || {}),
      [key]: { ...prev, ...patch, __editedAt: Date.now() },
    }
  }

  /**
   * 保存字段修改，返回实际变更的字段列表（为空表示无变化）
   */
  function saveCharacter(id, patch, action = 'update') {
    const current = get(id)
    if (!current) return []
    const changes = diffFields(current, { ...current, ...patch }, CHARACTER_FIELDS)
    if (!changes.length) return []
    applyPatch(id, patch)
    history.push({
      action,
      targetId: id,
      targetName: patch.name || current.name,
      changes,
    })
    return changes
  }

  function createCharacter(data) {
    const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const record = mergeCharacter(
      {
        id,
        name: '',
        title: '',
        nation: '蒙德',
        region_official: '',
        affiliation: '',
        element: '火',
        weapon: '单手剑',
        star: 5,
        birthday: '',
        constellation: '',
        role: '',
        cv: {},
        images: { avatar: '', avatar_hd: '', paintings: [] },
        story: { sections: [] },
        source: '',
        variant: undefined,
        playable: true,
        builtin: false,
        createdAt: Date.now(),
      },
      { ...data, id }
    )
    customs.value = [...(customs.value || []), record]
    history.push({
      action: 'create',
      targetId: id,
      targetName: record.name || '未命名角色',
      changes: diffFields(null, record, ['name', 'element', 'weapon', 'star']),
    })
    return id
  }

  function resetCharacter(id) {
    const key = String(id)
    const base = BASE_MAP.get(key)
    if (!base) return false
    const current = get(key)
    if (!current) return false
    const ov = { ...(overrides.value || {}) }
    delete ov[key]
    overrides.value = ov
    history.push({
      action: 'reset',
      targetId: key,
      targetName: base.name,
      changes: diffFields(current, base, CHARACTER_FIELDS),
    })
    return true
  }

  function softDelete(id) {
    const key = String(id)
    const current = get(key)
    if (!current) return false
    if (isCustom(key)) {
      customs.value = (customs.value || []).map((c) =>
        String(c.id) === key ? { ...c, __deleted: true } : c
      )
    } else {
      applyPatch(key, { __deleted: true })
    }
    history.push({ action: 'delete', targetId: key, targetName: current.name })
    return true
  }

  function restore(id) {
    const key = String(id)
    if (isCustom(key)) {
      customs.value = (customs.value || []).map((c) =>
        String(c.id) === key ? { ...c, __deleted: false } : c
      )
      return true
    }
    const prev = (overrides.value || {})[key]
    if (!prev?.__deleted) return false
    const next = { ...prev }
    delete next.__deleted
    overrides.value = { ...(overrides.value || {}), [key]: next }
    return true
  }

  /**
   * 撤销一条编辑记录
   * 安全条件：当前值必须仍等于该条记录的 after，否则说明被后续修改覆盖
   */  function undoEntry(entry) {
    const current = get(entry.targetId)
    if (!current) {
      if (entry.action === 'delete') {
        return restore(entry.targetId) ? { ok: true } : { ok: false, reason: 'not-found' }
      }
      return { ok: false, reason: 'not-found' }
    }

    if (!entry.changes?.length) {
      return { ok: false, reason: 'no-changes' }
    }

    const patch = {}
    const conflict = []
    for (const ch of entry.changes) {
      const nowVal = current[ch.field]
      const same =
        typeof nowVal === 'object'
          ? JSON.stringify(nowVal ?? null) === JSON.stringify(ch.after ?? null)
          : (nowVal ?? null) === (ch.after ?? null)
      if (!same) {
        conflict.push(FIELD_LABELS[ch.field] || ch.field)
        continue
      }
      patch[ch.field] = ch.before
    }

    if (conflict.length && Object.keys(patch).length === 0) {
      return { ok: false, reason: 'conflict', fields: conflict }
    }

    applyPatch(entry.targetId, patch)
    history.push({
      action: 'restore',
      targetId: entry.targetId,
      targetName: current.name,
      changes: entry.changes.filter((ch) => ch.field in patch),
    })
    history.remove(entry.hid)
    return { ok: true, partial: conflict }
  }

  /* ---------------- 备份与恢复 ---------------- */

  function snapshot() {
    return {
      overrides: JSON.parse(JSON.stringify(overrides.value || {})),
      customs: JSON.parse(JSON.stringify(customs.value || [])),
    }
  }

  function replaceState({ overrides: ov, customs: cs }) {
    if (ov !== undefined) overrides.value = ov || {}
    if (cs !== undefined) customs.value = cs || []
  }

  function mergeImport({ overrides: ov, customs: cs }) {
    overrides.value = { ...(overrides.value || {}), ...(ov || {}) }
    const seen = new Set((customs.value || []).map((c) => String(c.id)))
    const added = (cs || []).filter((c) => !seen.has(String(c.id)))
    customs.value = [...(customs.value || []), ...added]
  }

  return {
    all,
    byId,
    get,
    getDefault,
    isCustom,
    stats,
    nationOptions,
    elementOptions,
    weaponOptions,
    filters,
    kw,
    sort,
    filtered,
    activeFilterCount,
    editedIds,
    resetFilters,
    saveCharacter,
    createCharacter,
    resetCharacter,
    softDelete,
    restore,
    undoEntry,
    snapshot,
    replaceState,
    mergeImport,
    meta: baseData.meta,
    nations: baseData.nations,
    nationOrder: NATION_ORDER,
    elementOrder: ELEMENT_ORDER,
  }
})
