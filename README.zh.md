# dsh-sidebar-entries-toggle

[![dsh](https://img.shields.io/badge/DSH-web%20client%20plugin-7C8CF8)](https://github.com/deepseek-ai/deepseek-harness)
[![check](https://github.com/mrwisdon/dsh-sidebar-entries-toggle/actions/workflows/check.yml/badge.svg)](https://github.com/mrwisdon/dsh-sidebar-entries-toggle/actions/workflows/check.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）Web 客户端的侧栏插件。
[English](README.md) | 中文

## 功能

- **折叠行** —— 一键把插件条目收起来，只留下折叠行和「更多」入口。宿主的当前面板、置顶、路由都不受影响。
- **可拖拽分隔条** —— 拖动它调整插件条目与工作区列表的占比，也可以用 `↑` / `↓` / `Home` / `End` 微调；双击复位；比例会被记住。
- **工作区与会话选择器** —— 「工作区」标题行末尾的按钮打开一个可筛选的列表，列出全部工作区与会话；点一行即可切换工作区或打开会话。

无构建步骤、无依赖、不联网、无遥测。折叠状态与分隔条比例保存在 `localStorage`。中英文界面均已适配。

## 安装

```bash
dsh plugin --profile <你的 profile> add github:mrwisdon/dsh-sidebar-entries-toggle
```

安装后重启 DSH 生效。也可以手动安装：在 `~/.dsh/profiles/<profile>/package.json` 的
`dependencies` 中加入 `"dsh-sidebar-entries-toggle": "github:mrwisdon/dsh-sidebar-entries-toggle"`，
并在 `dsh.profile.bundles` 中加入 `"dsh-sidebar-entries-toggle"`，然后在该目录执行 `pnpm install`。

## 兼容性

针对 DSH `0.2.2-rc.1` 编写，仅支持 Web 客户端。插件是按宿主 DOM 结构工作的，没有公开的 DOM 契约，
所以宿主侧栏内部结构变化时它可能正常加载却不显示任何内容。内部实现见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 许可

MIT，详见 [LICENSE](LICENSE)。版权所有 (c) 2026 mrwisdon。

本项目与 DeepSeek 无隶属关系，也未获得其背书；「DeepSeek Harness」等标识归其各自所有者。
