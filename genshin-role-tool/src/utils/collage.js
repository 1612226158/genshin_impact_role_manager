export function cropFraction(width, height, portrait) {
  return portrait && height / width > 1.4 ? 2 / 3 : 1
}

/** Layout shared by the interactive stage and PNG export. */
export function collageLayout(template, ratios = []) {
  const gap = 10
  if (template === 'natural') {
    const values = ratios.length ? ratios : [0.55, 0.55, 0.55]
    const h = 1200
    let x = 0
    const cells = values.map(ratio => {
      const w = h * Math.max(0.12, Math.min(5, ratio || 0.55))
      const cell = [x, 0, w, h]
      x += w + gap
      return cell
    })
    const w = x - gap
    const scale = Math.min(1, 4096 / w)
    return { w: Math.round(w * scale), h: Math.round(h * scale), cells: cells.map(c => c.map(v => v * scale)) }
  }
  if (template === 'grid2' || template === 'grid3') {
    const n = template === 'grid2' ? 2 : 3
    const size = (1200 - gap * (n - 1)) / n
    return { w: 1200, h: 1200, cells: Array.from({ length: n * n }, (_, i) => [(i % n) * (size + gap), Math.floor(i / n) * (size + gap), size, size]) }
  }
  if (template === 'strip3') {
    const size = (1440 - gap * 2) / 3
    return { w: 1080, h: 1440, cells: [0, 1, 2].map(i => [0, i * (size + gap), 1080, size]) }
  }
  const small = 295
  return { w: 1600, h: 1000, cells: [[0, 0, 990, 1000], [1000, 0, small, 495], [1305, 0, small, 495], [1000, 505, small, 495], [1305, 505, small, 495]] }
}

export function fittedRect(iw, ih, w, h, fit) {
  const scale = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)
  const width = iw * scale, height = ih * scale
  return { x: (w - width) / 2, y: (h - height) * (fit === 'cover' && ih > iw ? 0.16 : 0.5), w: width, h: height }
}
