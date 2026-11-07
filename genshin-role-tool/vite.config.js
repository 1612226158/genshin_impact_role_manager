import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  // 相对路径：构建产物既可挂载到任意子目录，也可直接双击 dist/index.html 打开
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5317,
    open: false,
  },
  build: {
    outDir: 'dist',
    // 数据集本身较大，放宽体积告警阈值
    chunkSizeWarningLimit: 1600,
  },
})
