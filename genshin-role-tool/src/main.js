import './styles/tokens.css'
import './styles/base.css'

// 诊断开关（URL 参数，用于定位 Edge 最小化故障的触发层）：
//   ?flat=1   禁用全站 backdrop-filter 与 filter（毛玻璃/光斑/投影全部关闭）
//   ?nostar=1 隐藏星空 canvas
//   ?noapp=1  隐藏整个应用界面（#app 不渲染可见内容）
//   ?noss=1   移除全部样式表（页面裸奔）
//   ?nostarapp=1 不挂载星空组件（隔离 ResizeObserver + fixed canvas）
//   ?nojs=1   完全不挂载应用（页面只保留文档本身，隔离「JS 执行/挂载」）
// 例：http://localhost:5317/?flat=1#/
const diag = new URLSearchParams(location.search)
if (diag.has('flat')) document.documentElement.classList.add('flat')
if (diag.has('nostar')) document.documentElement.classList.add('no-stars')
if (diag.has('noapp')) document.documentElement.classList.add('no-app')
if (diag.has('noss')) {
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('style').forEach((s) => s.remove())
  })
}

if (diag.has('nojs')) {
  // 诊断：不加载/不挂载应用，页面只执行本模块
  console.log('[diag] nojs mode: app not mounted')
} else {
  const [{ createApp }, { createPinia }, { default: App }, { default: router }] =
    await Promise.all([import('vue'), import('pinia'), import('./App.vue'), import('./router')])
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}
