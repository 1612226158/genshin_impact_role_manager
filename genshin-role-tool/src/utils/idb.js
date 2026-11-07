import { createStore, del, get, keys, set } from 'idb-keyval'

/**
 * 二进制附件仓库：上传的图片、生成的成品图
 * localStorage 只有 5MB 配额，图片必须走 IndexedDB
 */
const store = createStore('gsr-media', 'blobs')

export async function putBlob(id, blob) {
  await set(id, blob, store)
  return id
}

export async function getBlob(id) {
  try {
    return (await get(id, store)) || null
  } catch {
    return null
  }
}

export async function delBlob(id) {
  try {
    await del(id, store)
  } catch {
    /* noop */
  }
}

export async function listBlobIds() {
  try {
    return await keys(store)
  } catch {
    return []
  }
}

/** 生成对象 URL；调用方负责 revoke */
export async function blobUrl(id) {
  const blob = await getBlob(id)
  return blob ? URL.createObjectURL(blob) : ''
}

export function makeMediaId(prefix = 'm') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
