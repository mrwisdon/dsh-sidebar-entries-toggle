# dsh-sidebar-entries-toggle

[![dsh](https://img.shields.io/badge/DSH-web%20client%20plugin-7C8CF8)](https://github.com/deepseek-ai/deepseek-harness)
[![check](https://github.com/mrwisdon/dsh-sidebar-entries-toggle/actions/workflows/check.yml/badge.svg)](https://github.com/mrwisdon/dsh-sidebar-entries-toggle/actions/workflows/check.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) web-client plugin for the
left sidebar. English | [中文](README.zh.md)

## Features

- **Collapse row** - one click folds the plugin entries away, leaving the toggle and the "more"
  launcher. Host state (active panel, pins, route) is untouched.
- **Draggable divider** - drag it to rebalance the plugin entries against the workspace list, or
  nudge it with `↑` / `↓` / `Home` / `End`. Double-click resets. The ratio is remembered.
- **Workspace & session picker** - a button in the *Workspaces* header opens a filterable list of
  every workspace and session; click a row to switch workspace or open a session.

No build step, no dependencies, no network access, no telemetry. Collapsed state and divider ratio
live in `localStorage`. Chinese and English interfaces are both supported.

## Install

```bash
dsh plugin --profile <your-profile> add github:mrwisdon/dsh-sidebar-entries-toggle
```

Restart DSH afterwards. To install by hand instead, add
`"dsh-sidebar-entries-toggle": "github:mrwisdon/dsh-sidebar-entries-toggle"` to the profile's
`dependencies` and `"dsh-sidebar-entries-toggle"` to `dsh.profile.bundles` in
`~/.dsh/profiles/<profile>/package.json`, then run `pnpm install` in that directory.

## Compatibility

Written against DSH `0.2.2-rc.1`. Web client only; it works with the host DOM rather than a public
DOM contract, so a host whose sidebar internals change may load it and show nothing. Internals are
described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). Copyright (c) 2026 mrwisdon.

Not affiliated with or endorsed by DeepSeek. "DeepSeek Harness" and its marks belong to their owners.
