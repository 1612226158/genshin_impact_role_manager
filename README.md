# 原神角色工具

以 138 个《原神》角色数据与官方素材为基础的纯前端角色工具，支持角色管理、生日工具与角色相册。

> 角色名称、背景故事与图片素材版权归 **miHoYo / HoYoverse** 所有。本项目仅供个人学习研究，不作商业用途，不对外分发素材。
>
> 界面使用的元素/国度图标由画师 [DanielPYC](https://www.miyoushe.com/ys/collection/2085279) 手绘并无偿分享（米游社）。

## 功能

| 模块 | 能力 |
|---|---|
| 角色库 | 五列角色卡网格；国度 / 元素 / 星级 / 武器 / 来源多维筛选；名称、称号、所属、CV 综合搜索；多种排序 |
| 角色详情 | 对齐游戏内「角色属性」版式：左侧分区菜单 + 中央立绘 + 右侧属性面板，含背景故事与多立绘切换 |
| 角色管理 | 编辑任意角色的全部字段、新建自定义角色、隐藏 / 恢复默认；字段级编辑记录可撤销 |
| 生日工具 | 指定日期查询同日生日（含 2/29 闰年规则）、按月浏览、生成 4:5 与 1:1 生日卡并导出 PNG |
| 角色相册 | 收藏官方立绘、上传本地图片、四宫格 / 九宫格 / 长条 / 主图+四小图拼图并导出 |
| 数据安全 | 全部数据存本机（文本 localStorage，图片 IndexedDB）；支持 JSON 备份导入导出 |

## 运行

```bash
cd genshin-role-tool
npm install        # 依赖已锁定在 package-lock.json
npm run dev        # 开发预览，http://localhost:5317
npm run build      # 构建产物在 dist/，可用任意静态服务器托管
npm run preview    # 本地预览构建产物
```

要求 Node 20.19+（实测 v24.14.1 / npm 11.11.0）。

## 部署说明

路由使用 history 模式，**部署时需要服务器支持 SPA fallback**（所有路径回退 `index.html`）。
`vite dev` 与 `vite preview` 均已内置，无需配置；其他静态托管（Nginx、GH Pages 等）需自行添加该规则。

## 已知问题

- **Edge 157 + Windows「动画效果」关闭**的组合下，页面挂载 vue-router 后会触发系统级窗口管理故障
  （最小化被强制还原、偶现空白窗口）。**使用 Chrome 打开本应用即可规避**（已验证），或更新 Edge 版本。
  八轮二分实验的完整记录见 `tools/qa/README.md`；诊断开关清单见 `genshin-role-tool/src/main.js` 顶部注释。

## 素材预处理

仓库内 `genshin-role-tool/public/assets/` 是由原始素材转换的 WebP（186.3 MB → 27.9 MB）。
原始 PNG/JPG 素材与分发包不入库。如需重新生成：

```bash
# 在仓库根目录准备好 assets/ 原始素材后
cd genshin-role-tool
python scripts/prepare_assets.py   # 需要 Pillow
python scripts/prepare_data.py     # 生成 src/data/characters.json
```

## 目录结构

```
├─ assets/                    # 原始素材（不入库）
├─ characters.json            # 原始数据（138 角色，数据真源）
├─ docs/
│  ├─ requirements/           # 开发文档
│  └─ logs/                   # 开发日志
└─ genshin-role-tool/         # Vue 3 + Vite 工程
   ├─ public/assets/          # WebP 素材
   ├─ scripts/                # 素材预处理脚本
   └─ src/
      ├─ stores/              # Pinia：角色 / 历史 / 相册 / 设置
      ├─ composables/         # 持久化、IndexedDB、对象 URL
      ├─ components/          # 卡片、画布、对话框等
      └─ views/               # 7 个路由页面
```

## 技术说明

- Vue 3.5 + Vite 8 + Vue Router 4（hash 模式）+ Pinia 4，纯前端，零后端、零网络请求
- 文本类用户数据存 `localStorage`（键前缀 `gsr.`），图片二进制存 IndexedDB（`gsr-media`）
- 生日卡与拼图使用原生 Canvas 2D 绘制，成品导出 PNG
- 详细设计见 `docs/requirements/2026-11-07-原神角色工具-开发文档.md`
