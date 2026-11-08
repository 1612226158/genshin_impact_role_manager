<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({ sections: { type: Array, required: true } })
const readerRef = ref(null)
const activeSection = ref(0)
let scroller
let frame = 0

function isInternal() {
  return scroller && scroller.scrollHeight > scroller.clientHeight && getComputedStyle(scroller).overflowY === 'auto'
}
function syncSection() {
  frame = 0
  const sections = [...readerRef.value.querySelectorAll('.reader-text section')]
  const boundary = isInternal() ? scroller.getBoundingClientRect().top + 40 : 100
  let index = 0
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].getBoundingClientRect().top <= boundary) index = i
  }
  activeSection.value = index
}
function onScroll() {
  if (!frame) frame = requestAnimationFrame(syncSection)
}
function jumpSection(i) {
  const section = readerRef.value.querySelectorAll('.reader-text section')[i]
  const behavior = document.documentElement.classList.contains('no-motion') ? 'instant' : 'smooth'
  if (isInternal()) {
    scroller.scrollTo({ top: scroller.scrollTop + section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 10, behavior })
  } else {
    window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top - 90, behavior })
  }
  activeSection.value = i
}
onMounted(() => {
  scroller = readerRef.value.closest('.tab-body')
  scroller?.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  syncSection()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  scroller?.removeEventListener('scroll', onScroll)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div ref="readerRef" class="reader">
    <nav class="reader-index" aria-label="故事分节">
      <button v-for="(s, i) in sections" :key="i" type="button" :class="{ on: i === activeSection }"
        :aria-current="i === activeSection ? 'location' : undefined" :title="s.section" @click="jumpSection(i)">
        {{ s.section }}
      </button>
    </nav>
    <div class="reader-text">
      <section v-for="(s, i) in sections" :key="i" :id="`story-sec-${i}`">
        <h3>{{ s.section }}</h3>
        <p>{{ s.text }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.reader { display: grid; grid-template-columns: 138px minmax(0,1fr); gap: 18px; align-items: start; }
.reader-index { position: sticky; top: 0; display: flex; flex-direction: column; gap: 2px; }
.reader-index button {
  text-align: left; font-size: 12.5px; line-height: 1.5; color: var(--gs-ink-3); padding: 7px 10px;
  border-left: 2px solid transparent; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: color .18s var(--gs-ease), background .18s var(--gs-ease), border-color .18s var(--gs-ease);
}
.reader-index button:hover { color: var(--gs-ink); background: rgba(211,188,142,.06); }
.reader-index button.on { color: var(--gs-gold-hi); border-left-color: var(--gs-gold); background: rgba(211,188,142,.1); }
.reader-text { max-width: 640px; min-width: 0; }
.reader-text section { margin-bottom: 22px; }
.reader-text h3 { font-size: 15px; color: var(--gs-gold); letter-spacing: .1em; padding-left: 12px; border-left: 2px solid var(--gs-gold-deep); margin: 26px 0 12px; }
.reader-text section:first-child h3 { margin-top: 0; }
.reader-text p { font-size: 15px; line-height: 2.05; color: var(--gs-ink); white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 900px) {
  .reader { grid-template-columns: 1fr; gap: 10px; }
  .reader-index { position: static; flex-direction: row; overflow-x: auto; padding-bottom: 6px; border-bottom: 1px solid var(--gs-line); }
  .reader-index button { border-left: none; border-bottom: 2px solid transparent; flex-shrink: 0; padding: 6px 10px; }
  .reader-index button.on { border-bottom-color: var(--gs-gold); }
}
</style>
