window.__ModuleLoader__.load({
  id: '@dsh-local/projects-page',
  factory(require) {
    const React = require('react')
    const { createElement: h, useCallback, useEffect, useMemo, useRef, useState } = React

    /** Locale namespace for every string this page renders. */
    const NS = 'projects-view'
    /** Keyed main-panel id; the sidebar row selects the same id. */
    const PANEL_ID = 'projects-page'

    /** Plugin context captured at apply, for the two client services the page calls. */
    let pluginCtx = null
    /** Read routes registered by the Host half. */
    const API_LIST = '/api/projects-page/projects'
    const API_PROJECT = '/api/projects-page/project'
    const API_MARKS = '/api/projects-page/marks'

    /** Session id → project name, fetched once per client lifetime. */
    let marksCache = null
    let marksPromise = null

    const en = {
      panel: 'Projects',
      title: 'Projects',
      intro: '{count} projects · {open} open TODO items',
      search: 'Filter projects',
      searchPlaceholder: 'Filter by name or folder',
      refresh: 'Refresh',
      refreshHint: 'Re-read TODO.md and sessions.jsonl',
      updated: 'Read {time}',
      openShort: 'open',
      noSessions: 'No sessions',
      untitled: 'Untitled session',
      loaded: 'Loaded {count} projects',
      loadingList: 'Reading project files…',
      loadingDetail: 'Reading this project…',
      errorList: 'Could not read the projects: {reason}',
      errorDetail: 'Could not read this project: {reason}',
      retry: 'Try again',
      back: 'All projects',
      folders: 'Folders',
      foldersMeta: '{count} top-level folders',
      noFolders: 'This project has no subfolders.',
      todo: 'TODO.md',
      todoMeta: '{open} open · {done} done',
      noTodo: 'TODO.md was not found in this folder.',
      todoTruncated: 'Only the first part of TODO.md is shown.',
      sessions: 'Newest sessions',
      sessionsMeta: '{count} recorded for this folder',
      sessionsShown: 'Newest {count} shown.',
      newSession: 'New session',
      sessionOpenFailed: 'Could not start the session: {reason}',
      projectLabel: 'Project',
      noSessionsHere: 'No sessions recorded for this folder.',
      sessionsUnavailable: 'The session index could not be read: {reason}',
      openItem: 'Open item:',
      doneItem: 'Done item:',
      events: '{count} events',
      detailReady: '{name} opened',
      filterEmpty: 'No project matches “{query}”.',
      note: 'TODO.md and {path} are read when this page opens; nothing is written back.',
      hiddenFolder: 'Hidden folder',
      emptyItem: '(no text)',
      sortLabel: 'Sort by',
      sortRecent: 'Recent',
      sortModified: 'Modified',
      sortOpen: 'Open items',
      sortName: 'Name',
      sortSessions: 'Sessions',
    }

    const zh = {
      panel: '项目',
      title: '项目',
      intro: '{count} 个项目 · {open} 个未完成 TODO',
      search: '筛选项目',
      searchPlaceholder: '按名称或目录筛选',
      refresh: '刷新',
      refreshHint: '重新读取 TODO.md 和 sessions.jsonl',
      updated: '读取于 {time}',
      openShort: '未完成',
      noSessions: '暂无会话',
      untitled: '未命名会话',
      loaded: '已加载 {count} 个项目',
      loadingList: '正在读取项目文件…',
      loadingDetail: '正在读取该项目…',
      errorList: '无法读取项目：{reason}',
      errorDetail: '无法读取该项目：{reason}',
      retry: '重试',
      back: '全部项目',
      folders: '文件夹',
      foldersMeta: '{count} 个顶层文件夹',
      noFolders: '该项目没有子文件夹。',
      todo: 'TODO.md',
      todoMeta: '{open} 未完成 · {done} 已完成',
      noTodo: '该文件夹中未找到 TODO.md。',
      todoTruncated: '仅显示 TODO.md 的前一部分。',
      sessions: '最新会话',
      sessionsMeta: '该文件夹记录了 {count} 个会话',
      sessionsShown: '仅显示最新 {count} 个。',
      newSession: '新会话',
      sessionOpenFailed: '无法创建会话：{reason}',
      projectLabel: '项目',
      noSessionsHere: '此文件夹暂无会话记录。',
      sessionsUnavailable: '无法读取会话索引：{reason}',
      openItem: '未完成：',
      doneItem: '已完成：',
      events: '{count} 个事件',
      detailReady: '已打开 {name}',
      filterEmpty: '没有项目匹配“{query}”。',
      note: '打开此页面时读取 TODO.md 和 {path}；不会写回任何内容。',
      hiddenFolder: '隐藏文件夹',
      emptyItem: '（无文本）',
      sortLabel: '排序',
      sortRecent: '最近',
      sortModified: '修改时间',
      sortOpen: '未完成',
      sortName: '名称',
      sortSessions: '会话',
    }

    const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

    /**
     * Format a session timestamp for display; unparsable input is shown verbatim.
     * @param iso - ISO timestamp from the session index.
     */
    function formatWhen(iso) {
      const value = new Date(iso)
      if (Number.isNaN(value.getTime())) return iso
      return dateFormat.format(value) + ' · ' + timeFormat.format(value)
    }

    /**
     * GET one JSON payload with the page's own cookie.
     * @param url - read route.
     * @param signal - abort signal for the owning effect.
     */
    async function readJson(url, signal) {
      const response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        signal,
      })
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok) {
        const reason = body !== null && typeof body.error === 'string' ? body.error : 'HTTP ' + String(response.status)
        throw new Error(reason)
      }
      if (body === null || typeof body !== 'object') throw new Error('empty response')
      return body
    }

    /** Sidebar glyph: a four-tile project grid. */
    function ProjectsIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 16
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block' },
        },
        h('rect', { x: 2, y: 2, width: 5, height: 5, rx: 1.4, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('rect', { x: 9, y: 2, width: 5, height: 5, rx: 1.4, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('rect', { x: 2, y: 9, width: 5, height: 5, rx: 1.4, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('rect', { x: 9, y: 9, width: 5, height: 5, rx: 1.4, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', opacity: 0.35 }),
      )
    }

    const STYLES = [
      '.prjp-root{--prjp-inset:clamp(20px,4vw,48px);box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:14px;container-type:inline-size}',
      '.prjp-head{flex:none;padding:28px var(--prjp-inset) 0}',
      '[data-platform=darwin] .prjp-head{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}',
      '.prjp-headInner,.prjp-bodyInner{width:100%;max-width:960px;margin:0 auto}',
      '.prjp-headTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}',
      '.prjp-heading{min-width:0}',
      '.prjp-title{margin:0;font-size:20px;font-weight:500;line-height:28px;overflow-wrap:anywhere}',
      '.prjp-titleDetail{margin-top:8px}',
      '.prjp-intro{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}',
      '.prjp-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 0 12px}',
      '.prjp-search{flex:1 1 220px;min-width:0}',
      '.prjp-search input{width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}',
      '.prjp-search input::placeholder{color:var(--dsw-alias-label-tertiary)}',
      '.prjp-search input:focus{border-color:var(--dsw-alias-state-business-primary);box-shadow:inset 0 0 0 .5px var(--dsw-alias-state-business-primary)}',
      '.prjp-button{height:32px;padding:0 12px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l3);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;white-space:nowrap}',
      '.prjp-button:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.prjp-button:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}',
      '.prjp-sort{display:flex;flex-wrap:wrap;gap:6px;min-width:0}',
      '.prjp-sortBtn{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l3);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}',
      '.prjp-sortBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.prjp-sortBtn[aria-pressed=true]{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.prjp-sortBtn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}',
      '.prjp-sortArrow{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1}',
      '.prjp-body{flex:1;min-height:0;overflow:auto;padding:0 var(--prjp-inset) 48px}',
      '.prjp-status{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px;margin:10px 0}',
      '.prjp-detailWait{padding-top:20px}',
      '.prjp-error{color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:20px;margin:10px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap}',
      '.prjp-rows{list-style:none;margin:0;padding:0;border-top:.5px solid var(--dsw-alias-border-l2)}',
      '.prjp-row{width:100%;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) 96px minmax(0,1.05fr);gap:16px;align-items:center;padding:11px 6px;border:0;border-bottom:.5px solid var(--dsw-alias-border-l2);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:6px}',
      '.prjp-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.prjp-row:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}',
      '.prjp-main{min-width:0}',
      '.prjp-name{display:block;font-size:14px;font-weight:500;line-height:20px;overflow-wrap:anywhere}',
      '.prjp-path{display:block;margin-top:2px;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.prjp-count{display:inline-flex;align-items:baseline;gap:4px;font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.prjp-countNum{font-size:15px;font-weight:500;color:var(--dsw-alias-label-primary)}',
      '.prjp-count[data-zero=true],.prjp-count[data-zero=true] .prjp-countNum{color:var(--dsw-alias-label-tertiary)}',
      '.prjp-session{min-width:0;display:flex;flex-direction:column;gap:1px}',
      '.prjp-sessionTitle{font-size:13px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.prjp-sessionMeta{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}',
      '.prjp-none{font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
      '.prjp-crumb{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12.5px;line-height:18px;cursor:pointer}',
      '.prjp-crumb:hover{color:var(--dsw-alias-label-primary)}',
      '.prjp-crumb:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
      '.prjp-crumbArrow{font-size:13px;line-height:1}',
      '.prjp-detailPath{margin:4px 0 0;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}',
      '.prjp-facts{display:flex;flex-wrap:wrap;gap:6px 18px;margin:12px 0 0;padding:0;list-style:none;font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.prjp-facts b{font-weight:500;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.prjp-section{margin:28px 0 0}',
      '.prjp-sectionHead{display:flex;align-items:baseline;gap:10px;margin:0 0 8px;flex-wrap:wrap}',
      '.prjp-sectionTitle{margin:0;font-size:14px;font-weight:500;line-height:20px}',
      '.prjp-sectionMeta{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}',
      '.prjp-chips{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0}',
      '.prjp-chip{border:.5px solid var(--dsw-alias-border-l3);border-radius:6px;padding:1px 8px;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}',
      '.prjp-chip[data-hidden=true]{color:var(--dsw-alias-label-tertiary);border-style:dashed}',
      '.prjp-todoBox{max-height:420px;overflow:auto;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px 14px}',
      '.prjp-todo{list-style:none;margin:0;padding:0}',
      '.prjp-todoItem{display:flex;gap:8px;align-items:flex-start;padding:2px 0;font-size:13px;line-height:20px}',
      '.prjp-glyph{flex:none;width:16px;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);color:var(--dsw-alias-label-tertiary)}',
      '.prjp-todoItem[data-done=true] .prjp-todoText{color:var(--dsw-alias-label-tertiary);text-decoration:line-through}',
      '.prjp-todoText{overflow-wrap:anywhere;min-width:0}',
      '.prjp-todoHeading{margin:12px 0 4px;font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}',
      '.prjp-todoHeading[data-level="1"]{font-size:14px}',
      '.prjp-todoHeading:first-child{margin-top:0}',
      '.prjp-todoLine{margin:2px 0;font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere}',
      '.prjp-todoGap{height:6px}',
      '.prjp-sessions{list-style:none;margin:0;padding:0;border-top:.5px solid var(--dsw-alias-border-l2)}',
      '.prjp-sessionRow{border-bottom:.5px solid var(--dsw-alias-border-l2);padding:10px 2px}',
      '.prjp-sessionBtn{display:block;width:100%;box-sizing:border-box;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:2px 4px;margin:0 -4px;border-radius:6px;cursor:pointer}',
      '.prjp-sessionBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.prjp-sessionBtn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:0}',
      '.prjp-sessionRowTitle{display:block;font-size:13px;line-height:20px;overflow-wrap:anywhere}',
      '.prjp-sessionRowMeta{display:flex;flex-wrap:wrap;gap:2px 12px;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:11.5px;line-height:16px;font-variant-numeric:tabular-nums}',
      '.prjp-note{margin:24px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}',
      '.prjp-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}',
      '@media (max-width:820px){.prjp-row{grid-template-columns:minmax(0,1fr) auto;row-gap:4px}.prjp-session,.prjp-none{grid-column:1 / -1}}',
      '@container (max-width:680px){.prjp-row{grid-template-columns:minmax(0,1fr) auto;row-gap:4px}.prjp-session,.prjp-none{grid-column:1 / -1}}',
    ].join('')

    /**
     * One TODO.md line. Checkbox rows carry their own screen-reader label.
     * @param props - item plus translated labels.
     */
    function TodoLine(props) {
      const item = props.item
      if (item.kind === 'blank') return h('li', { className: 'prjp-todoGap', 'aria-hidden': 'true' })
      if (item.kind === 'heading') {
        const level = item.level >= 4 ? '2' : '1'
        return h('li', null, h('h3', { className: 'prjp-todoHeading', 'data-level': level }, item.text))
      }
      if (item.kind === 'open' || item.kind === 'done') {
        const done = item.kind === 'done'
        return h(
          'li',
          { className: 'prjp-todoItem', 'data-done': done ? 'true' : 'false' },
          h('span', { className: 'prjp-glyph', 'aria-hidden': 'true' }, done ? '[x]' : '[ ]'),
          h('span', { className: 'prjp-sr' }, props.labels[done ? 'doneItem' : 'openItem']),
          h('span', { className: 'prjp-todoText' }, item.text === '' ? props.labels.emptyItem : item.text),
        )
      }
      return h('li', null, h('p', { className: 'prjp-todoLine' }, item.text))
    }

    /**
     * One session row: title plus timestamp, source, and event count.
     * @param props - session plus translated labels.
     */
    function SessionRow(props) {
      const session = props.session
      const title = session.title.trim() === '' ? props.labels.untitled : session.title
      const meta = [formatWhen(session.started)]
      if (session.source !== null) meta.push(session.source)
      if (session.events !== null) meta.push(props.labels.events.replace('{count}', String(session.events)))
      const content = [
        h('span', { key: 'title', className: 'prjp-sessionRowTitle' }, title),
        h(
          'span',
          { key: 'meta', className: 'prjp-sessionRowMeta' },
          meta.map((part, index) => h('span', { key: index }, part)),
        ),
      ]
      return h(
        'li',
        { className: 'prjp-sessionRow' },
        typeof props.onOpen === 'function'
          ? h('button', { type: 'button', className: 'prjp-sessionBtn', onClick: () => props.onOpen(session.id) }, content)
          : content,
      )
    }

    const SORT_KEYS = ['recent', 'modified', 'open', 'name', 'sessions']

    /**
     * Value one project is ordered by.
     * @param project - list row.
     * @param key - sort key.
     */
    function sortValue(project, key) {
      if (key === 'recent') return project.latest?.started ?? ''
      if (key === 'modified') return project.modifiedAt ?? ''
      if (key === 'open') return project.openCount
      if (key === 'sessions') return project.sessionCount
      return project.name.toLowerCase()
    }

    /**
     * Ready-state list of all projects.
     * @param props - payload, filter state, and callbacks.
     */
    function ProjectListBody(props) {
      const t = props.t
      const data = props.data
      const needle = props.query.trim().toLowerCase()
      const filtered =
        needle === ''
          ? data.projects
          : data.projects.filter(
              (project) => project.name.toLowerCase().includes(needle) || project.path.toLowerCase().includes(needle),
            )
      const [sortKey, setSortKey] = useState('recent')
      const [descending, setDescending] = useState(true)
      const sorted = filtered.slice().sort((left, right) => {
        const a = sortValue(left, sortKey)
        const b = sortValue(right, sortKey)
        const order =
          typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b), 'en-US')
        return descending ? -order : order
      })
      const chooseSort = (key) => {
        if (key === sortKey) {
          setDescending((value) => !value)
          return
        }
        setSortKey(key)
        setDescending(key !== 'name')
      }
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'prjp-toolbar' },
          h(
            'div',
            { className: 'prjp-search' },
            h('input', {
              type: 'search',
              value: props.query,
              placeholder: t('searchPlaceholder'),
              'aria-label': t('search'),
              onChange: (event) => props.onQuery(event.target.value),
            }),
          ),
          h(
            'div',
            { className: 'prjp-sort', role: 'group', 'aria-label': t('sortLabel') },
            SORT_KEYS.map((key) =>
              h(
                'button',
                {
                  key,
                  type: 'button',
                  className: 'prjp-sortBtn',
                  'aria-pressed': sortKey === key,
                  onClick: () => chooseSort(key),
                },
                t('sort' + key.charAt(0).toUpperCase() + key.slice(1)),
                sortKey === key ? h('span', { className: 'prjp-sortArrow', 'aria-hidden': 'true' }, descending ? '↓' : '↑') : null,
              ),
            ),
          ),
          h('span', { className: 'prjp-none' }, t('updated', { time: formatWhen(data.generatedAt) })),
        ),
        filtered.length === 0
          ? h('p', { className: 'prjp-status' }, t('filterEmpty', { query: props.query }))
          : h(
              'ul',
              { className: 'prjp-rows' },
              sorted.map((project) =>
                h(
                  'li',
                  { key: project.id },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'prjp-row',
                      onClick: () => props.onOpen(project.id),
                      ref: (element) => props.registerRow(project.id, element),
                    },
                    h(
                      'span',
                      { className: 'prjp-main' },
                      h('span', { className: 'prjp-name' }, project.name),
                      h('span', { className: 'prjp-path' }, project.path),
                    ),
                    h(
                      'span',
                      { className: 'prjp-count', 'data-zero': project.openCount === 0 ? 'true' : 'false' },
                      h('span', { className: 'prjp-countNum' }, String(project.openCount)),
                      t('openShort'),
                    ),
                    project.latest === null
                      ? h('span', { className: 'prjp-none' }, t('noSessions'))
                      : h(
                          'span',
                          { className: 'prjp-session' },
                          h(
                            'span',
                            { className: 'prjp-sessionTitle' },
                            project.latest.title.trim() === '' ? t('untitled') : project.latest.title,
                          ),
                          h('span', { className: 'prjp-sessionMeta' }, formatWhen(project.latest.started)),
                        ),
                  ),
                ),
              ),
            ),
        h('p', { className: 'prjp-note' }, t('note', { path: data.sessionsPath })),
      )
    }

    /**
     * Ready-state view of one opened project.
     * @param props - detail payload.
     */
    function ProjectDetailBody(props) {
      const t = props.t
      const data = props.data
      const todo = data.todo
      const [startError, setStartError] = useState(null)
      const startSession = async () => {
        try {
          setStartError(null)
          // A Session has to belong to a Workspace; create() is idempotent, so this
          // registers the project folder on first use and reuses it afterwards.
          const view = await pluginCtx.workspaces.create({ path: data.project.path })
          // Leave the Projects panel first, so the Conversation is what the main area shows.
          pluginCtx.layout.selectPanel(null)
          // startSession opens the blank connectWorkspace resolves; connectWorkspace alone only resolves it.
          pluginCtx.uiWorkspace.startSession(view.workspaceId)
        } catch (error) {
          setStartError(error instanceof Error ? error.message : String(error))
        }
      }
      const openSession = (id) => {
        try {
          pluginCtx.uiWorkspace.openSession(id)
        } catch {
          /* navigation refused: leave the page where it is */
        }
      }
      return h(
        'div',
        null,
        h(
          'section',
          { className: 'prjp-section' },
          h(
            'div',
            { className: 'prjp-sectionHead' },
            h('h2', { className: 'prjp-sectionTitle' }, t('folders')),
            h('span', { className: 'prjp-sectionMeta' }, t('foldersMeta', { count: String(data.folders.total) })),
          ),
          data.folders.names.length === 0
            ? h('p', { className: 'prjp-status' }, data.folders.error === null ? t('noFolders') : data.folders.error)
            : h(
                'ul',
                { className: 'prjp-chips' },
                data.folders.names.map((name) =>
                  h(
                    'li',
                    {
                      key: name,
                      className: 'prjp-chip',
                      'data-hidden': name.startsWith('.') ? 'true' : 'false',
                      title: name.startsWith('.') ? t('hiddenFolder') : undefined,
                    },
                    name,
                  ),
                ),
              ),
        ),
        h(
          'section',
          { className: 'prjp-section' },
          h(
            'div',
            { className: 'prjp-sectionHead' },
            h('h2', { className: 'prjp-sectionTitle' }, t('todo')),
            todo.exists
              ? h('span', { className: 'prjp-sectionMeta' }, t('todoMeta', { open: String(todo.open), done: String(todo.done) }))
              : null,
          ),
          todo.exists
            ? h(
                'div',
                { className: 'prjp-todoBox' },
                h(
                  'ul',
                  { className: 'prjp-todo' },
                  todo.items.map((item, index) =>
                    h(TodoLine, {
                      key: index,
                      item,
                      labels: { doneItem: t('doneItem'), openItem: t('openItem'), emptyItem: t('emptyItem') },
                    }),
                  ),
                ),
              )
            : h('p', { className: 'prjp-status' }, t('noTodo')),
          todo.truncated ? h('p', { className: 'prjp-status' }, t('todoTruncated')) : null,
          todo.error !== null ? h('p', { className: 'prjp-error' }, todo.error) : null,
        ),
        h(
          'section',
          { className: 'prjp-section' },
          h(
            'div',
            { className: 'prjp-sectionHead' },
            h('h2', { className: 'prjp-sectionTitle' }, t('sessions')),
            h('span', { className: 'prjp-sectionMeta' }, t('sessionsMeta', { count: String(data.sessionTotal) })),
            h('button', { type: 'button', className: 'prjp-button', onClick: startSession }, t('newSession')),
          ),
          startError === null ? null : h('p', { className: 'prjp-error' }, t('sessionOpenFailed', { reason: startError })),
          data.sessions.exists === false
            ? h('p', { className: 'prjp-error' }, t('sessionsUnavailable', { reason: data.sessions.error }))
            : data.sessions.length === 0
              ? h('p', { className: 'prjp-status' }, t('noSessionsHere'))
              : h(
                  'div',
                  null,
                  h(
                    'ul',
                    { className: 'prjp-sessions' },
                    data.sessions.map((session) =>
                      h(SessionRow, {
                        key: session.id + ':' + session.started,
                        session,
                        onOpen: openSession,
                        labels: { untitled: t('untitled'), events: t('events') },
                      }),
                    ),
                  ),
                  data.sessionTotal > data.sessions.length
                    ? h('p', { className: 'prjp-status' }, t('sessionsShown', { count: String(data.sessions.length) }))
                    : null,
                ),
        ),
        h('p', { className: 'prjp-note' }, t('note', { path: data.sessionsPath })),
      )
    }

    /**
     * The page: list or one opened project, with Host reads on mount and on open.
     * @param props - slot props; `t` comes from the registration's locale seat.
     */
    function ProjectsPage(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key

      const [listState, setListState] = useState({ status: 'loading', data: null, error: null })
      const [detailState, setDetailState] = useState({ status: 'idle', data: null, error: null })
      const [selectedId, setSelectedId] = useState(null)
      const [query, setQuery] = useState('')
      const [listToken, setListToken] = useState(0)
      const [detailToken, setDetailToken] = useState(0)

      const rowRefs = useRef({})
      const backRef = useRef(null)
      const returnTo = useRef(null)

      useEffect(() => {
        const controller = new AbortController()
        setListState((previous) => ({ status: 'loading', data: previous.data, error: null }))
        readJson(API_LIST, controller.signal)
          .then((data) => setListState({ status: 'ready', data, error: null }))
          .catch((error) => {
            if (controller.signal.aborted) return
            setListState({ status: 'error', data: null, error: error.message || String(error) })
          })
        return () => controller.abort()
      }, [listToken])

      useEffect(() => {
        if (selectedId === null) {
          setDetailState({ status: 'idle', data: null, error: null })
          return undefined
        }
        const controller = new AbortController()
        setDetailState({ status: 'loading', data: null, error: null })
        readJson(API_PROJECT + '?id=' + encodeURIComponent(selectedId), controller.signal)
          .then((data) => setDetailState({ status: 'ready', data, error: null }))
          .catch((error) => {
            if (controller.signal.aborted) return
            setDetailState({ status: 'error', data: null, error: error.message || String(error) })
          })
        return () => controller.abort()
      }, [selectedId, detailToken])

      useEffect(() => {
        if (selectedId !== null) {
          backRef.current?.focus()
          return
        }
        const id = returnTo.current
        if (id === null) return
        returnTo.current = null
        rowRefs.current[id]?.focus()
      }, [selectedId])

      const projects = listState.data?.projects ?? []
      const openTotal = useMemo(
        () => projects.reduce((total, project) => total + (project.openCount ?? 0), 0),
        [projects],
      )

      const announcement = useMemo(() => {
        if (selectedId !== null) {
          if (detailState.status === 'loading') return t('loadingDetail')
          if (detailState.status === 'error') return t('errorDetail', { reason: detailState.error })
          if (detailState.status === 'ready') return t('detailReady', { name: detailState.data.project.name })
          return ''
        }
        if (listState.status === 'loading') return t('loadingList')
        if (listState.status === 'error') return t('errorList', { reason: listState.error })
        if (listState.status === 'ready') return t('loaded', { count: String(listState.data.projects.length) })
        return ''
      }, [selectedId, detailState, listState, t])

      const openProject = useCallback((id) => {
        returnTo.current = id
        setSelectedId(id)
      }, [])

      const backToList = useCallback(() => {
        setSelectedId(null)
        setDetailState({ status: 'idle', data: null, error: null })
      }, [])

      const registerRow = useCallback((id, element) => {
        if (element === null) delete rowRefs.current[id]
        else rowRefs.current[id] = element
      }, [])

      const onKeyDown = (event) => {
        if (event.key === 'Escape' && selectedId !== null) {
          event.preventDefault()
          backToList()
        }
      }

      const selectedSummary =
        selectedId === null
          ? null
          : (detailState.data?.project ?? projects.find((project) => project.id === selectedId) ?? null)

      let header
      if (selectedId === null) {
        header = h(
          'div',
          { className: 'prjp-headTop' },
          h(
            'div',
            { className: 'prjp-heading' },
            h('h1', { className: 'prjp-title' }, t('title')),
            h('p', { className: 'prjp-intro' }, t('intro', { count: String(projects.length), open: String(openTotal) })),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'prjp-button',
              onClick: () => setListToken((value) => value + 1),
              title: t('refreshHint'),
            },
            t('refresh'),
          ),
        )
      } else {
        header = h(
          'div',
          { className: 'prjp-heading' },
          h(
            'button',
            { type: 'button', className: 'prjp-crumb', onClick: backToList, ref: backRef },
            h('span', { className: 'prjp-crumbArrow', 'aria-hidden': 'true' }, '←'),
            t('back'),
          ),
          h('h1', { className: 'prjp-title prjp-titleDetail' }, selectedSummary?.name ?? t('title')),
          selectedSummary === null ? null : h('p', { className: 'prjp-detailPath' }, selectedSummary.path),
          selectedSummary === null
            ? null
            : h(
                'ul',
                { className: 'prjp-facts' },
                h('li', null, h('b', null, String(selectedSummary.openCount)), ' ' + t('openShort')),
                detailState.data === null
                  ? null
                  : h('li', null, h('b', null, String(detailState.data.folders.total)), ' ' + t('folders').toLowerCase()),
                detailState.data === null
                  ? null
                  : h('li', null, h('b', null, String(detailState.data.sessionTotal)), ' ' + t('sessions').toLowerCase()),
              ),
        )
      }

      let body
      if (selectedId === null) {
        if (listState.status === 'error') {
          body = h(
            'div',
            { className: 'prjp-detailWait' },
            h('p', { className: 'prjp-error' }, t('errorList', { reason: listState.error })),
            h(
              'button',
              { type: 'button', className: 'prjp-button', onClick: () => setListToken((value) => value + 1) },
              t('retry'),
            ),
          )
        } else if (listState.data === null) {
          body = h('p', { className: 'prjp-status prjp-detailWait' }, t('loadingList'))
        } else {
          body = h(ProjectListBody, {
            t,
            data: listState.data,
            query,
            onQuery: setQuery,
            onOpen: openProject,
            registerRow,
          })
        }
      } else if (detailState.status === 'error') {
        body = h(
          'div',
          { className: 'prjp-detailWait' },
          h('p', { className: 'prjp-error' }, t('errorDetail', { reason: detailState.error })),
          h(
            'button',
            { type: 'button', className: 'prjp-button', onClick: () => setDetailToken((value) => value + 1) },
            t('retry'),
          ),
        )
      } else if (detailState.data === null) {
        body = h('p', { className: 'prjp-status prjp-detailWait' }, t('loadingDetail'))
      } else {
        body = h(ProjectDetailBody, { t, data: detailState.data })
      }

      return h(
        'div',
        { className: 'prjp-root', onKeyDown },
        h('style', null, STYLES),
        h('div', { className: 'prjp-head' }, h('div', { className: 'prjp-headInner' }, header)),
        h('div', { className: 'prjp-body' }, h('div', { className: 'prjp-bodyInner' }, body)),
        h('p', { className: 'prjp-sr', role: 'status', 'aria-live': 'polite' }, announcement),
      )
    }

    /**
     * Session id → project name, shared by every hover card.
     */
    function useMarks() {
      const [marks, setMarks] = useState(marksCache ?? {})
      useEffect(() => {
        if (marksCache !== null) return undefined
        marksPromise ??= fetch(API_MARKS, { headers: { accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : { marks: {} }))
          .then((payload) => {
            marksCache = payload.marks ?? {}
            return marksCache
          })
          .catch(() => {
            marksCache = {}
            return marksCache
          })
        let live = true
        marksPromise.then((value) => {
          if (live) setMarks(value)
        })
        return () => {
          live = false
        }
      }, [])
      return marks
    }

    /**
     * One line in a Session row's hover card naming its project.
     * @param props - owner props plus the seat's `t`.
     */
    function ProjectHover(props) {
      const marks = useMarks()
      const name = marks[props.sessionId]
      if (typeof name !== 'string') return null
      const text = typeof props.t === 'function' ? props.t('projectLabel') : 'Project'
      return React.createElement(
        'div',
        {
          style: {
            margin: '2px 0',
            fontSize: '11.5px',
            lineHeight: '16px',
            color: 'var(--dsw-alias-label-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        },
        text + ' · ' + name,
      )
    }

    /**
     * Register the sidebar launcher and the main page, and leave the panel on unload.
     * @param ctx - client plugin context.
     */
    function apply(ctx) {
      pluginCtx = ctx
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'projects-view: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            locale: NS,
            label: () => t('panel'),
          },
          ProjectsIcon,
        ),
      )

      ctx.slots.inject('sidebar.session.row.hover', () =>
        ctx.slots.register(
          {
            name: 'sidebar.session.row.hover',
            id: 'projects-view-mark',
            order: 30,
            locale: NS,
          },
          ProjectHover,
        ),
      )

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
          },
          ProjectsPage,
        ),
      )

      ctx.effect(
        () => () => {
          try {
            if (ctx.layout.panelInfo.getSnapshot().activePanelId === PANEL_ID) ctx.layout.selectPanel(null)
          } catch {
            // The layout owner may already be gone during a full client teardown.
          }
        },
        'projects-view: leave panel on unload',
      )
    }

    return { inject: ['slots', 'locale', 'layout', 'uiWorkspace', 'workspaces'], apply }
  },
})
