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
    // 诊断开关：NO_HMR=1 时禁用 HMR WebSocket（排查 Edge 最小化故障是否与 WS 相关）
    // 用法：cross-env 或直接设置环境变量后 npm run dev；诊断结束后可移除
    hmr: process.env.NO_HMR ? false : undefined,
  },
  build: {
    outDir: 'dist',
    // 数据集本身较大，放宽体积告警阈值
    chunkSizeWarningLimit: 1600,
  },
})
