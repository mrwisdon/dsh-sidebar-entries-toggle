# dsh-sidebar-entries-toggle

[![dsh](https://img.shields.io/badge/DSH-web%20client%20plugin-7C8CF8)](#兼容性与边界)
[![build](https://img.shields.io/badge/build-none%20(plain%20JS)-brightgreen)](#开发)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）Web 客户端插件。它给左侧
侧栏补上官方 UI 缺少的两件事：

1. **折叠行 + 可拖动分隔条** —— 一键收起插件入口，或拖动分隔条重新分配插件入口与工作区列表的高度。
2. **工作区 / 会话快速选择器** —— "工作区"表头里的一个小按钮，打开可筛选的浮层，列出所有工作区与会话。

单个手写的浏览器文件。无构建步骤、无依赖、无网络访问、无遥测。

[English](README.md) | 中文

---

## 它做什么

### 插件入口：折叠与分隔条

在侧栏面板列表（`<nav>`）的第一个子节点位置插入一行：一个折角图标加一行文字。点击它给该
`nav` 挂上 `data-dsh-entries-collapsed`，插件的 CSS 随即隐藏面板行，只留这一行和"更多"启动器。
列表下方是 7 px 的拖动手柄，用来重新分配插件入口与工作区列表的高度。

| 操作 | 效果 |
|---|---|
| 点击折叠行 | 收起 / 展开插件入口。宿主状态（当前面板、pin、路由）完全不动。 |
| 拖动分隔条 | 设定插件入口高度，钳制在 `[44 px, 可用高度 - 120 px]`，并存下比例。 |
| 双击分隔条 | 清除已存比例，高度交还内容自然撑开。 |
| 分隔条聚焦时 `↑` / `↓` | 每次移动 16 px，并持久化比例。 |
| `Home` / `End` | 跳到最小值（44 px）或 *可用高度 - 120 px*。 |
| 调整窗口大小 | 重新钳制；若侧栏已收成窄条，把布局完全交还内容。 |

折叠行与分隔条都可聚焦、都有无障碍标注：折叠行是 `<button>`，带 `aria-expanded` 与指向该 nav 的
`aria-controls`；分隔条是 `role="separator"`、`aria-orientation="horizontal"`、`tabindex="0"`。
插件入口列表获得 `overflow-y: auto`，入口很多时滚动，而不是把工作区列表挤出视口。

### 工作区：快速选择器

"工作区"表头行末尾追加一个 26x26 按钮，点开一个 340 px 宽、`position: fixed` 的浮层：

- 一个筛选输入框，匹配工作区标题、工作区路径、会话标题；
- 每个工作区一行 —— 标题，加 `N 个会话`；
- 其下缩进列出会话（标题，缺省用 `sessionId`）；
- 点任一项调用宿主的 `uiWorkspace` 服务（`openWorkspace(id)` / `openSession(id)`）；
- `Escape` 或点击浮层外关闭；靠近视口边缘时自动向左 / 向上翻转。

空态是明确的：*暂无工作区数据*（快照没送进来）与 *没有匹配项*（筛选无命中）。宿主服务缺失时，
浮层里打印一行按界面语言本地化的提示，而不是抛错。

### 无障碍

- 折叠行是真正的 `<button>`，带 `aria-expanded` 与 `aria-controls`；分隔条是可聚焦的
  `role="separator"`，拖动或用键盘微调时同步 `aria-valuemin` / `aria-valuemax` / `aria-valuenow`。
- 选择器里的行是 `role="button"`，除点击外还支持 `Enter` / `Space` 激活。打开浮层时焦点进入
  筛选框，关闭后焦点回到按钮；`Escape` 在任意位置都能关闭。
- 标签、提示与失败说明都跟随界面语言（中文或英文）。

## 为什么自建 DOM

侧栏的注册槽位都是单占用（single），而能放得下本插件的位置已被官方 UI 占满：

| 槽位 | 占用者 | 能否使用 |
|---|---|---|
| `brand.mark` | 宿主 logo | 单占用 —— 注册即遮蔽 logo |
| `brand.name` | 宿主产品名 | 单占用 —— 注册即遮蔽名字 |
| `toggle.badge` | 宿主折叠按钮 | 单占用 —— 注册即遮蔽原按钮 |
| `workspaces` | 工作区列表 | 单占用 —— 注册即替换整个列表 |
| `sidebar.footer.action` | 基本空闲，但**位于侧栏最底部** | additive，但离入口区太远 |

因此折叠行、分隔条、选择器按钮、浮层全部是自建节点，直接插入宿主 DOM。唯一真正注册的槽位
`sidebar.footer.action` 渲染 `null`，只为两件事服务：

- **取数。** 宿主没有开放任何"列举工作区 / 会话"的客户端服务；唯一来源是槽位组件能拿到的
  `standardProps` 钩子（`useWorkspaces`、`useSessions`）。页脚里那个不渲染任何内容的组件可以调用
  它们，把快照写进模块级变量，自建浮层再读这份数据。
- **加载探针。** 万一自建 DOM 插不进去，已注册的槽位组件仍能证明 bundle 加载成功、客户端模块图已解析。

## 实现要点

### 认定侧栏 nav

`isSidebarNav(nav)` 只在同时满足以下条件时接受一个 `<nav>`：`isConnected`、**宽 24-560 px**、
**距左边缘不超过 140 px**、**内部含 `[aria-haspopup="menu"]` 启动器**（"更多"按钮）。多个候选中，
computed `flex-direction` 为 `column` 的优先，因为面板列表是纵向堆叠；面包屑、设置导航、文件树都被
同一套判据排除。

每次同步都会重新认定。nav 被替换或认错时，插件先解绑（自己写过的属性与内联样式全部按捕获的原值
还原），再挂到新候选上。认不出就什么都不做 —— 没有兜底 DOM。

### 折叠不碰宿主状态

折叠纯粹是 CSS：

```css
nav[data-dsh-entries-nav][data-dsh-entries-collapsed]
  > *:not(#dsh-entries-toggle-row):not(:has([aria-haspopup="menu"])) { display: none !important; }
```

两个属性共同把关，别的 `nav` 上误挂 `data-dsh-entries-collapsed` 也隐藏不了任何东西。"更多"启动器靠
`:has()` 反选存活。插件从不写宿主的当前面板状态；再点一次只是移除属性。

### 高度模型

`availableSpace()` = `nav 高度 + region 高度`，region 即 `nav.nextElementSibling`。于是：

```
maxNav  = max(MIN_NAV, available - MIN_REGION)              // MIN_NAV = 44, MIN_REGION = 120
height  = round(clamp(ratio * available, MIN_NAV, maxNav))  // 有已存比例时
height  = min(contentHeight, maxNav)                        // 否则取内容自然高度，超了封顶
```

高度以 `flex: 0 0 auto; min-height: 0; overflow-y: auto; height: Npx` 写进 nav 内联样式，并给 region
补 `min-height: 0`，否则 flex 无法真正压缩它。自然高度分支只测一次 `scrollHeight`，且值不变就不写，
避免"设高 -> 量高 -> 清零"的来回抖动。宽度 **小于 120 px** 时视为窄条模式：折叠行只剩图标、分隔条
隐藏、nav 高度完全交还内容。

### 扛住 React 重渲染

宿主侧栏会被持续重渲染（流式输出时几乎每个 token 一次），所以插件把自己的节点当作一次性的：

- `MutationObserver` **只盯两个 childList** —— nav 的父节点与 nav 本身，**不观察 subtree**。nav 消失时
  回退到 `document.body`，直到重新认到候选；折叠行被顶掉就补回第一个位置；面板行增删则重估高度。
- 回调合并进一个 `requestAnimationFrame`。
- nav 父节点上的 `ResizeObserver` 重新检测窄条模式并重算布局。
- 选择器的观察器挂在 `document.body` 上，但**只补挂按钮、绝不重绘已打开的浮层** —— 流式输出期间若
  重绘，`pointerdown` 与 `pointerup` 会落在不同节点上，点击永远不触发。浮层内容的更新走快照签名。

### 选择器的取数链路

```
宿主槽位组件（渲染 null）
  useWorkspaces(state => state.items)      -+
  useSessions(state => state)              -+-> PICK = { workspaces, sessions, listeners }
                                              ^ 签名：id|title|path|会话标题...
自建浮层  ------------------------------------+   （相同签名不重复更新）
```

选择器函数是模块级常量，不是每次渲染新建的箭头函数 —— 对引用相等敏感的 store 实现因此不会每趟
重渲染。两个钩子在运行时都是可选的：槽位不给，存储就空着，浮层显示 *暂无工作区数据*。按钮挂载会在
启动后 120 / 400 / 1200 / 2600 ms 各重试一次，因为首帧时表头行可能尚未提交。

### 本地化

两层互不相干：

| 层 | 来源 | 用途 |
|---|---|---|
| 包元数据 | `locale/en.json`、`locale/zh.json`（标题 + 描述） | 插件在宿主插件列表里的条目 |
| 运行期文案 | 内联 `TEXT`（`zh`/`en`）+ `locale.register(NS, TEXT)` / `locale.bind(NS)` | 折叠行文字、tooltip、ARIA 标签 |

没有绑定宿主翻译时回退中文。选择器按 `document.documentElement.lang`、再 `navigator.language` 取语言，
同样默认中文。所有颜色都取自宿主 CSS 变量（`--dsw-alias-*`、`--dsh-sidebar-*`、`--dsw-radius-*`、
focus ring），所以跟随当前主题；唯一的字面色值是 `var(..., fallback)` 里的兜底。

## 安装

本插件是一个**profile bundle**：`package.json` 里声明 `dsh.bundle.patch` ->
`cordis.patch.yml`，该 patch 插入 loader 条目：

```yaml
- insert:
    - id: sidebar-entries-toggle
      name: 'dsh-sidebar-entries-toggle'
```

所以安装 = 在 profile 里落两件事：**一个依赖** + **一个 bundle 条目**。bundle 条目才接线 loader；
没有它，包只是躺在 `node_modules` 里。

### 方式 A —— 让 CLI 做完两件事

`dsh plugin` 把参数转发给 profile 目录里的 pnpm，随后为每个新装且声明了 `dsh.bundle` 的包
reconcile `dsh.profile.bundles`：

```bash
dsh plugin --profile web add github:mrwisdon/dsh-sidebar-entries-toggle
```

把 `web` 换成你的 profile 名（`dsh --profile web` 即启动该 profile，等价于 `dsh web`）。

### 方式 B —— 本地副本

`link:` 让工作副本成为唯一来源，改完 `client.js` 重启即可，无需重装。相对路径以你执行命令时的
目录为基准：

```bash
cd ~/.dsh/profiles/web
dsh plugin --profile web add link:../../../dsh-plugins/sidebar-entries-toggle
```

（从 `~/.dsh/profiles/web` 到 `~` 是三层。绝对路径也可以，但相对路径让 profile 可迁移。）

### 方式 C —— 手改 profile manifest

编辑 `~/.dsh/profiles/<名称>/package.json`：

```json
{
  "dependencies": {
    "dsh-sidebar-entries-toggle": "github:mrwisdon/dsh-sidebar-entries-toggle"
  },
  "dsh": {
    "profile": {
      "bundles": ["... 已有的 bundles ...", "dsh-sidebar-entries-toggle"]
    }
  }
}
```

安装并重启：

```bash
cd ~/.dsh/profiles/web && pnpm install
```

bundle 的顺序就是 layer 的顺序（各 bundle 的 patch 按列表顺序应用，最后才是 profile 自己的
`cordis.patch.yml`）。本插件只追加一行，追加到最后是安全的。

### 安装之后

重启 DSH（重启应用，或重新执行 `dsh --profile web`）。应当看到：插件入口顶部的折角行、入口与工作区
列表之间的拖动手柄、以及"工作区"表头里的小选择器按钮。除此之外没有别的：插件不注册模型工具、不注册
命令、不写任何文件。

> DSH Desktop 独占 `desktop` profile —— CLI 拒绝管理它。同样手改那个 profile 的 `package.json`，
> 然后重启应用。

## 常量与存储

| 名称 | 值 | 位置 |
|---|---|---|
| `STORAGE_KEY` | `dsh.sidebarEntriesToggle.collapsed` | `localStorage`，取值 `'1'` / `'0'` |
| `RATIO_KEY` | `dsh.sidebarEntriesToggle.ratio` | `localStorage`，`(0,1)` 内浮点；写入时钳到 `0.05-0.95` |
| `MIN_NAV` | 44 px | 插件入口最小高度 |
| `MIN_REGION` | 120 px | 永远留给工作区列表的空间 |
| `RAIL_WIDTH` | 120 px | nav 宽度低于此值进入窄条模式 |
| `ATTR` | `data-dsh-entries-collapsed` | nav 折叠标记 |
| `NAV_FLAG` | `data-dsh-entries-nav` | nav 认定标记（CSS 的开关） |
| `ROW_ID` | `dsh-entries-toggle-row` | 折叠行（`<button>`），文字 span 为 `dsh-entries-toggle-label` |
| `DIV_ID` | `dsh-entries-resizer` | 分隔条 |
| `STYLE_ID` | `dsh-sidebar-entries-toggle-style` | 注入的 `<style>` |
| `PICK_BTN_ID` / `PICK_POP_ID` | `dsh-picker-btn` / `dsh-picker-pop` | 选择器按钮 / 浮层 |
| nav 认定 | 宽 24-560 px、`left <= 140 px`、含 `[aria-haspopup="menu"]` | `isSidebarNav()` |
| 比例有效性 | 必须是 `0 < v < 1`，否则忽略 | `readRatio()` |

存储每次挂载读一次、交互时写。所有 `localStorage` 访问都包了 try/catch：隐私模式或禁用存储时插件
照常工作，只是不记忆。

## 兼容性与边界

- **仅 Web 客户端。** `package.json` 声明 `dsh.client.platform: "web"` 与
  `dsh.client.inject: ["@deepseek-ai/dsh-client-ui-sidebar"]`；没有 TUI 或桌面原生渲染。开发基于 DSH
  `0.2.2-rc.1`；未声明 peer 版本，所以侧栏内部结构变了的宿主可能加载成功但什么都不显示。
- **依赖的是宿主 DOM，而不是公开的 DOM 契约。** 具体：

| 宿主细节 | 用途 | 若变化 |
|---|---|---|
| 左贴边、宽 24-560 px 的 `<nav>` | 认定侧栏 | 没有折叠行、没有分隔条 |
| 该 nav 内存在 `[aria-haspopup="menu"]` | 认定 + 折叠时的例外 | 认定失败，或启动器被一起隐藏 |
| `nav.nextElementSibling` 是工作区区域 | 高度计算 | 分隔条切错对象 |
| 区域顶部 36 px 内有一行 18-56 px 高、>=100 px 宽、含 `<button>` 的表头 | 挂选择器按钮 | 没有按钮 |
| `sidebar.footer.action` 提供 `useWorkspaces` / `useSessions` | 选择器取数 | 浮层显示 *暂无工作区数据* |
| `uiWorkspace` 服务带 `openWorkspace` / `openSession` | 选择器跳转 | 浮层打印"服务不可用"提示 |

- **降级是静默的（有意如此）。** 认不出侧栏就什么都不做，而不是猜；找不到工作区表头就不出现按钮。
  唯一可见的失败是浮层里那两行提示。
- **一处毛边：** 浮层里两条"服务不可用"提示是硬编码中文，即便界面是英文。
- 本仓库不带测试（无构建、无测试框架）—— 验证方式是手动的：加载、折叠、拖分隔条、刷新，确认两者都被
  恢复。

## 开发

`client.js` **就是**源码 —— 没有打包器、没有 TypeScript、没有转译。它是一个普通 IIFE，注册一个惰性
factory：

```js
window.__ModuleLoader__.load({
  id: 'dsh-sidebar-entries-toggle',
  factory(require) { /* 全部逻辑都在这里 */ },
})
```

factory 体在**物化时**执行，而不是脚本执行时：CSS 注入、DOM 插入、事件监听都在 `apply(ctx)` 里完成，
清理函数闭包在同一作用域上。保持这个形状 —— 顶层副作用会在宿主槽位就绪之前就跑掉。

用本地 `link:` 安装（方式 B）试改动：

1. 改 `client.js`；
2. 重启 DSH（bundle 在启动时从磁盘读取，没有 HMR）；
3. 在控制台看 `[sidebar-entries-toggle]` 报错。

## 仓库结构

| 文件 | 行数 | 作用 |
|---|---|---|
| `client.js` | 1228 | 全部浏览器逻辑：nav 认定、折叠行、分隔条、选择器 |
| `index.js` | 7 | 宿主半边 —— 空 `apply()`，只为满足 bundle 契约 |
| `cordis.patch.yml` | 3 | 一个 `insert` 条目，声明 loader 行 |
| `package.json` | 67 | `dsh.bundle.patch`、`dsh.client`（web、立即加载、注入 sidebar）、exports |
| `locale/en.json`、`locale/zh.json` | 各 6 | 仅插件列表元数据 |
| `icon.svg` | 5 | 24x24 上下折角，`#7C8CF8` |
| `README.md`、`README.zh.md` | 333 / 299 | 本文件及中文版 |
| `docs/ARCHITECTURE.md` | 162 | 内部实现：生命周期、子系统、失效模式、行号引用 |
| `CHANGELOG.md` | 34 | 版本记录 |
| `LICENSE` | 21 | MIT |

## 许可

MIT。与 DeepSeek 无隶属或背书关系。"DeepSeek Harness" 及其标识归其所有者。
