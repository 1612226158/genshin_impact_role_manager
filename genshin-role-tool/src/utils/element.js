/** 元素视觉映射（色值取原神 Wiki 权威变量） */
export const ELEMENTS = {
  火: { color: '#ed4f45', glyph: '火', name: 'Pyro' },
  水: { color: '#4088ff', glyph: '水', name: 'Hydro' },
  冰: { color: '#98c8e8', glyph: '冰', name: 'Cryo' },
  雷: { color: '#d376f0', glyph: '雷', name: 'Electro' },
  草: { color: '#7bb42d', glyph: '草', name: 'Dendro' },
  风: { color: '#33ccb3', glyph: '风', name: 'Anemo' },
  岩: { color: '#cfa726', glyph: '岩', name: 'Geo' },
}

export function elementColor(el) {
  return ELEMENTS[el]?.color || '#7c93a7'
}

export function elementGlyph(el) {
  return ELEMENTS[el]?.glyph || '无'
}

export function rarityColors(star) {
  if (star === 5) return { a: '#8c6a32', b: '#d9b871' }
  if (star === 4) return { a: '#4e4470', b: '#9a86c0' }
  return { a: '#33465a', b: '#5b7086' }
}

export const WEAPONS = ['单手剑', '双手剑', '长柄武器', '弓', '法器']
export const NATIONS = ['蒙德', '璃月', '稻妻', '须弥', '枫丹', '纳塔', '至冬', '其他/旅行者']
