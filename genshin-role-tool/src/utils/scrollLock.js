let locks = 0
let previous = ''

export function lockScroll() {
  if (locks++ === 0) {
    previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}
export function unlockScroll() {
  if (locks > 0 && --locks === 0) document.body.style.overflow = previous
}
