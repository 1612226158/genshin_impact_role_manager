import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * hash 模式：纯静态部署时无需服务端 rewrite，
 * 且构建产物可直接双击 dist/index.html 打开。
 */
const routes = [
  {
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
  history: createWebHashHistory(),
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

export default router
