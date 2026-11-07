/**
 * dsh-sidebar-entries-toggle — 侧栏插件入口：顶部一键收起/展开 + 插件区可拖动分配高度。
 *
 * 为什么自建 DOM
 * - 宿主侧栏顶部没有留给插件的 additive 槽位：brand.mark / brand.name / toggle.badge /
 *   workspaces 都是 single 且已被官方 UI 占用，注册即遮蔽官方 UI；footer.action 虽有位置
 *   但落在页脚最底部。因此入口与分隔条都作为自建节点插入面板列表 `<nav>`。
 *
 * 行为
 * - 顶部一行「收起/展开插件入口」：点击给 `<nav>` 挂 `data-dsh-entries-collapsed`，
 *   由本插件 CSS 隐藏面板行、只留「更多」与本行。宿主状态（当前面板/pin/路由）不动。
 * - `<nav>` 与工作区之间一条可拖动分隔条：拖动分配两者高度比例并记住；双击恢复默认；
 *   键盘 ↑/↓ 微调。
 * - 面板列表设最小高度约束与 `overflow-y:auto`，入口多时可以滚动选择。
 * - 状态存 localStorage，刷新后保持。
 * - 「工作区」表头末尾一个选择器按钮 `dsh-picker-btn`：点开浮层 `dsh-picker-pop`，
 *   列出全部工作区及其会话，可按标题/路径过滤；点工作区或会话经 `api.get('uiWorkspace')`
 *   的 openWorkspace / openSession 导航。找不到表头就不挂按钮（fail-safe）。
 *
 * 选择器的数据从哪来
 * - 宿主没有开放「列举工作区/会话」的 Client 服务，只有 slot 组件的 standardProps 钩子
 *   带着这两份快照。所以在 slot `sidebar.footer.action` 注册一个不渲染任何内容的探针组件，
 *   用它的 useWorkspaces / useSessions 钩子把快照写进插件内的 PICK 存储，自建 DOM 的
 *   浮层再读这份数据。
 * - 文案走 pickLang()：按 documentElement 的 lang / navigator.language 选 zh 或 en，
 *   取不到时回退中文；词典是 PICK_TEXT，与行/分隔条用的 TEXT 相互独立。
 *
 * 健壮性
 * - nav 认定不只看结构，还要求「左贴边 + 宽度合理」；每次同步重新校验，认错会立刻换回。
 * - CSS 只在 nav 带本插件标记 `data-dsh-entries-nav` 时才隐藏行，误挂属性不会伤到别的 nav。
 * - nav 被 React 重建 / 本行被顶掉时自动补回；观察范围收在 nav 的父节点，开销低。
 */
