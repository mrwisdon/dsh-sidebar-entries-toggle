# Architecture

How `client.js` works, where its boundaries are, and which invariants a change must not break.
Line numbers refer to [`../client.js`](../client.js) (1228 lines, v0.4.0, written against DSH
`0.2.2-rc.1`).

## Package shape

| File | Part | Contract |
|---|---|---|
| `index.js` | host half | exports `apply()`, which is empty — all behavior is browser-side |
| `client.js` | browser half | an IIFE that calls `window.__ModuleLoader__.load({ id, factory })` |
| `cordis.patch.yml` | profile layer | one `insert` row: `{ id: sidebar-entries-toggle, name: 'dsh-sidebar-entries-toggle' }` |

`package.json` ties the halves together: `dsh.bundle.patch` points the profile loader at the patch,
and `dsh.client` (`platform: "web"`, `immediately: true`,
`inject: ["@deepseek-ai/dsh-client-ui-sidebar"]`) tells the host's client module system to ship
`./client` to the browser and to load it after the sidebar package it decorates.

The factory body is **lazy CJS**: executing `client.js` only registers a closure. CSS injection, DOM
work and listeners happen when the factory is materialized and `apply(ctx)` runs, and the returned
teardown closes over the same closure. Nothing may be moved to module top level — at script
execution time `document.head` is there but the host's slots and sidebar DOM are not.

## Runtime topology

```
<nav id="dsh-panel-nav">                      <- adopted, flagged data-dsh-entries-nav
  <button id="dsh-entries-toggle-row">        <- inserted first child
  ...host panel rows...
  ...host "more" launcher ([aria-haspopup=menu])...
</nav>
<div id="dsh-entries-resizer">                <- inserted between nav and region
<div class="region">                          <- nav.nextElementSibling
  <header row>                                <- detected heuristically
    ...host header buttons...
    <button id="dsh-picker-btn">              <- appended last
<div id="dsh-picker-pop">                     <- appended to body, only while open
```

The probe is not in this tree: it lives in the `sidebar.footer.action` slot as a component that
returns `null`.

## Lifecycle

```
apply(ctx)
  ├─ slots.inject('sidebar.footer.action', ...)         registers a probe that renders null and
  │                                                      harvests useWorkspaces/useSessions
  ├─ locale.register / locale.bind                       TEXT via ctx.locale (optional)
  └─ ctx.effect(() => { inject CSS; mount(); mountPicker(); subscribe(locale);
                        return teardown })
```

`mount()` (545) sets `mounted`, reads the two storage keys, builds the row and divider, creates the
`MutationObserver` and `ResizeObserver`, adopts `findNav()`'s candidate if any, and calls `sync()`.
`unmount()` (580) is the mirror image: cancel the pending animation frame, disconnect both
observers, remove the window listener, call `restoreRegionStyle()`, restore the nav's captured
inline style, detach every listener (including the ones the divider needed), and delete both nodes.

`detachFromNav()` (362) is the partial version used when the nav is replaced at runtime: it removes
both attributes, restores `savedNavStyle`, removes the divider, delegates the region to
`restoreRegionStyle()` (353), and clears `navEl`, `regionEl`, `navSized`.

## Subsystem A — entries height

State: `collapsed`, `ratio` (or `null`), `navSized` (`-1` = never sized, `null` = natural, number =
explicit px), plus `savedNavStyle` / `savedRegionStyle` / `savedRegionOwner` (103). The owner guard
matters because the region keeps our `min-height: 0` between adopts: re-adopting must not capture the
mutated style as the original.

All height writes funnel through `setNavHeight()` (268), which short-circuits when the requested value
equals `navSized` and then refreshes the divider's `aria-valuemin` / `aria-valuemax` / `aria-valuenow`
through `syncDividerValue()` (258) — the separator exposes its current range to assistive tech, seeded
at build time by `buildDivider()` (186). That single-writer rule is what keeps the layout from
oscillating: `applyLayout()` (285) can be called from the observer, the resize observer, the window
resize listener, drag moves, keyboard steps and unmount, and repeated identical requests are free.

```
applyLayout()
  rail? or collapsed? or no region?  -> setNavHeight(null)   // give the list back to content
  available = nav.height + region.height; if 0 -> return
  maxNav = max(44, available - 120)
  ratio !== null  -> setNavHeight(round(clamp(ratio * available, 44, maxNav)))
  else            -> scrollHeight > maxNav ? setNavHeight(maxNav) : setNavHeight(null)
```

Interactive paths write `ratio` only after clamping to `[0.05, 0.95]` (`persistRatioFromHeight`, 457), so
a drag that ends at the minimum 44 px still stores a sane fraction. `onResetRatio` (513) sets
`ratio = null`, removes the key and clears the height — the list returns to content height, not to
a default split.

Invariants:

