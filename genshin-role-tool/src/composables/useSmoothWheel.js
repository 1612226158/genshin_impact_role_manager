import { onBeforeUnmount, onMounted, watch } from 'vue'

/** Mouse-wheel easing for a long document. Touch and nested scrolling remain native. */
export function useSmoothWheel(enabled) {
  let frame = 0
  let target = 0
  let previousTime = 0
  let writtenY = 0

  function stop() {
    cancelAnimationFrame(frame)
    frame = 0
    previousTime = 0
  }

  const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)

  function tick(now) {
    const dt = previousTime ? Math.min(now - previousTime, 64) : 16
    previousTime = now
    target = Math.max(0, Math.min(maxScroll(), target))
    const current = window.scrollY
    const distance = target - current
    // Viewport scrolling rounds to pixels; land explicitly before subpixel steps can stall.
    writtenY = Math.abs(distance) < 3 ? target : current + distance * (1 - Math.exp(-dt / 65))
    window.scrollTo({ top: writtenY, behavior: 'instant' })
    writtenY = window.scrollY
    if (Math.abs(target - writtenY) < 1) stop()
    else frame = requestAnimationFrame(tick)
  }

  function wheel(event) {
    if (document.body.style.overflow === 'hidden' || !enabled() || event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey ||
      !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
    // Small high-resolution deltas already feel smooth on precision touchpads.
    if (event.deltaMode === 0 && Math.abs(event.deltaY) < 40) {
      stop()
      return
    }
    for (const el of event.composedPath()) {
      if (!(el instanceof HTMLElement) || el === document.body || el === document.documentElement) continue
      if (el.matches('input, select, textarea') || el.isContentEditable) return
      const style = getComputedStyle(el)
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight &&
        (event.deltaY < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return
    }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1
    if (!frame) target = window.scrollY
    const next = Math.max(0, Math.min(maxScroll(), target + event.deltaY * unit))
    if (!frame && next === window.scrollY) return
    event.preventDefault()
    target = next
    if (!frame) frame = requestAnimationFrame(tick)
  }

  function externalScroll() {
    // A scrollbar, keyboard, route restoration or another script takes ownership immediately.
    if (frame && Math.abs(window.scrollY - writtenY) > 2) stop()
  }
  watch(enabled, stop)
  onMounted(() => {
    writtenY = window.scrollY
    window.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('scroll', externalScroll, { passive: true })
    window.addEventListener('pointerdown', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('keydown', stop)
    window.addEventListener('blur', stop)
  })
  onBeforeUnmount(() => {
    stop()
    window.removeEventListener('wheel', wheel)
    window.removeEventListener('scroll', externalScroll)
    window.removeEventListener('pointerdown', stop)
    window.removeEventListener('touchstart', stop)
    window.removeEventListener('keydown', stop)
    window.removeEventListener('blur', stop)
  })
}