;(function () {
  window.__ModuleLoader__.load({
    id: 'dsh-sidebar-entries-toggle',
    factory(require) {
      const NS = 'sidebarEntriesToggle'
      const ATTR = 'data-dsh-entries-collapsed'
      const NAV_FLAG = 'data-dsh-entries-nav'
      const ROW_ID = 'dsh-entries-toggle-row'
      const DIV_ID = 'dsh-entries-resizer'
      const STYLE_ID = 'dsh-sidebar-entries-toggle-style'
      const STORAGE_KEY = 'dsh.sidebarEntriesToggle.collapsed'
      const RATIO_KEY = 'dsh.sidebarEntriesToggle.ratio'
      const RAIL_WIDTH = 120
      const MIN_NAV = 44
      const MIN_REGION = 120

      const TEXT = {
        zh: {
          entries: '插件入口',
          collapse: '收起插件入口',
          expand: '展开插件入口',
          resizer: '调整插件入口与工作区的高度比例',
        },
        en: {
          entries: 'Plugin entries',
          collapse: 'Collapse plugin entries',
          expand: 'Expand plugin entries',
          resizer: 'Resize the plugin entries area',
        },
      }

      const CSS = [
        '#' + ROW_ID + '{display:flex;align-items:center;gap:var(--dsh-sidebar-label-gap,6px);',
        'box-sizing:border-box;width:100%;min-height:36px;flex:none;margin:0;',
        'padding:0 var(--dsh-sidebar-row-padding,12px);border:0;border-radius:var(--dsw-radius-md,6px);',
        'background:transparent;color:var(--dsw-alias-label-secondary,currentColor);',
        'font:inherit;text-align:left;cursor:pointer;-webkit-appearance:none;appearance:none}',
        '#' + ROW_ID + ':hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.16))}',
        '#' + ROW_ID + ':focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
        'var(--dsw-focus-ring-color,currentColor);outline-offset:-2px}',
        '#' + ROW_ID + '>svg{flex:none;display:block;opacity:.9}',
        '#dsh-entries-toggle-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '#' + ROW_ID + '[data-rail="1"]{justify-content:center;padding:0}',
        '#' + ROW_ID + '[data-rail="1"]>#dsh-entries-toggle-label{display:none}',
        'nav[' + NAV_FLAG + '][' + ATTR + ']{row-gap:0!important}',
        'nav[' + NAV_FLAG + '][' + ATTR + ']>*:not(#' + ROW_ID + '):not(:has([aria-haspopup="menu"])){display:none!important}',
        '#' + DIV_ID + '{flex:0 0 auto;position:relative;box-sizing:border-box;height:7px;margin:2px 4px 4px;',
        'border:0;padding:0;background:transparent;border-radius:4px;cursor:row-resize;touch-action:none;color:inherit}',
        '#' + DIV_ID + '::before{content:"";position:absolute;left:var(--dsh-sidebar-inline-padding,8px);',
        'right:var(--dsh-sidebar-inline-padding,8px);top:50%;height:2px;margin-top:-1px;border-radius:1px;',
        'background:currentColor;opacity:.22}',
        '#' + DIV_ID + ':hover::before,#' + DIV_ID + '[data-dragging="1"]::before{opacity:.6}',
        '#' + DIV_ID + ':focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
        'var(--dsw-focus-ring-color,currentColor);outline-offset:-1px}',
        '#' + DIV_ID + '[data-rail="1"]{display:none}',
        '#' + DIV_ID + '[data-collapsed="1"]{display:none}',
      ].join('')

      let boundT = null
      let api = null

      let collapsed = false
      let ratio = null
      let mounted = false
      let rowEl = null
      let divEl = null
      let navEl = null
      let regionEl = null
      let savedNavStyle = ''
      let savedRegionStyle = ''
      let savedRegionOwner = null
      let navSized = -1
      let observer = null
      let resizeObserver = null
      let frame = 0
      let dragging = null
      let pickBtn = null
      let pickPop = null
      let pickObserver = null
      let pickFrame = 0

      /* ---------- 文案与状态 ---------- */

      function t(key, fallback) {
        if (boundT) {
          try {
            const value = boundT(key)
            if (typeof value === 'string' && value && value !== key) return value
          } catch (error) {
            /* 退回内置文案 */
          }
        }
        const dict = TEXT.zh
        return dict[key] || fallback
      }

      function readStored() {
        try {
          return window.localStorage.getItem(STORAGE_KEY) === '1'
        } catch (error) {
          return false
        }
      }

      function writeStored(value) {
        try {
          window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
        } catch (error) {
          /* 隐私模式等写不进去：只是不记忆 */
        }
      }

      function readRatio() {
        try {
          const raw = window.localStorage.getItem(RATIO_KEY)
          if (!raw) return null
          const value = Number(raw)
          if (!isFinite(value) || value <= 0 || value >= 1) return null
          return value
        } catch (error) {
          return null
        }
      }

      function writeRatio(value) {
        try {
          if (value === null) window.localStorage.removeItem(RATIO_KEY)
          else window.localStorage.setItem(RATIO_KEY, String(value))
        } catch (error) {
          /* 同上 */
        }
      }

      /* ---------- DOM 构造 ---------- */

      function chevronPath(expanded) {
        // 展开态显示"点一下会收起"的上箭头，收起态显示下箭头。
        return expanded ? 'M3.5 9.5 8 5l4.5 4.5' : 'M3.5 6.5 8 11l4.5-4.5'
      }

      function buildRow() {
        const row = document.createElement('button')
        row.type = 'button'
        row.id = ROW_ID
        row.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">' +
          '<path d="' + chevronPath(!collapsed) + '" stroke="currentColor" stroke-width="1.5" ' +
          'stroke-linecap="round" stroke-linejoin="round"></path></svg>' +
          '<span id="dsh-entries-toggle-label"></span>'
        row.addEventListener('click', onToggle)
        return row
      }

      function buildDivider() {
        const div = document.createElement('div')
        div.id = DIV_ID
        div.setAttribute('role', 'separator')
        div.setAttribute('aria-orientation', 'horizontal')
        div.setAttribute('aria-valuemin', String(MIN_NAV))
        div.setAttribute('aria-valuemax', String(MIN_NAV))
        div.setAttribute('aria-valuenow', String(MIN_NAV))
        div.setAttribute('tabindex', '0')
        div.addEventListener('pointerdown', onDragStart)
        div.addEventListener('pointermove', onDragMove)
        div.addEventListener('pointerup', onDragEnd)
        div.addEventListener('pointercancel', onDragEnd)
        div.addEventListener('dblclick', onResetRatio)
        div.addEventListener('keydown', onDividerKey)
        return div
      }

      /* ---------- nav 认定 ---------- */

      /**
       * 只在"贴着左边缘、宽度像侧栏、且含「更多」启动器（aria-haspopup=menu）"的 nav 里动手。
       * 侧栏 nav 是面板列表：位于整窗最左列、宽度数百像素。其它 nav（面包屑、设置导航、
       * 文件树）要么不在左列，要么没有菜单启动器，都会被排除。认不出就什么都不做。
       */
      function isSidebarNav(nav) {
        if (!nav || !nav.isConnected) return false
        const rect = nav.getBoundingClientRect()
        if (rect.width < 24 || rect.width > 560) return false
        if (rect.left > 140) return false
        return Boolean(nav.querySelector('[aria-haspopup="menu"]'))
      }

      function findNav() {
        const navs = document.querySelectorAll('nav')
        let fallback = null
        for (let i = 0; i < navs.length; i += 1) {
          const nav = navs[i]
          if (!isSidebarNav(nav)) continue
          // 面板列表是纵向 flex；同窗口里别的 nav 候选（若有）通常不是，优先选纵向的。
          let column = false
          try {
            column = window.getComputedStyle(nav).flexDirection === 'column'
          } catch (error) {
            column = false
          }
          if (column) return nav
          if (!fallback) fallback = nav
        }
        return fallback
      }

      /* ---------- 尺寸 ---------- */

      function isRail() {
        if (!navEl || !navEl.isConnected) return false
        const width = navEl.getBoundingClientRect().width
        return width > 0 && width < RAIL_WIDTH
      }

      function availableSpace() {
        if (!navEl || !regionEl) return 0
        const a = navEl.getBoundingClientRect().height
        const b = regionEl.getBoundingClientRect().height
        return a + b
      }

      function clamp(value, min, max) {
        if (max < min) return min
        return Math.min(max, Math.max(min, value))
      }

      function syncDividerValue() {
        if (!divEl) return
        const available = availableSpace()
        const maxNav = Math.max(MIN_NAV, available - MIN_REGION)
        const current = navEl ? navEl.getBoundingClientRect().height : MIN_NAV
        divEl.setAttribute('aria-valuemin', String(MIN_NAV))
        divEl.setAttribute('aria-valuemax', String(Math.round(maxNav)))
        divEl.setAttribute('aria-valuenow', String(Math.round(clamp(current, MIN_NAV, maxNav))))
      }

      function setNavHeight(height) {
        if (!navEl) return
        if (navSized === height) return
        navSized = height
        if (height === null) {
          navEl.style.cssText = savedNavStyle
          navEl.style.overflowY = navEl.style.overflowY || 'auto'
          syncDividerValue()
          return
        }
        navEl.style.flex = '0 0 auto'
        navEl.style.minHeight = '0'
        navEl.style.overflowY = 'auto'
        navEl.style.height = height + 'px'
        syncDividerValue()
      }

      function applyLayout() {
        if (!navEl || !mounted) return
        if (divEl) {
          const rail = isRail() ? '1' : '0'
          if (divEl.getAttribute('data-rail') !== rail) divEl.setAttribute('data-rail', rail)
        }
        // 侧栏收成窄条、或入口已收起时，列表交还给内容自然撑开。
        if (isRail() || collapsed || !regionEl) {
          setNavHeight(null)
          syncDividerValue()
          return
        }
        const available = availableSpace()
        if (available <= 0) {
          syncDividerValue()
          return
        }
        const maxNav = Math.max(MIN_NAV, available - MIN_REGION)
        if (ratio !== null) {
          setNavHeight(Math.round(clamp(ratio * available, MIN_NAV, maxNav)))
          syncDividerValue()
          return
        }
        // 没有手动比例时用内容自然高度，但至少给工作区留出 MIN_REGION；超出即滚动。
        // 用 scrollHeight 判断内容高度，避免"设高→量高→清零"来回抖动。
        const content = navEl.scrollHeight
        if (content > maxNav) {
          setNavHeight(Math.round(maxNav))
        } else if (navSized !== null) {
          setNavHeight(null)
        }
        syncDividerValue()
      }

      /* ---------- 绘制 ---------- */

      function measureRail() {
        if (!rowEl) return
        const rail = isRail() ? '1' : '0'
        if (rowEl.getAttribute('data-rail') !== rail) rowEl.setAttribute('data-rail', rail)
      }

      function paintRow() {
        if (divEl) {
          const hint = t('resizer', '调整插件入口与工作区的高度比例')
          divEl.setAttribute('aria-label', hint)
          divEl.setAttribute('title', hint)
          const flag = collapsed ? '1' : '0'
          if (divEl.getAttribute('data-collapsed') !== flag) divEl.setAttribute('data-collapsed', flag)
        }
        if (!rowEl) return
        const expanded = !collapsed
        const text = t(expanded ? 'collapse' : 'expand', expanded ? '收起插件入口' : '展开插件入口')
        const glyph = t('entries', '插件入口')
        rowEl.setAttribute('aria-label', glyph)
        rowEl.setAttribute('title', text)
        rowEl.setAttribute('aria-expanded', expanded ? 'true' : 'false')
        if (navEl && navEl.id) rowEl.setAttribute('aria-controls', navEl.id)
        const span = rowEl.querySelector('#dsh-entries-toggle-label')
        if (span && span.textContent !== text) span.textContent = text
        const path = rowEl.querySelector('path')
        if (path) path.setAttribute('d', chevronPath(expanded))
      }

      /* ---------- 同步 ---------- */

      // 把工作区的原始内联样式放回去（本插件加过 minHeight:0），并清掉记录，
      // 这样下次 adopt 抓到的一定是宿主原本的样式，不会把改过的当成原始值。
      function restoreRegionStyle() {
        if (regionEl && regionEl.isConnected) {
          if (savedRegionStyle) regionEl.setAttribute('style', savedRegionStyle)
          else regionEl.removeAttribute('style')
        }
        savedRegionStyle = ''
        savedRegionOwner = null
      }

      function detachFromNav() {
        if (navEl) {
          navEl.removeAttribute(ATTR)
          navEl.removeAttribute(NAV_FLAG)
          if (savedNavStyle) navEl.setAttribute('style', savedNavStyle)
          else navEl.removeAttribute('style')
        }
        if (divEl && divEl.parentNode) divEl.parentNode.removeChild(divEl)
        restoreRegionStyle()
        navEl = null
        regionEl = null
        navSized = -1
      }

      function adoptNav(nav) {
        navEl = nav
        nav.setAttribute(NAV_FLAG, '')
        if (!nav.id) nav.id = 'dsh-panel-nav'
        savedNavStyle = nav.getAttribute('style') || ''
        regionEl = nav.nextElementSibling
        if (regionEl) {
          // 同一元素重复 adopt 时不要重抓：此时它的 style 里已经有我们写的 minHeight。
          if (regionEl !== savedRegionOwner) {
            savedRegionStyle = regionEl.getAttribute('style') || ''
            savedRegionOwner = regionEl
          }
          if (!regionEl.style.minHeight) regionEl.style.minHeight = '0'
        }
        if (divEl && divEl.parentNode !== nav.parentElement) {
          if (regionEl) nav.parentElement.insertBefore(divEl, regionEl)
          else nav.parentElement.insertBefore(divEl, nav.nextSibling)
        }
        if (rowEl && nav.firstElementChild !== rowEl) {
          nav.insertBefore(rowEl, nav.firstElementChild)
        }
        attachObserver()
        observeScope()
      }

      function attachObserver() {
        if (!observer) return
        observer.disconnect()
        const scope = navEl && navEl.parentElement
        if (!scope) {
          observer.observe(document.body, { childList: true, subtree: true })
          return
        }
        // 只盯侧栏根的两个 childList：nav 被重建、或我们的行被顶掉。不观察 subtree，
        // 避免流式输出的每个 token 都唤醒回调。
        observer.observe(scope, { childList: true })
        observer.observe(navEl, { childList: true })
      }

      function observeScope() {
        if (!resizeObserver) return
        resizeObserver.disconnect()
        const scope = navEl && navEl.parentElement
        if (scope) resizeObserver.observe(scope)
      }

      function sync() {
        if (!mounted) return
        const candidate = findNav()
        if (candidate !== navEl) {
          detachFromNav()
          if (candidate) adoptNav(candidate)
          else attachObserver()
        } else if (navEl && navEl.firstElementChild !== rowEl) {
          navEl.insertBefore(rowEl, navEl.firstElementChild)
        }
        if (!navEl) return
        const has = navEl.hasAttribute(ATTR)
        if (collapsed && !has) navEl.setAttribute(ATTR, '')
        else if (!collapsed && has) navEl.removeAttribute(ATTR)
        measureRail()
        paintRow()
        applyLayout()
      }

      function schedule() {
        if (frame) return
        frame = window.requestAnimationFrame(function () {
          frame = 0
          sync()
        })
      }

      /* ---------- 交互 ---------- */

      function onToggle() {
        collapsed = !collapsed
        writeStored(collapsed)
        sync()
      }

      function persistRatioFromHeight(height, available) {
        const total = available > 0 ? available : availableSpace()
        if (total <= 0) return
        const next = clamp(height / total, 0.05, 0.95)
        ratio = next
        writeRatio(next)
      }

      function onDragStart(event) {
        if (event.button !== undefined && event.button !== 0) return
        if (!navEl || !divEl) return
        const available = availableSpace()
        if (available <= 0) return
        dragging = {
          pointerId: event.pointerId,
          startY: event.clientY,
          startHeight: navEl.getBoundingClientRect().height,
          available: available,
          max: Math.max(MIN_NAV, available - MIN_REGION),
        }
        divEl.setAttribute('data-dragging', '1')
        try {
          divEl.setPointerCapture(event.pointerId)
        } catch (error) {
          /* 某些环境不支持捕获，仍可拖动 */
        }
        event.preventDefault()
      }

      function onDragMove(event) {
        if (!dragging || event.pointerId !== dragging.pointerId) return
        const height = Math.round(
          clamp(dragging.startHeight + (event.clientY - dragging.startY), MIN_NAV, dragging.max),
        )
        setNavHeight(height)
        event.preventDefault()
      }

      function onDragEnd() {
        if (!dragging) return
        const height = navEl ? navEl.getBoundingClientRect().height : 0
        const available = dragging.available
        const pointerId = dragging.pointerId
        dragging = null
        if (divEl) {
          divEl.removeAttribute('data-dragging')
          try {
            divEl.releasePointerCapture(pointerId)
          } catch (error) {
            /* 忽略 */
          }
        }
        if (height > 0) persistRatioFromHeight(height, available)
        applyLayout()
      }

      function onResetRatio() {
        ratio = null
        writeRatio(null)
        setNavHeight(null)
        applyLayout()
      }

      function onDividerKey(event) {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Home' && event.key !== 'End') {
          return
        }
        event.preventDefault()
        const available = availableSpace()
        if (available <= 0) return
        const current = navEl ? navEl.getBoundingClientRect().height : available / 2
        let next = current
        if (event.key === 'ArrowUp') next = current - 16
        else if (event.key === 'ArrowDown') next = current + 16
        else if (event.key === 'Home') next = MIN_NAV
        else next = available - MIN_REGION
        next = Math.round(clamp(next, MIN_NAV, Math.max(MIN_NAV, available - MIN_REGION)))
        setNavHeight(next)
        persistRatioFromHeight(next, available)
      }

      function onWindowResize() {
        measureRail()
        applyLayout()
      }

      /* ---------- 生命周期 ---------- */

      function mount() {
        if (mounted) return
        mounted = true
        collapsed = readStored()
        ratio = readRatio()
        rowEl = buildRow()
        divEl = buildDivider()

        observer = new MutationObserver(function (records) {
          if (!navEl || !navEl.isConnected) {
            schedule()
            return
          }
          for (let i = 0; i < records.length; i += 1) {
            // 面板行增删要重新评估高度；我们的行被顶掉要补回。
            if (records[i].target === navEl) {
              schedule()
              return
            }
          }
        })

        resizeObserver = new ResizeObserver(function () {
          measureRail()
          applyLayout()
        })

        const candidate = findNav()
        if (candidate) adoptNav(candidate)
        attachObserver()
        observeScope()
        window.addEventListener('resize', onWindowResize)
        sync()
      }

      function unmount() {
        if (!mounted) return
        mounted = false
        if (frame) {
          window.cancelAnimationFrame(frame)
          frame = 0
        }
        if (observer) {
          observer.disconnect()
          observer = null
        }
        if (resizeObserver) {
          resizeObserver.disconnect()
          resizeObserver = null
        }
        window.removeEventListener('resize', onWindowResize)
        dragging = null
        restoreRegionStyle()
        if (rowEl) {
          rowEl.removeEventListener('click', onToggle)
          if (rowEl.parentNode) rowEl.parentNode.removeChild(rowEl)
          rowEl = null
        }
        if (divEl) {
          divEl.removeEventListener('pointerdown', onDragStart)
          divEl.removeEventListener('pointermove', onDragMove)
          divEl.removeEventListener('pointerup', onDragEnd)
          divEl.removeEventListener('pointercancel', onDragEnd)
          divEl.removeEventListener('dblclick', onResetRatio)
          divEl.removeEventListener('keydown', onDividerKey)
          if (divEl.parentNode) divEl.parentNode.removeChild(divEl)
          divEl = null
        }
        if (navEl && navEl.isConnected) {
          navEl.removeAttribute(ATTR)
          navEl.removeAttribute(NAV_FLAG)
          if (savedNavStyle) navEl.setAttribute('style', savedNavStyle)
          else navEl.removeAttribute('style')
        }
        navEl = null
        regionEl = null
        navSized = -1
      }

      /* ---------- 「工作区」表头：图形化选择器 ----------
       * 数据从哪来：宿主没有开放任何「列举工作区/会话」的 Client 服务，只有 slot 组件的
       * standardProps 钩子（useWorkspaces / useSessions）带着这两份快照。所以注册一个
       * 不渲染任何内容的组件，用它的钩子把快照写进 PICK 存储，自建 DOM 的浮层再读这份数据。
       * 放哪：插进「工作区」表头行末尾。表头由官方 UI 内部渲染、没有 additive 槽位，
       * 所以同样走自建节点；找不到表头就什么都不做（fail-safe）。
       */

      const PICK_BTN_ID = 'dsh-picker-btn'
      const PICK_POP_ID = 'dsh-picker-pop'
      const PICK_STYLE_ID = 'dsh-sidebar-entries-toggle-picker-style'

      const PICK = { workspaces: [], sessions: null, listeners: new Set() }

      // selector 必须是稳定引用：每次渲染新建箭头函数，某些 store 实现会因此反复重渲染。
      const PICK_SEL_WORKSPACES = function (state) {
        return state && state.items ? state.items : null
      }
      const PICK_SEL_SESSIONS = function (state) {
        return state || null
      }

      let pickSignatureCache = ''

      const PICK_TEXT = {
        zh: {
          open: '选择工作区与会话',
          placeholder: '筛选工作区或会话…',
          empty: '没有匹配项',
          noData: '暂无工作区数据',
          count: '个会话',
          newSession: '新会话',
          noWorkspaceService: 'uiWorkspace 服务不可用，无法切换工作区',
          noSessionService: 'uiWorkspace 服务不可用，无法打开会话',
        },
        en: {
          open: 'Pick a workspace or session',
          placeholder: 'Filter workspaces and sessions…',
          empty: 'No matches',
          noData: 'No workspace data yet',
          count: ' sessions',
          newSession: 'New session',
          noWorkspaceService: 'The uiWorkspace service is unavailable; cannot switch workspace',
          noSessionService: 'The uiWorkspace service is unavailable; cannot open the session',
        },
      }

      const PICK_CSS = [
        '#' + PICK_BTN_ID + '{display:inline-flex;align-items:center;justify-content:center;',
        'width:26px;height:26px;margin-inline-start:2px;padding:0;border:0;border-radius:var(--dsw-radius-md,6px);',
        'background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}',
        '#' + PICK_BTN_ID + ':hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
        '#' + PICK_BTN_ID + '[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
        '#' + PICK_BTN_ID + ':focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px}',
        '#' + PICK_POP_ID + '{position:fixed;z-index:3200;display:flex;flex-direction:column;',
        'width:340px;max-height:min(62vh,460px);overflow:hidden;padding:6px;',
        'border:1px solid var(--dsw-alias-line-border, rgba(0,0,0,.12));border-radius:var(--dsw-radius-md,10px);',
        'background:var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-base, #fff));',
        'box-shadow:0 12px 32px rgba(0,0,0,.22);font-size:12px;color:var(--dsw-alias-label-primary)}',
        '#' + PICK_POP_ID + ' input{width:100%;box-sizing:border-box;height:28px;margin:0 0 6px;padding:0 8px;',
        'border:1px solid var(--dsw-alias-line-border, rgba(0,0,0,.12));border-radius:var(--dsw-radius-md,6px);',
        'background:var(--dsw-alias-bg-base, transparent);color:inherit;font-size:12px;outline:none}',
        '#' + PICK_POP_ID + ' input:focus{border-color:var(--dsw-focus-ring-color)}',
        '#' + PICK_POP_ID + ' .dsh-picker-list{overflow-y:auto;min-height:0}',
        '#' + PICK_POP_ID + ' .dsh-picker-ws{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;',
        'cursor:pointer;font-weight:600}',
        '#' + PICK_POP_ID + ' .dsh-picker-ws:hover{background:var(--dsw-alias-interactive-bg-hover)}',
        '#' + PICK_POP_ID + ' .dsh-picker-ws .dsh-picker-count{margin-inline-start:auto;font-weight:400;opacity:.55}',
        '#' + PICK_POP_ID + ' .dsh-picker-sess{display:flex;align-items:center;gap:6px;padding:4px 8px 4px 24px;',
        'border-radius:6px;cursor:pointer}',
        '#' + PICK_POP_ID + ' .dsh-picker-sess:hover{background:var(--dsw-alias-interactive-bg-hover)}',
        '#' + PICK_POP_ID + ' .dsh-picker-sess .dsh-picker-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '#' + PICK_POP_ID + ' .dsh-picker-empty{padding:10px 8px;opacity:.6}',
      ].join('')


      function sessionTitleOf(sessions, sessionId) {
        if (!sessions || !sessions.byId) return ''
        const entry = sessions.byId[sessionId]
        if (!entry || typeof entry.title !== 'string') return ''
        return entry.title
      }

      function computeSignature(workspaces, sessions) {
        const list = Array.isArray(workspaces) ? workspaces : []
        const parts = []
        for (let i = 0; i < list.length; i++) {
          const workspace = list[i]
          const id = workspaceIdOf(workspace)
          const ids = Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []
          const titles = []
          for (let j = 0; j < ids.length; j++) titles.push(sessionTitleOf(sessions, String(ids[j])))
          parts.push(id + '|' + (workspace.title || '') + '|' + (workspace.path || '') + '|' + titles.join(','))
        }
        return parts.join(';')
      }

      function pickLang() {
        let lang = ''
        try {
          lang = document.documentElement.getAttribute('lang') || ''
        } catch (error) {
          /* ignore */
        }
        if (!lang) {
          try {
            lang = window.navigator.language || ''
          } catch (error) {
            /* ignore */
          }
        }
        return /^zh/i.test(lang) || !lang ? PICK_TEXT.zh : PICK_TEXT.en
      }

      function pickNotify() {
        PICK.listeners.forEach(function (fn) {
          try {
            fn()
          } catch (error) {
            /* 单个订阅者出错不影响其它 */
          }
        })
      }

      function workspaceIdOf(workspace) {
        if (!workspace) return ''
        return String(workspace.id || workspace.workspaceId || '')
      }

      function sessionIndexOf(sessions, sessionId) {
        if (!sessions || !sessions.byId) return null
        const entry = sessions.byId[sessionId]
        return entry || null
      }

      function collectEntries() {
        const list = Array.isArray(PICK.workspaces) ? PICK.workspaces : []
        const out = []
        for (let i = 0; i < list.length; i++) {
          const workspace = list[i]
          const id = workspaceIdOf(workspace)
          if (!id) continue
          const ids = Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []
          const sessions = []
          for (let j = 0; j < ids.length; j++) {
            const sessionId = String(ids[j])
            const meta = sessionIndexOf(PICK.sessions, sessionId)
            const title = meta && typeof meta.title === 'string' && meta.title ? meta.title : sessionId
            sessions.push({ id: sessionId, title: title })
          }
          out.push({
            id: id,
            title: (typeof workspace.title === 'string' && workspace.title) || workspace.path || id,
            path: typeof workspace.path === 'string' ? workspace.path : '',
            sessions: sessions,
          })
        }
        return out
      }

      function matches(text, query) {
        if (!query) return true
        return String(text).toLowerCase().indexOf(query) >= 0
      }

      // 行是 role=button 的自建节点：点击之外还要能用 Enter / Space 激活。
      function bindRowActivate(el, action) {
        el.addEventListener('click', action)
        el.addEventListener('keydown', function (event) {
          if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return
          event.preventDefault()
          action()
        })
      }

      function renderPickerList(listEl, query) {
        const text = pickLang()
        listEl.textContent = ''
        const entries = collectEntries()
        if (!entries.length) {
          const empty = document.createElement('div')
          empty.className = 'dsh-picker-empty'
          empty.textContent = text.noData
          listEl.appendChild(empty)
          return
        }
        let shown = 0
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]
          const sessions = entry.sessions.filter(function (session) {
            return matches(session.title, query)
          })
          const wsHit = matches(entry.title, query) || matches(entry.path, query)
          if (!wsHit && !sessions.length) continue
          shown += 1
          const wsRow = document.createElement('div')
          wsRow.className = 'dsh-picker-ws'
          wsRow.setAttribute('role', 'button')
          wsRow.setAttribute('tabindex', '0')
          wsRow.title = entry.path || entry.title
          const name = document.createElement('span')
          name.className = 'dsh-picker-title'
          name.textContent = entry.title
          wsRow.appendChild(name)
          const count = document.createElement('span')
          count.className = 'dsh-picker-count'
          count.textContent = String(entry.sessions.length) + text.count
          wsRow.appendChild(count)
          bindRowActivate(wsRow, function () {
            openWorkspace(entry.id)
          })
          listEl.appendChild(wsRow)
          const shownSessions = wsHit ? entry.sessions : sessions
          for (let j = 0; j < shownSessions.length; j++) {
            const session = shownSessions[j]
            const row = document.createElement('div')
            row.className = 'dsh-picker-sess'
            row.setAttribute('role', 'button')
            row.setAttribute('tabindex', '0')
            row.title = session.title
            const label = document.createElement('span')
            label.className = 'dsh-picker-title'
            label.textContent = session.title
            row.appendChild(label)
            bindRowActivate(row, function () {
              openSession(session.id)
            })
            listEl.appendChild(row)
          }
        }
        if (!shown) {
          const empty = document.createElement('div')
          empty.className = 'dsh-picker-empty'
          empty.textContent = text.empty
          listEl.appendChild(empty)
        }
      }


      function showPickerNote(message) {
        if (!pickPop) return
        const listEl = pickPop.querySelector('.dsh-picker-list')
        if (!listEl) return
        listEl.textContent = ''
        const box = document.createElement('div')
        box.className = 'dsh-picker-empty'
        box.textContent = message
        listEl.appendChild(box)
      }

      function pickerService() {
        try {
          return typeof api.get === 'function' ? api.get('uiWorkspace') : null
        } catch (error) {
          return null
        }
      }

      function openWorkspace(workspaceId) {
        const ui = pickerService()
        if (!ui || typeof ui.openWorkspace !== 'function') {
          showPickerNote(pickLang().noWorkspaceService)
          return
        }
        closePicker()
        try {
          const pending = ui.openWorkspace(workspaceId)
          if (pending && typeof pending.catch === 'function') {
            pending.catch(function (error) {
              if (typeof console !== 'undefined' && console.error) {
                console.error('[sidebar-entries-toggle] openWorkspace failed', error)
              }
            })
          }
        } catch (error) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[sidebar-entries-toggle] openWorkspace threw', error)
          }
        }
      }

      function openSession(sessionId) {
        const ui = pickerService()
        if (!ui || typeof ui.openSession !== 'function') {
          showPickerNote(pickLang().noSessionService)
          return
        }
        closePicker()
        try {
          ui.openSession(sessionId)
        } catch (error) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[sidebar-entries-toggle] openSession threw', error)
          }
        }
      }

      function focusPickerInput(input) {
        if (!input) return
        try {
          input.focus()
        } catch (error) {
          /* ignore */
        }
      }

      function focusPickerButton() {
        if (!pickBtn || !pickBtn.isConnected) return
        try {
          pickBtn.focus()
        } catch (error) {
          /* ignore */
        }
      }

      function closePicker() {
        if (pickPop && pickPop.parentNode) pickPop.parentNode.removeChild(pickPop)
        pickPop = null
        if (pickBtn) pickBtn.setAttribute('aria-expanded', 'false')
        document.removeEventListener('pointerdown', onPickerOutside, true)
        document.removeEventListener('keydown', onPickerKey, true)
        focusPickerButton()
      }

      function onPickerOutside(event) {
        if (!pickPop) return
        if (pickPop.contains(event.target)) return
        if (pickBtn && pickBtn.contains(event.target)) return
        closePicker()
      }

      function onPickerKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault()
          closePicker()
        }
      }

      function openPicker() {
        const text = pickLang()
        pickPop = document.createElement('div')
        pickPop.id = PICK_POP_ID
        pickPop.setAttribute('role', 'dialog')
        pickPop.setAttribute('aria-label', text.open)

        const input = document.createElement('input')
        input.type = 'text'
        input.placeholder = text.placeholder
        input.addEventListener('input', function () {
          renderPickerList(listEl, input.value.trim().toLowerCase())
        })
        pickPop.appendChild(input)

        const listEl = document.createElement('div')
        listEl.className = 'dsh-picker-list'
        pickPop.appendChild(listEl)
        renderPickerList(listEl, '')

        document.body.appendChild(pickPop)
        if (pickBtn) pickBtn.setAttribute('aria-expanded', 'true')

        const rect = pickBtn ? pickBtn.getBoundingClientRect() : { left: 120, bottom: 120, width: 0 }
        const width = 340
        let left = rect.left
        if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
        let top = rect.bottom + 6
        const height = pickPop.getBoundingClientRect().height || 320
        if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6)
        pickPop.style.left = Math.round(left) + 'px'
        pickPop.style.top = Math.round(top) + 'px'

        const stop = function (event) {
          event.stopPropagation()
        }
        pickPop.addEventListener('pointerdown', stop)
        document.addEventListener('pointerdown', onPickerOutside, true)
        document.addEventListener('keydown', onPickerKey, true)
        setTimeout(function () {
          focusPickerInput(input)
        }, 0)
      }

      function togglePicker() {
        if (pickPop) closePicker()
        else openPicker()
      }

      function findHeader(region) {
        if (!region) return null
        let regionTop = 0
        let regionWidth = 0
        try {
          const rect = region.getBoundingClientRect()
          regionTop = rect.top
          regionWidth = rect.width
        } catch (error) {
          return null
        }
        if (regionWidth < 120) return null
        const nodes = region.querySelectorAll('*')
        for (let i = 0; i < nodes.length; i++) {
          const el = nodes[i]
          if (el.id === PICK_BTN_ID) continue
          let rect = null
          try {
            rect = el.getBoundingClientRect()
          } catch (error) {
            continue
          }
          if (!rect || rect.height < 18 || rect.height > 56) continue
          if (rect.width < 100) continue
          if (rect.top - regionTop > 36) continue
          if (!el.querySelector('button')) continue
          return el
        }
        return null
      }

      function mountPickerButton() {
        const region = regionEl
        if (!region || !region.isConnected) return
        const header = findHeader(region)
        if (!header) return
        if (pickBtn && pickBtn.isConnected && pickBtn.parentNode === header) return
        if (pickBtn && pickBtn.parentNode) pickBtn.parentNode.removeChild(pickBtn)
        pickBtn = document.createElement('button')
        pickBtn.id = PICK_BTN_ID
        pickBtn.type = 'button'
        pickBtn.setAttribute('aria-haspopup', 'dialog')
        pickBtn.setAttribute('aria-expanded', 'false')
        const text = pickLang()
        pickBtn.setAttribute('aria-label', text.open)
        pickBtn.title = text.open
        pickBtn.innerHTML =
          '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<rect x="2.2" y="2.6" width="11.6" height="4.1" rx="1.2"/>' +
          '<rect x="2.2" y="9.3" width="11.6" height="4.1" rx="1.2"/>' +
          '<path d="M5 4.65h.01M5 11.35h.01"/>' +
          '</svg>'
        pickBtn.addEventListener('click', function (event) {
          event.preventDefault()
          event.stopPropagation()
          togglePicker()
        })
        header.appendChild(pickBtn)
      }

      function unmountPicker() {
        closePicker()
        PICK.listeners.delete(onDataChange)
        if (pickFrame) {
          window.cancelAnimationFrame(pickFrame)
          pickFrame = 0
        }
        if (pickObserver) {
          try {
            pickObserver.disconnect()
          } catch (error) {
            /* ignore */
          }
          pickObserver = null
        }
        if (pickBtn && pickBtn.parentNode) pickBtn.parentNode.removeChild(pickBtn)
        pickBtn = null
        const style = document.getElementById(PICK_STYLE_ID)
        if (style && style.parentNode) style.parentNode.removeChild(style)
      }

      function mountPicker() {
        if (!document.getElementById(PICK_STYLE_ID)) {
          const style = document.createElement('style')
          style.id = PICK_STYLE_ID
          style.textContent = PICK_CSS
          document.head.appendChild(style)
        }
        mountPickerButton()
        if (!pickObserver && document.body) {
          pickObserver = new MutationObserver(function () {
            if (pickFrame) return
            pickFrame = window.requestAnimationFrame(function () {
              pickFrame = 0
              if (!mounted) return
              // 这里只补挂按钮：绝不在 DOM 变动时重绘浮层，
              // 否则流式输出期间 pointerdown/pointerup 会落在不同节点上，点击永远不触发。
              mountPickerButton()
            })
          })
          pickObserver.observe(document.body, { childList: true, subtree: true })
        }
        PICK.listeners.add(onDataChange)
        // 首次渲染时工作区表头可能还没提交，补几次重试（都是幂等的）。
        ;[120, 400, 1200, 2600].forEach(function (delay) {
          window.setTimeout(function () {
            if (mounted) mountPickerButton()
          }, delay)
        })
      }

      function onDataChange() {
        if (!pickPop) return
        const listEl = pickPop.querySelector('.dsh-picker-list')
        const input = pickPop.querySelector('input')
        if (listEl) renderPickerList(listEl, input && input.value ? input.value.trim().toLowerCase() : '')
      }

      /* ---------- 插件 ---------- */

      return {
        inject: ['slots', 'locale'],
        apply(ctx) {
          api = ctx
          const slots = ctx.slots || (typeof ctx.get === 'function' ? ctx.get('slots') : null)
          const locale = ctx.locale || (typeof ctx.get === 'function' ? ctx.get('locale') : null)
          let offLocale = null

          // 只做"加载可见性"的探针：页脚注册一个不渲染任何内容的组件。
          // 这样即使自建 DOM 的行插不进去，也能从 Client Slots 里确认本 bundle 已加载。
          if (slots && typeof slots.inject === 'function' && typeof slots.register === 'function') {
            ctx.effect(
              function () {
                return slots.inject('sidebar.footer.action', function () {
                  return slots.register(
                    { name: 'sidebar.footer.action', id: 'sidebar-entries-toggle-probe', order: 6 },
                    function SidebarEntriesToggleProbe(props) {
                      // 这个组件不渲染任何东西，只借 slot 的 standardProps 钩子把
                      // 工作区/会话快照写进 PICK 存储，供自建 DOM 的选择器浮层读取。
                      try {
                        const React = require('react')
                        const useWorkspaces = props && props.useWorkspaces
                        const useSessions = props && props.useSessions
                        const workspaces =
                          typeof useWorkspaces === 'function'
                            ? useWorkspaces(PICK_SEL_WORKSPACES)
                            : null
                        const sessions =
                          typeof useSessions === 'function'
                            ? useSessions(PICK_SEL_SESSIONS)
                            : null
                        React.useEffect(
                          function () {
                            const nextWorkspaces = Array.isArray(workspaces) ? workspaces : []
                            const nextSessions = sessions || null
                            const signature = computeSignature(nextWorkspaces, nextSessions)
                            if (signature === pickSignatureCache) return
                            pickSignatureCache = signature
                            PICK.workspaces = nextWorkspaces
                            PICK.sessions = nextSessions
                            pickNotify()
                          },
                          [workspaces, sessions],
                        )
                      } catch (error) {
                        /* 快照拿不到就只是没有数据，不影响侧栏 */
                      }
                      return null
                    },
                  )
                })
              },
              'sidebar-entries-toggle: load probe',
            )
          }
          if (locale) {
            try {
              if (typeof locale.register === 'function') locale.register(NS, TEXT)
              if (typeof locale.bind === 'function') boundT = locale.bind(NS)
            } catch (error) {
              /* 文案拿不到就退回内置中文 */
            }
          }

          ctx.effect(function () {
            if (!document.getElementById(STYLE_ID)) {
              const style = document.createElement('style')
              style.id = STYLE_ID
              style.textContent = CSS
              document.head.appendChild(style)
            }
            mount()
            mountPicker()
            if (locale) {
              try {
                if (typeof locale.subscribe === 'function') {
                  offLocale = locale.subscribe(function () {
                    paintRow()
                  })
                }
              } catch (error) {
                /* 语言订阅失败不影响功能 */
              }
            }
            return function () {
              if (typeof offLocale === 'function') offLocale()
              offLocale = null
              unmountPicker()
              unmount()
              const style = document.getElementById(STYLE_ID)
              if (style && style.parentNode) style.parentNode.removeChild(style)
            }
          }, 'sidebar-entries-toggle')
        },
      }
    },
  })
})()