1. Only one nav is adopted at a time; `sync()` detaches before adopting.
2. Every host inline-style mutation is paired with a captured original (`savedNavStyle`,
   `savedRegionStyle`); teardown restores them verbatim.
3. Host panel state is never written — collapse is one attribute plus scoped CSS.
4. Nothing is rendered when no candidate nav passes `isSidebarNav()`.

## Subsystem B — the workspace picker

The picker is a three-stage pipeline, because the host exposes no list service:

```
slot component (renders null)
   props.useWorkspaces(PICK_SEL_WORKSPACES)   -> state.items
   props.useSessions(PICK_SEL_SESSIONS)       -> state
   useEffect([workspaces, sessions])          -> computeSignature(); if changed, write PICK; notify
                                                     |
hand-built popover  <--------------------------------+  PICK.listeners -> onDataChange()
```

`PICK` (636) is module-level: `{ workspaces, sessions, listeners }`. The two selectors (639, 642) are
stable references on purpose — an inline arrow function per render makes identity-comparing stores
re-render forever. `computeSignature()` (707) hashes `id|title|path|session titles` per workspace so
the effect can bail out when a re-render produced no new data.

Mounting the button is deliberately sloppy and redraw is deliberately absent:

- `mountPickerButton()` (1042) is idempotent and safe to call repeatedly; it is invoked by
  `mountPicker()`, by a `document.body` `MutationObserver` (coalesced into one frame), and by four
  timers (120 / 400 / 1200 / 2600 ms) because the header may mount after the plugin applies.
- The observer callback **never** re-renders an open popover (1101-1111). During streaming the host
  re-renders constantly; a redraw would replace the popover's DOM between `pointerdown` and
  `pointerup`, and clicks would never fire. Content updates ride `PICK.listeners` instead.

Rows are reachable without a mouse: `bindRowActivate()` (790) wires click *and* `Enter` / `Space` to the
same action, for workspace rows and session rows alike. Opening the popover focuses the filter input
(`focusPickerInput`, 921, deferred one tick after mount at 1001-1003); closing it returns focus to the
button (`focusPickerButton`, 930, called from `closePicker()` 939).

Navigation goes through `api.get('uiWorkspace')` (`pickerService`, 874). A missing service, or a
missing method, routes to `showPickerNote()` (863) — the popover shows a line of text and stays open.
That text is a `PICK_TEXT` entry (`noWorkspaceService` / `noSessionService`, 656-667) read through
`pickLang()`, so it follows the same language as the rest of the popover.

Promises returned by `openWorkspace` are guarded with `.catch`; `openSession` is called in a
`try/catch`. Errors are logged with the `[sidebar-entries-toggle]` prefix.

## Failure modes

| Failure | Detection | Behavior |
|---|---|---|
| No nav passes the heuristic | `findNav()` returns null | observer still runs; nothing renders |
| Nav replaced by React | `!nav.isConnected` in the observer | `schedule()`; `sync()` re-adopts |
| Row removed from nav | `nav.firstElementChild !== rowEl` | re-inserted at the top |
| Sidebar collapsed to rail | `width < 120` | icon-only row, divider hidden, height released |
| Popover data never arrives | `PICK.workspaces` empty | *No workspace data yet* |
| Header row not found | `findHeader()` returns null | button not mounted; retries already scheduled |
| `uiWorkspace` missing | service/method check | localized inline note, no throw |
| `localStorage` unavailable | try/catch | state not remembered, everything else works |
| Host locale missing | `boundT` null | built-in `TEXT.zh` strings |

## Adding to it

- **Another sidebar control**: build the node in `mount()`, insert it near `ROW_ID`, and make
  `paintRow()`/`measureRail()` responsible for its dynamic attributes. Do not add listeners outside
  `mount()`/`unmount()` — teardown must be able to remove every one.
- **A new heuristic input**: extend `isSidebarNav()` (211), keep it cheap (it runs on every sync) and
  keep the failure answer "do nothing".
- **New strings**: add them to `TEXT` (49) and to the locale registration; `t()` falls back to
  `TEXT.zh`, so a missing key is never empty.
- **New picker fields**: the snapshot is whatever the two hooks return; extend `collectEntries()`
  (759) and the signature in the same change, or the effect will not fire. Picker strings go in
  `PICK_TEXT` (both languages), not `TEXT`.

## Known trade-offs

- Heuristic nav detection is chosen over slot registration because the slots are single-occupancy;
  the cost is that a host DOM change is a silent no-op rather than an error.
- The footer probe exists only to reach `standardProps`; it is a load-visible side effect in a slot
  that would otherwise be unused.
- Workspace data arrives through React hooks, so the popover is a plain DOM reader of a React
  snapshot. That keeps the popover independent of the host's render loop but means it cannot ask for
  fresher data than the hooks expose.
