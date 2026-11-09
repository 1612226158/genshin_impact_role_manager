const BIRTHDAY_RE = /^\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*$/
// 生日不带年份，2 月保留 29 日。
const BIRTHDAY_MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function birthdayDaysInMonth(month) {
  return BIRTHDAY_MONTH_LENGTHS[Number(month) - 1] ?? 0
}

export function parseBirthday(text) {
  const m = BIRTHDAY_RE.exec(String(text || ''))
  if (!m) return { month: null, day: null }
  const month = Number(m[1])
  const day = Number(m[2])
  if (day < 1 || day > birthdayDaysInMonth(month)) return { month: null, day: null }
  return { month, day }
}

/**
 * 基础角色 + 用户覆盖层 → 合并视图
 * images / story / cv 需要逐层合并，其余字段直接覆盖
 */
export function mergeCharacter(base, patch) {
  if (!patch) return base
  const out = { ...base, ...patch }

  if (patch.images) {
    out.images = {
      ...base.images,
      ...patch.images,
      paintings: patch.images.paintings ?? base.images?.paintings ?? [],
    }
  }
  if (patch.story) {
    out.story = { ...base.story, ...patch.story }
  }
  if (patch.cv) {
    out.cv = { ...(base.cv || {}), ...patch.cv }
  }

  const { month, day } = parseBirthday(out.birthday)
  out.birthdayMonth = month
  out.birthdayDay = day
  out.playable = Boolean(out.element && out.star)
  return out
}

/** 字段级差异，用于生成编辑记录 */
export function diffFields(before, after, fields) {
  const changes = []
  for (const f of fields) {
    const b = before?.[f]
    const a = after?.[f]
    const bs = typeof b === 'object' ? JSON.stringify(b ?? null) : (b ?? null)
    const as = typeof a === 'object' ? JSON.stringify(a ?? null) : (a ?? null)
    if (bs !== as) changes.push({ field: f, before: b ?? null, after: a ?? null })
  }
  return changes
}

export const CHARACTER_FIELDS = [
  'name',
  'title',
  'nation',
  'region_official',
  'affiliation',
  'element',
  'weapon',
  'star',
  'birthday',
  'constellation',
  'role',
  'cv',
  'images',
  'story',
]

export const FIELD_LABELS = {
  name: '名称',
  title: '称号',
  nation: '国度',
  region_official: '所属地区',
  affiliation: '所属',
  element: '元素',
  weapon: '武器',
  star: '星级',
  birthday: '生日',
  constellation: '命之座',
  role: '定位',
  cv: 'CV',
  images: '图片',
  story: '背景故事',
  __deleted: '删除状态',
}
