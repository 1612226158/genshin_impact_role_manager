/**
 * localStorage 安全封装
 * 隐私模式 / 配额满 / 被策略禁用时不应让应用崩溃，而是降级为只读
 */
const NS = 'gsr.'

let available = null

export function storageAvailable() {
  if (available !== null) return available
  try {
    const k = `${NS}__probe__`
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    available = true
  } catch {
    available = false
  }
  return available
}

export function readJSON(key, fallback) {
  if (!storageAvailable()) return fallback
  try {
    const raw = window.localStorage.getItem(NS + key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  if (!storageAvailable()) return false
  try {
    window.localStorage.setItem(NS + key, JSON.stringify(value))
    return true
  } catch (err) {
    // 配额溢出等
    console.warn('[storage] 写入失败', key, err)
    return false
  }
}

export function removeKey(key) {
  if (!storageAvailable()) return
  try {
    window.localStorage.removeItem(NS + key)
  } catch {
    /* noop */
  }
}

export function listKeys() {
  if (!storageAvailable()) return []
  return Object.keys(window.localStorage).filter((k) => k.startsWith(NS))
}

export const KEYS = {
  overrides: 'overrides.v1',
  customs: 'customs.v1',
  history: 'history.v1',
  album: 'album.v1',
  settings: 'settings.v1',
}

export const SCHEMA_VERSION = 1
