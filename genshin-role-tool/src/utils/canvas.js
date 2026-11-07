/** Canvas 绘制工具：图片载入、文本换行、星点、圆角 */

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`图片加载失败: ${src}`))
    img.src = src
  })
}

/** 在给定框内等比缩放后居中绘制，返回实际绘制矩形 */
export function drawContain(ctx, img, x, y, w, h, align = 'center') {
  const scale = Math.min(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  let dx = x + (w - dw) / 2
  if (align === 'left') dx = x
  if (align === 'right') dx = x + (w - dw)
  const dy = y + (h - dh)
  ctx.drawImage(img, dx, dy, dw, dh)
  return { x: dx, y: dy, w: dw, h: dh }
}

/** 中文按字符断行（无空格分词） */
export function wrapText(ctx, text, maxWidth) {
  const lines = []
  const paragraphs = String(text).split('\n')
  for (const p of paragraphs) {
    let line = ''
    for (const ch of p) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = ch
      } else {
        line = test
      }
    }
    lines.push(line)
  }
  return lines
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** 确定性伪随机，保证同一张卡每次生成星点一致 */
export function seeded(seed = 1) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function drawStars(ctx, w, h, { count = 160, seed = 7, color = '255,255,255' } = {}) {
  const rnd = seeded(seed)
  for (let i = 0; i < count; i += 1) {
    const x = rnd() * w
    const y = rnd() * h
    const r = 0.6 + rnd() * 2.2
    const a = 0.06 + rnd() * 0.5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${color},${a.toFixed(3)})`
    ctx.fill()
  }
}

/** 十六进制转 rgba */
export function rgba(hex, alpha = 1) {
  const h = String(hex).replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

/** 混色：把 hex 与黑/白按比例混合，用于生成深浅色阶 */
export function mix(hex, target, ratio) {
  const parse = (h) => {
    const s = String(h).replace('#', '')
    const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
    const n = parseInt(full, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const a = parse(hex)
  const b = parse(target)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * ratio))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export function canvasToBlob(canvas, type = 'image/png', quality = 1) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((b) => resolve(b), type, quality)
    } else {
      const data = canvas.toDataURL(type, quality)
      const bin = atob(data.split(',')[1])
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i)
      resolve(new Blob([arr], { type }))
    }
  })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
