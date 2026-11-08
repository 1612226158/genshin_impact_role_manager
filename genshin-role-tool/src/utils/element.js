/** 元素视觉映射（色值取原神 Wiki 权威值；图标由画师 DanielPYC 手绘，见「关于」页署名） */
export const ELEMENTS = {
  火: { color: '#ed4f45', glyph: '火', name: 'Pyro', key: 'pyro' },
  水: { color: '#4088ff', glyph: '水', name: 'Hydro', key: 'hydro' },
  冰: { color: '#98c8e8', glyph: '冰', name: 'Cryo', key: 'cryo' },
  雷: { color: '#d376f0', glyph: '雷', name: 'Electro', key: 'electro' },
  草: { color: '#7bb42d', glyph: '草', name: 'Dendro', key: 'dendro' },
  风: { color: '#33ccb3', glyph: '风', name: 'Anemo', key: 'anemo' },
  岩: { color: '#cfa726', glyph: '岩', name: 'Geo', key: 'geo' },
}

export function elementColor(el) {
  return ELEMENTS[el]?.color || '#7c93a7'
}

export function elementGlyph(el) {
  return ELEMENTS[el]?.glyph || '无'
}

/** 元素图标路径（无对应图标返回空串，由调用方回退到文字） */
export function elementIcon(el) {
  const key = ELEMENTS[el]?.key
  return key ? `assets/icons/element_${key}.png` : ''
}

/** 国度纹章路径（「其他/旅行者」无纹章） */
const NATION_ICON = {
  蒙德: 'nation_mondstadt',
  璃月: 'nation_liyue',
  稻妻: 'nation_inazuma',
  须弥: 'nation_sumeru',
  枫丹: 'nation_fontaine',
  纳塔: 'nation_natlan',
  至冬: 'nation_snezhnaya',
}

export function nationIcon(nation) {
  const key = NATION_ICON[nation]
  return key ? `assets/icons/${key}.png` : ''
}

export function rarityColors(star) {
  if (star === 5) return { a: '#8c6a32', b: '#d9b871' }
  if (star === 4) return { a: '#4e4470', b: '#9a86c0' }
  return { a: '#33465a', b: '#5b7086' }
}

export const WEAPONS = ['单手剑', '双手剑', '长柄武器', '弓', '法器']
export const NATIONS = ['蒙德', '璃月', '稻妻', '须弥', '枫丹', '纳塔', '至冬', '其他/旅行者']
