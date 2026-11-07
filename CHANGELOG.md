# Changelog

## 0.4.0 — first public release

First version published as open source. Two features ship in this release.

### Sidebar entries area

- Collapse / expand row above the plugin entries. Collapsing hides the entry rows and leaves the
  toggle itself plus the "more" row; host state (active panel, pins, route) is untouched.
- Draggable divider between the entries list and the workspace list. Drag to rebalance, double-click
  to reset, `↑` / `↓` to fine-tune from the keyboard. The ratio is persisted.
- The entries list gets a minimum height and `overflow-y: auto`, so a long plugin list scrolls
  instead of pushing the workspace list off the panel.
- Collapsed state and divider ratio persist in `localStorage`
  (`dsh.sidebarEntriesToggle.collapsed`, `dsh.sidebarEntriesToggle.ratio`).

### Workspace & session picker

- Button at the end of the Workspaces header opens a filterable popover listing every workspace with
  its session count, and every session underneath it. Click a row to switch workspace or open a
  session; `Escape` or an outside click closes it.
- Data comes from the host's own `useWorkspaces` / `useSessions` hooks, harvested by a
  null-rendering probe component registered into `sidebar.footer.action`; navigation goes through the
  `uiWorkspace` service.
- Degrades to an in-popover note when `uiWorkspace` is unavailable; renders nothing when the
  Workspaces header cannot be found.

### Notes

- Client-only plugin: the host entry (`index.js`) exports an empty `apply()` and exists to satisfy
  the bundle contract.
- No build step. `client.js` is the source that ships.
- No network access, no telemetry, no credentials.
