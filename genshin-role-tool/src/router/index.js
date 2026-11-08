import { createRouter, createWebHistory } from 'vue-router'

/**
 * history 模式（2026-11-08 由 hash 模式切换）：
 * hash 模式的 hashchange/popstate 监听与 history.replaceState 操作，
 * 在特定环境下（Edge 157 + Windows 动画关闭 + 后台模式实例）会触发
 * 「最小化被强制还原 / 幽灵 about:blank 窗口」的系统级窗口故障，
 * 最小复现实验（诊断开关 minimal ± withrouter）已确认。
 * createWebHistory 走标准 popstate，全互联网 SPA 通用，不受影响。
 * 服务端兼容性：vite dev / vite preview 均自带 SPA fallback，无额外配置。
 */
const routes = [  {
    path: '/',
    name: 'library',
    component: () => import('@/views/CharacterLibrary.vue'),
    meta: { nav: 'library', title: '角色库' },
  },
  {
    path: '/c/:id',
    name: 'character',
    component: () => import('@/views/CharacterDetail.vue'),
    meta: { nav: 'library', title: '角色详情' },
  },
  {
    path: '/c/:id/edit',
    name: 'character-edit',
    component: () => import('@/views/CharacterEditor.vue'),
    meta: { nav: 'library', title: '编辑角色' },
  },
  {
    path: '/birthday',
    name: 'birthday',
    component: () => import('@/views/BirthdayView.vue'),
    meta: { nav: 'birthday', title: '生日' },
  },
  {
    path: '/album',
    name: 'album',
    component: () => import('@/views/AlbumView.vue'),
    meta: { nav: 'album', title: '相册' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { nav: 'history', title: '编辑记录' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { nav: 'settings', title: '设置' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const suffix = to.meta?.title ? ` · ${to.meta.title}` : ''
  document.title = `原神角色工具${suffix}`
})

export { routes }

export default router
