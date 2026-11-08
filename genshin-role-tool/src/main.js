import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import './styles/tokens.css'
import './styles/base.css'

// 诊断开关（URL 参数，用于定位 Edge 最小化故障的触发层）：
//   ?flat=1   禁用全站 backdrop-filter 与 filter（毛玻璃/光斑/投影全部关闭）
//   ?nostar=1 隐藏星空 canvas
// 例：http://localhost:5317/?flat=1#/
const diag = new URLSearchParams(location.search)
if (diag.has('flat')) document.documentElement.classList.add('flat')
if (diag.has('nostar')) document.documentElement.classList.add('no-stars')

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
