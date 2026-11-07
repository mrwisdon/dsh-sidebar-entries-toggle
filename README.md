# dsh-sidebar-entries-toggle

[![dsh](https://img.shields.io/badge/DSH-web%20client%20plugin-7C8CF8)](#compatibility-and-limits)
[![check](https://github.com/mrwisdon/dsh-sidebar-entries-toggle/actions/workflows/check.yml/badge.svg)](https://github.com/mrwisdon/dsh-sidebar-entries-toggle/actions/workflows/check.yml)
[![build](https://img.shields.io/badge/build-none%20(plain%20JS)-brightgreen)](#development)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) web-client plugin. It gives
the left sidebar two things the stock UI lacks:

1. **A collapse row + draggable divider** - fold the plugin entries away with one click, or drag the
   divider to split the sidebar between plugin entries and the workspace list.
2. **A workspace & session quick picker** - a small button in the *Workspaces* header opening a
   filterable popover over every workspace and session.

One hand-written browser file. No build step, no dependencies, no network access, no telemetry.

English | [中文](README.zh.md)

---

## What it does

### Plugin entries: collapse and divider

A row is inserted as the first child of the sidebar's panel list (`<nav>`): a chevron plus a label.
Clicking it toggles `data-dsh-entries-collapsed` on that `nav`, and the plugin's own CSS hides the
panel rows, keeping only this row and the "more" launcher. Below the list sits a 7 px drag strip that
rescales the entries list against the workspace list.

| Gesture | Effect |
|---|---|
| Click the row | Collapse / expand the plugin entries. Host state (active panel, pins, route) is untouched. |
| Drag the divider | Set the entries height, clamped to `[44 px, available - 120 px]`; the ratio is persisted. |
| Double-click the divider | Clear the stored ratio and give the list back to its content height. |
| `↑` / `↓` on the focused divider | Move by 16 px and persist the ratio. |
| `Home` / `End` | Jump to the minimum (44 px) or to *available - 120 px*. |
| Resize the window | Re-clamp; if the sidebar has become a narrow rail, hand layout back to the content. |

The row and divider are focusable and labelled: the row is a `<button>` with `aria-expanded` and
`aria-controls` pointing at the nav; the divider is `role="separator"` with
`aria-orientation="horizontal"` and `tabindex="0"`. The entries list gets `overflow-y: auto`, so a
long plugin list scrolls instead of pushing the workspace list out of the viewport.

### Workspaces: quick picker

A 26x26 button is appended to the header row of the workspace list ("Workspaces"). It opens a
340 px, fixed-position popover with:

- a filter input matching workspace titles, workspace paths, and session titles;
- one row per workspace - title, plus `N sessions`;
- its sessions underneath (title, `sessionId` as fallback), indented;
- a click on either calls the host's `uiWorkspace` service (`openWorkspace(id)` / `openSession(id)`);
- `Escape` or a click outside closes it; the popover flips left/up when it would leave the viewport.

Empty states are explicit: *No workspace data yet* (no snapshot reached the plugin) and
*No matches* (filter matched nothing). When the navigation service is missing, the popover prints a
localized note instead of throwing.

### Accessibility

- The collapse row is a real `<button>` with `aria-expanded` and `aria-controls`; the divider is a
  focusable `role="separator"` that publishes `aria-valuemin` / `aria-valuemax` / `aria-valuenow`
  as it is dragged or nudged from the keyboard.
- Picker rows are `role="button"` and activate on `Enter` / `Space`, not only on click. Opening the
  popover moves focus into the filter input; closing it returns focus to the picker button, and
  `Escape` closes it from anywhere.
- Labels, tooltips, and the failure notes follow the interface language (Chinese or English).

## Why it builds its own DOM

The sidebar's registration slots are single-occupancy, and the official UI already occupies the ones
that would have fit:

| Slot | Occupant | Fits this plugin? |
|---|---|---|
| `brand.mark` | host logo | single - registering hides the logo |
| `brand.name` | host product name | single - registering hides the name |
| `toggle.badge` | host collapse toggle | single - registering hides the toggle |
| `workspaces` | workspace list | single - registering replaces the list |
| `sidebar.footer.action` | empty-ish, **bottom of the sidebar** | additive, but far from the entries |

So the row, the divider, the picker button, and the popover are all hand-built nodes inserted into
host DOM. The one slot the plugin *does* register into - `sidebar.footer.action` - renders `null`
and is used for two other purposes:

- **Data harvest.** There is no client service that lists workspaces or sessions. The only source is
  the `standardProps` hooks (`useWorkspaces`, `useSessions`) that the host provides to slot
  components. A null-rendering component in the footer can call them; the hand-built popover reads
  the snapshots it publishes.
- **Load probe.** If the hand-built DOM ever fails to insert, the registered slot component still
  proves the bundle loaded and the client module graph resolved.

## How it works

### Finding the sidebar nav

`isSidebarNav(nav)` accepts a `<nav>` only when it is `isConnected`, **24-560 px wide**,
**at most 140 px from the left edge**, and **contains an `[aria-haspopup="menu"]` launcher** (the
"more" button). Among several candidates, one whose computed `flex-direction` is `column` wins,
because the panel list is a vertical stack; breadcrumbs, settings navigation, and file trees are
excluded by the same test.

The heuristic is re-run on every sync. If the nav is replaced or mis-identified, the plugin detaches
(all attributes and inline styles it wrote are restored from captured originals) and re-adopts the
new candidate. If nothing matches, it does nothing - there is no fallback DOM.

### Collapsing without touching host state

Collapse is CSS-only:

```css
nav[data-dsh-entries-nav][data-dsh-entries-collapsed]
  > *:not(#dsh-entries-toggle-row):not(:has([aria-haspopup="menu"])) { display: none !important; }
```

Two attributes gate it, so a stray `data-dsh-entries-collapsed` on some other `nav` cannot hide
anything. The "more" launcher survives because it is matched by the `:has()` exclusion. The plugin
never writes to the host's panel state; expanding again simply removes the attribute.

### The height model

`availableSpace()` is `nav.height + region.height`, where region is `nav.nextElementSibling`.
From that:

```
maxNav  = max(MIN_NAV, available - MIN_REGION)              // MIN_NAV = 44, MIN_REGION = 120
height  = round(clamp(ratio * available, MIN_NAV, maxNav))  // when a ratio is stored
height  = min(contentHeight, maxNav)                        // otherwise: natural height, capped
```

Height is applied as inline `flex: 0 0 auto; min-height: 0; overflow-y: auto; height: Npx` on the
nav, and the region is given `min-height: 0` so flex can actually shrink it. The natural-height
branch measures `scrollHeight` once and writes the height only when the value changes, which avoids
the "set height -> measure -> reset" oscillation. Under **120 px** the sidebar is treated as a rail:
the row renders icon-only, the divider is hidden, and the nav height is released entirely.

### Surviving React re-renders

The host re-renders the sidebar constantly (a streaming response re-renders it per token), so the
plugin treats its nodes as disposable:

- A `MutationObserver` watches **two child lists only** - the nav's parent and the nav itself -
  never `subtree`. If the nav disappears, the observer falls back to `document.body` until a new
  candidate is adopted. If the row was removed, it is re-inserted first; if rows were added or
  removed, the height is re-evaluated.
- Callbacks are coalesced into one `requestAnimationFrame`.
- A `ResizeObserver` on the nav's parent re-checks rail mode and re-applies the layout.
- The picker's observer watches `document.body` but **only re-mounts the button** - it never redraws
  an open popover, because a redraw during streaming would land `pointerdown` and `pointerup` on
  different nodes and clicks would stop registering. Popover content updates come from the snapshot
  signature instead.

### The picker's data path

```
host slot component (renders null)
  useWorkspaces(state => state.items)      -+
  useSessions(state => state)              -+-> PICK = { workspaces, sessions, listeners }
                                              ^ signature: id|title|path|session titles...
hand-built popover  --------------------------+   (skips no-op updates)
```

The selector functions are module-level constants, not fresh arrow functions per render, so a store
implementation that compares reference identity does not re-render on every pass. Both hooks are
optional at runtime: if the slot does not supply them, the store stays empty and the popover shows
*No workspace data yet*. The button mount is retried at 120 / 400 / 1200 / 2600 ms after start
because the header row may not have committed on first paint.

### Localization

Two independent layers:

| Layer | Source | Used for |
|---|---|---|
| Package metadata | `locale/en.json`, `locale/zh.json` (title + description) | the plugin's entry in host plugin lists |
| Runtime strings | inline `TEXT` (`zh`/`en`) + `locale.register(NS, TEXT)` / `locale.bind(NS)` | row label, tooltips, ARIA labels |

The fallback is Chinese when no host translation is bound. The picker picks its language from
`document.documentElement.lang`, then `navigator.language`, and also defaults to Chinese. All
colors come from host CSS variables (`--dsw-alias-*`, `--dsh-sidebar-*`, `--dsw-radius-*`, focus
ring), so the plugin follows the active theme; the only literal colors are the fallback values
inside `var(..., fallback)`.

## Install

The plugin is a **profile bundle**: its `package.json` declares `dsh.bundle.patch` ->
`cordis.patch.yml`, and that patch inserts the loader entry:

```yaml
- insert:
    - id: sidebar-entries-toggle
      name: 'dsh-sidebar-entries-toggle'
```

So installing it is two facts in the profile: **a dependency** and **a bundle entry**. The bundle
entry is what wires the loader; without it the package sits in `node_modules` unused.

### Option A - let the CLI do both

`dsh plugin` forwards its arguments to pnpm inside the profile directory, then reconciles
`dsh.profile.bundles` for any newly installed package that declares `dsh.bundle`:

```bash
dsh plugin --profile web add github:mrwisdon/dsh-sidebar-entries-toggle
```

Replace `web` with your profile name - `web` is the profile the `dsh web` UI boots by default.
`dsh plugin` needs `--profile`; it forwards everything after the profile to pnpm inside
`~/.dsh/profiles/<name>`.

### Option B - local checkout

`link:` keeps your working copy the source of truth, so edits to `client.js` show up after a
restart with no reinstall. Relative paths resolve from the directory you run the command in:

```bash
cd ~/.dsh/profiles/web
dsh plugin --profile web add link:/path/to/dsh-sidebar-entries-toggle
```

A relative spec is resolved from the directory you run the command in (`../../..` from
`~/.dsh/profiles/web` climbs back to `~`), which keeps the profile portable across machines; an
absolute path is fine for a one-off.

### Option C - edit the profile manifest by hand

In `~/.dsh/profiles/<name>/package.json`:

```json
{
  "dependencies": {
    "dsh-sidebar-entries-toggle": "github:mrwisdon/dsh-sidebar-entries-toggle"
  },
  "dsh": {
    "profile": {
      "bundles": ["... existing bundles ...", "dsh-sidebar-entries-toggle"]
    }
  }
}
```

Then install and restart:

```bash
cd ~/.dsh/profiles/web && pnpm install
```

Bundle order is layer order (each bundle's patch is applied in list order, then the profile's own
`cordis.patch.yml`). This plugin only appends a row, so appending it last is safe.

### After installing

Restart DSH (or restart the app / re-run `dsh --profile web`). You should see: the chevron row at the
top of the plugin entries, a drag strip between the entries and the workspace list, and the small
picker button in the *Workspaces* header. Nothing else: the plugin registers no model tools, no
commands, and touches no files.

> DSH Desktop reserves the `desktop` profile - the CLI refuses to manage it. Edit that profile's
> `package.json` the same way and restart the app.

## Constants and storage

| Name | Value | Where |
|---|---|---|
| `STORAGE_KEY` | `dsh.sidebarEntriesToggle.collapsed` | `localStorage`, values `'1'` / `'0'` |
| `RATIO_KEY` | `dsh.sidebarEntriesToggle.ratio` | `localStorage`, a float in `(0,1)`; persisted clamped to `0.05-0.95` |
| `MIN_NAV` | 44 px | minimum entries height |
| `MIN_REGION` | 120 px | space always left to the workspace list |
| `RAIL_WIDTH` | 120 px | below this nav width, rail mode |
| `ATTR` | `data-dsh-entries-collapsed` | nav collapse marker |
| `NAV_FLAG` | `data-dsh-entries-nav` | nav adoption marker (gates the CSS) |
| `ROW_ID` | `dsh-entries-toggle-row` | collapse row (`<button>`), label span `dsh-entries-toggle-label` |
| `DIV_ID` | `dsh-entries-resizer` | divider |
| `STYLE_ID` | `dsh-sidebar-entries-toggle-style` | the injected `<style>` |
| `PICK_BTN_ID` / `PICK_POP_ID` | `dsh-picker-btn` / `dsh-picker-pop` | picker button / popover |
| Nav detection | width 24-560 px, `left <= 140 px`, contains `[aria-haspopup="menu"]` | `isSidebarNav()` |
| Ratio validity | stored value must satisfy `0 < v < 1`, else ignored | `readRatio()` |

Storage is read once per mount and written on interaction. Every `localStorage` access is wrapped:
in private mode or with storage disabled the plugin still works, it just does not remember.

## Compatibility and limits

- **Web client only.** `package.json` declares `dsh.client.platform: "web"` and
  `dsh.client.inject: ["@deepseek-ai/dsh-client-ui-sidebar"]`; there is no TUI or desktop-native
  rendering. Written against DSH `0.2.2-rc.1`; no peer version is declared, so a host whose
  sidebar internals changed may load it and show nothing.
- **It depends on host DOM, not on a public DOM contract.** Specifically:

| Host detail | Used for | If it changes |
|---|---|---|
| A left `<nav>` 24-560 px wide within 140 px of the left edge | nav detection | no row, no divider |
| An `[aria-haspopup="menu"]` element inside that nav | detection *and* the collapse exception | detection fails, or the launcher gets hidden |
| `nav.nextElementSibling` being the workspace region | height math | the divider splits the wrong pair |
| A ~18-56 px tall, >=100 px wide header row containing a `<button>`, within 36 px of the region top | picker button mount | no picker button |
| `sidebar.footer.action` supplying `useWorkspaces` / `useSessions` | picker data | popover shows *No workspace data yet* |
| A `uiWorkspace` service with `openWorkspace` / `openSession` | picker navigation | popover prints a "service unavailable" note |

- **Degradation is silent by design.** If the sidebar cannot be identified the plugin does nothing
  rather than guessing; if the workspace header cannot be found no button appears. The only visible
  failures are the picker's own inline notes.
- **One rough edge:** the two "service unavailable" notes in the popover are hard-coded Chinese even
  when the interface is English.
- No tests ship with this repo (there is no build and no test harness) - the verification story is
  manual: load it, collapse it, drag the divider, reload, confirm both are restored.

## Development

`client.js` **is** the source - no bundler, no TypeScript, no transpile step. It is a plain IIFE that
registers a lazy factory:

```js
window.__ModuleLoader__.load({
  id: 'dsh-sidebar-entries-toggle',
  factory(require) { /* everything lives here */ },
})
```

The factory body runs at materialization, not at script execution: CSS injection, DOM insertion and
event listeners all happen inside `apply(ctx)`, and its cleanup closes over the same closure. Keep
that shape - a top-level side effect would run before the host's slots exist.

Try a change with the local `link:` install (Option B):

1. edit `client.js`;
2. restart DSH (the bundle is served from disk at boot; there is no HMR for it);
3. check the console for `[sidebar-entries-toggle]` errors.

## Repository layout

| File | Lines | Role |
|---|---|---|
| `client.js` | 1228 | the whole browser plugin: nav adoption, collapse row, divider, picker |
| `index.js` | 7 | host half - an empty `apply()`, present to satisfy the bundle contract |
| `cordis.patch.yml` | 3 | one `insert` entry naming the loader row |
| `package.json` | 67 | `dsh.bundle.patch`, `dsh.client` (web, immediate, sidebar injection), exports |
| `locale/en.json`, `locale/zh.json` | 6 each | plugin-list metadata only |
| `icon.svg` | 5 | 24x24 up/down chevrons, `#7C8CF8` |
| `README.md`, `README.zh.md` | 333 / 299 | this document, and its Chinese mirror |
| `docs/ARCHITECTURE.md` | 162 | internals: lifecycle, subsystems, failure modes, line references |
| `CHANGELOG.md` | 34 | release notes |
| `LICENSE` | 21 | MIT |
| `.github/workflows/check.yml` | 23 | CI: syntax, manifest wiring, packaging dry run |

## License

MIT. Not affiliated with or endorsed by DeepSeek. "DeepSeek Harness" and its marks belong to their
owners.
