# QA 工具集（tools/qa）

本项目专属的验证工具，**长期复用，不要用完即删**。所有脚本自动起停 vite（验证完端口即释放），依赖独立装在本目录，不污染主工程。

## 环境前提

- Chrome：`C:/Program Files/Google/Chrome/Application/chrome.exe`（puppeteer-core 驱动，无浏览器下载）
- ffmpeg：`E:/other_software/GPTSoVITS/GPT-SoVITS-v3lora-20250228/ffmpeg.exe`
  - ⚠️ 该 build **无 file 协议**，输出必须走 `-f image2pipe -` 管道；`E:/other_software/ffmpeg/` 下只有源码没有 exe
- 截图输出：`C:/Users/xiaoy/AppData/Local/Temp/qa-shots/`

路径如需变更，改 `lib/common.mjs` 顶部常量。

## 安装

```bash
cd tools/qa
npm install
```

## 命令

| 命令 | 用途 |
|---|---|
| `node shoot.mjs <config.json> [宽] [高]` | 批量截图。config：`[{ name, path, wait?, script? }]`，`script` 为页内 JS（点击页签等） |
| `node e2e.mjs` | 端到端回归：编辑/记录/撤销/新建/持久化/生日闰年边界/相册收藏，共 14 项断言 |
| `node motion.mjs` | 动画体系断言（6 项）：模拟系统关闭动画后过渡仍生效、页签滑动、应用内动画开关 |
| `node pinned-head.mjs` | 断言详情页头部（名称/称号/星级/按钮）在正文滚动时保持钉住 |
| `node export-canvas.mjs card\|collage` | 导出生日卡 / 2×2 拼图的**真实成品 PNG** |
| `node frames.mjs <视频> [间隔秒] [输出目录]` | 视频抽帧（pipe 模式） |
| `node contact-sheet.mjs <帧目录> [输出]` | 抽帧拼成带时间戳的总览图 |
| `node inspect-page.mjs <URL>` | 外部页面勘察：无头加载 JS 站点，输出标题/文本/图片响应清单 |
| `monitor-chromium.ps1 [秒]` | 监视 Chromium 系进程创建（含父进程与完整命令行），输出 monitor-log.txt。⚠️ 本文件必须保持纯 ASCII |
| `net-monitor.mjs [静置秒] [路径]` | 页面静置期间的请求监视（检测注入脚本心跳、favicon 循环等） |
| `diag-flags.mjs` | 断言诊断开关（?flat=1 / ?nostar=1）在 computed style 层面生效 |
| `dev-nohmr.mjs` | 以禁用 HMR WebSocket 的模式启动 dev server（配合 vite.config 的 NO_HMR 环境变量） |
| `bare.html`（public/diag/ 下） | 零脚本静态诊断页，用于二分「dev server 本身 vs 应用页面」 |

## 已定案：Edge 157 窗口管理故障（与本项目代码无关）

2026-11-08 八轮二分实验的最终结论：

| 实验 | Edge 结果 | Chrome 结果 |
|---|---|---|
| bare.html（零 JS） | 正常 | — |
| Kaspersky 关闭 | 心跳消失但仍复现 | — |
| ?flat&nostar（关滤镜/canvas） | 异常 | — |
| ?noapp（隐藏界面） | 异常 | — |
| ?nojs（不挂载应用） | 正常 | — |
| minimal（最小 Vue） | 正常 | — |
| minimal + vue-router | **异常** | — |
| minimal + memory router（零 history 交互） | **异常** | — |
| 完整应用（Chrome） | — | **正常** |

结论：**Edge 157 + Windows 动画关闭** 环境下，页面挂载 vue-router（或 pinia+router 组合）即触发
「最小化被强制还原」与幽灵 about:blank 窗口；History API 单一行为（replaceState/popstate）
均不能复现，触发点在框架安装路径的更深处。Chrome 完全正常。

处理：本项目日常使用建议用 Chrome 打开；长期方案是更新 Edge 或向 Edge 反馈（复现链保留在
public/diag/ 下：bare → minimal → withrouter → memhist）。

## 已知坑（勿重蹈）

1. **`page.waitForSelector` 在本机 headless Chrome 上会无限挂起**（不触发超时）。等待元素一律用 `waitForFunction`，或页内自轮询脚本（见 `lib/common.mjs` 的 `CLICK_TAB_SCRIPT`）。
2. 详情页是懒加载路由，`#app` 出现子元素 ≠ 视图已渲染；页内点击前必须轮询等目标元素出现。
3. 截图前必须 `waitAssets(page)` 等 `document.images` 全部 complete，否则图片区域随机空白。
4. 页面里有多个 canvas（背景星空 + 生日卡/拼图），选目标 canvas 用 `.cv` 类，不要 `querySelector('canvas')`。
5. 验证动画时用 `page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])` 复现「Windows 关动画」场景。
6. 应用测试数据（overrides/customs/history/album）e2e 结束会自动清理；`gsr.settings.v1` 中的 motion 字段验证后也会还原。
