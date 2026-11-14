/**
 * Client half of the Toolbox panel.
 *
 * One keyed main panel plus one sidebar row, with three tabs:
 *   Skills     — the skill catalogue with curator load counts and a disable switch
 *   Providers  — per provider/model activity read from session logs
 *   Board      — a kanban board persisted on the Host
 *
 * Everything is fetched from /api/toolbox/*, which the Host half registers.
 */
window.__ModuleLoader__.load({
  id: '@dsh-local/toolbox',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'toolbox'
    const PANEL = 'toolbox'
    const CSS_TAG = '@dsh-local/toolbox/panel.css'

    const css = `
.tbx-page{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:13px}
.tbx-head{display:flex;align-items:center;gap:10px;padding:10px 14px 0;flex-shrink:0}
.tbx-title{font-size:14px;font-weight:500}
.tbx-tabs{display:flex;gap:2px;padding:8px 14px 0;border-bottom:1px solid var(--dsw-alias-border-l1);flex-shrink:0}
.tbx-tab{border:none;background:0 0;color:var(--dsw-alias-label-tertiary);padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.tbx-tab:hover{color:var(--dsw-alias-label-primary)}
.tbx-tab[aria-selected="true"]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-state-business-primary)}
.tbx-tab:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.tbx-body{flex:1;min-height:0;overflow:auto;padding:10px 14px 16px}
.tbx-toolbar{display:flex;align-items:center;gap:8px;padding:8px 0 6px;flex-wrap:wrap}
.tbx-search{flex:1;min-width:160px;max-width:360px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:inherit;padding:5px 8px;font-size:12px;outline:none}
.tbx-search:focus{border-color:var(--dsw-alias-state-business-primary)}
.tbx-muted{color:var(--dsw-alias-label-tertiary);font-size:11px}
.tbx-btn{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;padding:3px 8px;cursor:pointer}
.tbx-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.tbx-btn:disabled{opacity:.5;cursor:default}
.tbx-list{display:flex;flex-direction:column;gap:2px}
.tbx-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--dsw-radius-md)}
.tbx-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.tbx-rowOff{opacity:.55}
.tbx-name{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 0 200px}
.tbx-copy{display:flex;flex-direction:column;min-width:0;flex:1;gap:1px}
.tbx-copy .tbx-name{flex:0 0 auto;max-width:100%}
.tbx-desc{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-tertiary);font-size:11px}
.tbx-load{flex:none;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary);font-size:11px;min-width:44px;text-align:right}
.tbx-switch{flex:none;width:30px;height:18px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);cursor:pointer;padding:0;position:relative}
.tbx-switchOn{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.tbx-knob{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:transform .12s}
.tbx-switchOn .tbx-knob{transform:translateX(12px)}
.tbx-switch:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.tbx-table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
.tbx-table th{text-align:left;font-weight:500;color:var(--dsw-alias-label-tertiary);font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}
.tbx-table td{padding:5px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}
.tbx-table td.num{text-align:right}
.tbx-prov{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary)}
.tbx-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:start}
@media (max-width:640px){.tbx-board{grid-template-columns:minmax(0,1fr)}}
.tbx-col{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);padding:8px;min-height:120px;display:flex;flex-direction:column;gap:6px}
.tbx-colHead{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);display:flex;justify-content:space-between}
.tbx-card{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);padding:6px 8px;font-size:12px;display:flex;gap:6px;align-items:flex-start;cursor:grab}
.tbx-cardText{flex:1;min-width:0;white-space:pre-wrap;word-break:break-word}
.tbx-cardX{border:none;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;padding:0 2px;font-size:12px;line-height:1}
.tbx-cardX:hover{color:var(--dsw-alias-state-error-primary)}
.tbx-add{display:flex;gap:4px}
.tbx-add input{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:0 0;color:inherit;font-size:12px;padding:4px 6px;outline:none}
.tbx-colOver{outline:2px dashed var(--dsw-alias-state-business-primary);outline-offset:-2px}
.tbx-empty{padding:14px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.tbx-note{color:var(--dsw-alias-label-tertiary);font-size:11px;margin:4px 0 8px}
.tbx-error{color:var(--dsw-alias-state-error-primary);font-size:12px;padding:6px 0}
.tbx-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-caption);margin-right:6px;vertical-align:middle}
.tbx-dotOn{background:var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary))}
.tbx-sort{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;padding:3px 6px}
.tbx-check{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.tbx-copies{flex:none;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 5px;font-size:10px;line-height:15px;color:var(--dsw-alias-label-secondary)}
.tbx-drop{height:2px;margin:2px 0;border-radius:2px;background:var(--dsw-alias-state-business-primary)}
.tbx-editCard{border:1px solid var(--dsw-alias-state-business-primary);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2);padding:5px 7px;font-size:12px;width:100%;box-sizing:border-box;color:inherit;font-family:inherit;resize:vertical;min-height:34px;outline:none}
.tbx-badge{display:inline-block;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 6px;font-size:10px;color:var(--dsw-alias-label-tertiary);line-height:16px}
`
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']') === null) {
      const tag = document.createElement('style')
      tag.dataset.plugin = '@dsh-local/toolbox'
      tag.dataset.pluginCss = CSS_TAG
      tag.textContent = css
      document.head.appendChild(tag)
    }

    async function fetchJson(url, init) {
      const response = await fetch(url, init)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      return body
    }

    /** Small formatting helpers shared by the tables. */
    const n = (value) => (value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(1)}k` : String(value ?? 0))
    const ago = (ms) => {
      if (!ms) return '—'
      const diff = Date.now() - ms
      if (diff < 60_000) return 'now'
      if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`
      if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`
      return `${Math.round(diff / 86_400_000)}d`
    }

    function Switch({ checked, label, onChange }) {
      return h(
        'button',
        {
          type: 'button',
          className: 'tbx-switch' + (checked ? ' tbx-switchOn' : ''),
          role: 'switch',
          'aria-checked': checked,
          'aria-label': label,
          onClick: onChange,
        },
        h('span', { className: 'tbx-knob' }),
      )
    }

    function SkillsTab({ t }) {
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [query, setQuery] = useState('')
      const [sort, setSort] = useState('loads')
      const [neverFired, setNeverFired] = useState(false)
      const [busy, setBusy] = useState(null)
      const load = useCallback(() => {
        fetchJson('/api/toolbox/skills').then(setData).catch((e) => setError(e.message))
      }, [])
      useEffect(load, [load])

      const rows = useMemo(() => {
        const all = data?.skills || []
        const q = query.trim().toLowerCase()
        const filtered = all.filter((row) => {
          if (neverFired && (row.loads > 0 || !row.enabled)) return false
          return q === '' || `${row.name} ${row.description}`.toLowerCase().includes(q)
        })
        const sorted = filtered.slice()
        if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
        else if (sort === 'recent') sorted.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
        else sorted.sort((a, b) => b.loads - a.loads || a.name.localeCompare(b.name))
        return sorted
      }, [data, query, sort, neverFired])

      const toggle = async (row) => {
        setBusy(row.dir)
        setError(null)
        try {
          await fetchJson('/api/toolbox/skills/toggle', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ dir: row.dir, enable: !row.enabled }),
          })
          load()
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(null)
        }
      }

      if (data === null && error === null) return h('div', { className: 'tbx-empty' }, t('loading'))
      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'tbx-toolbar' },
          h('input', {
            className: 'tbx-search',
            placeholder: t('skills.search'),
            value: query,
            onChange: (e) => setQuery(e.target.value),
            'aria-label': t('skills.search'),
          }),
          h('select', {
            className: 'tbx-sort',
            value: sort,
            'aria-label': t('skills.sort'),
            onChange: (e) => setSort(e.target.value),
          },
            h('option', { value: 'loads' }, t('skills.sortLoads')),
            h('option', { value: 'recent' }, t('skills.sortRecent')),
            h('option', { value: 'name' }, t('skills.sortName')),
          ),
          h('label', { className: 'tbx-check' },
            h('input', { type: 'checkbox', checked: neverFired, onChange: (e) => setNeverFired(e.target.checked) }),
            t('skills.neverFired'),
          ),
          data && h('span', { className: 'tbx-muted' }, t('skills.totals', { enabled: data.totals.enabled, all: data.totals.all, retired: data.totals.retired })),
        ),
        h('div', { className: 'tbx-note' }, t('skills.note')),
        error && h('div', { className: 'tbx-error' }, error),
        h(
          'div',
          { className: 'tbx-list' },
          rows.map((row) => h(
            'div',
            { className: 'tbx-row' + (row.enabled ? '' : ' tbx-rowOff'), key: row.dir },
            h('span', { className: 'tbx-name', title: row.name }, row.name),
            row.copies > 1 ? h('span', { className: 'tbx-copies', title: t('skills.duplicates', { count: row.copies }) }, `×${row.copies}`) : null,
            h('span', { className: 'tbx-desc', title: row.description }, row.description),
            h('span', { className: 'tbx-load', title: t('skills.loads') }, String(row.loads)),
            h('span', { className: 'tbx-muted' }, ago(row.lastSeen)),
            h(Switch, { checked: row.enabled, label: t('skills.toggle', { name: row.name }), onChange: () => toggle(row) }),
          )),
          rows.length === 0 && h('div', { className: 'tbx-empty' }, t('skills.empty')),
        ),
      )
    }

    function ProvidersTab({ t }) {
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [tests, setTests] = useState({})
      useEffect(() => {
        fetchJson('/api/toolbox/providers').then(setData).catch((e) => setError(e.message))
      }, [])
      const ping = async (row) => {
        const key = `${row.provider}::${row.model}`
        setTests((previous) => ({ ...previous, [key]: { state: 'loading' } }))
        try {
          const result = await fetchJson('/api/toolbox/ping', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider: row.provider, model: row.model }),
          })
          setTests((previous) => ({
            ...previous,
            [key]: result.ok === true
              ? { state: 'ok', label: result.firstChunkMs === null ? `${result.totalMs}ms` : `${result.firstChunkMs}ms` }
              : { state: 'error', label: result.error || t('providers.testFailed') },
          }))
        } catch (e) {
          setTests((previous) => ({ ...previous, [key]: { state: 'error', label: e.message } }))
        }
      }
      if (error) return h('div', { className: 'tbx-error' }, error)
      if (data === null) return h('div', { className: 'tbx-empty' }, t('loading'))
      return h(
        React.Fragment,
        null,
        h('div', { className: 'tbx-note' }, t('providers.note', { scanned: data.scanned })),
        data.rows.length === 0
          ? h('div', { className: 'tbx-empty' }, t('providers.empty'))
          : h(
              'table',
              { className: 'tbx-table' },
              h('thead', null, h('tr', null,
                h('th', null, t('providers.model')),
                h('th', { className: 'num' }, t('providers.messages')),
                h('th', { className: 'num' }, t('providers.input')),
                h('th', { className: 'num' }, t('providers.output')),
                h('th', { className: 'num' }, t('providers.cache')),
                h('th', { className: 'num' }, t('providers.latency')),
                h('th', { className: 'num' }, t('providers.errors')),
                h('th', { className: 'num' }, t('providers.last')),
                h('th', null, t('providers.test')),
              )),
              h('tbody', null, data.rows.map((row) => h('tr', { key: `${row.provider}::${row.model}` },
                h('td', null,
                  h('span', { className: 'tbx-badge' }, row.provider),
                  ' ',
                  h('span', { className: 'tbx-prov' }, row.model),
                ),
                h('td', { className: 'num' }, String(row.messages)),
                h('td', { className: 'num' }, n(row.inputTokens)),
                h('td', { className: 'num' }, n(row.outputTokens)),
                h('td', { className: 'num' }, n(row.cacheReadTokens)),
                h('td', { className: 'num' }, row.latencyMs === null || row.latencyMs === undefined ? '—' : row.latencyMs < 1000 ? `${row.latencyMs}ms` : `${(row.latencyMs / 1000).toFixed(1)}s`),
                h('td', { className: 'num' }, String(row.errors)),
                h('td', { className: 'num' }, ago(row.lastUsed)),
                h('td', null, (() => {
                  const key = `${row.provider}::${row.model}`
                  const test = tests[key]
                  if (test === undefined) {
                    return h('button', { type: 'button', className: 'tbx-btn', onClick: () => void ping(row) }, t('providers.test'))
                  }
                  if (test.state === 'loading') return h('span', { className: 'tbx-muted' }, t('providers.testing'))
                  return h('span', { className: 'tbx-muted', title: test.label }, test.state === 'ok' ? `✓ ${test.label}` : `✕ ${test.label.slice(0, 28)}`)
                })()),
              ))),
            ),
      )
    }

    function BoardTab({ t }) {
      const [board, setBoard] = useState(null)
      const [error, setError] = useState(null)
      const [saved, setSaved] = useState(false)
      const [dropAt, setDropAt] = useState(null)
      const [editing, setEditing] = useState(null)
      const [draft, setDraft] = useState('')
      const drag = useRef(null)
      const saveTimer = useRef(null)

      useEffect(() => {
        fetchJson('/api/toolbox/board').then(setBoard).catch((e) => setError(e.message))
      }, [])

      const persist = useCallback((next) => {
        setBoard(next)
        setSaved(false)
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
          fetchJson('/api/toolbox/board', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(next),
          }).then(() => setSaved(true)).catch((e) => setError(e.message))
        }, 250)
      }, [])

      if (error) return h('div', { className: 'tbx-error' }, error)
      if (board === null) return h('div', { className: 'tbx-empty' }, t('loading'))

      const addCard = (columnId, text) => {
        const trimmed = text.trim()
        if (trimmed === '') return
        persist({
          ...board,
          columns: board.columns.map((column) => column.id === columnId
            ? { ...column, cards: [...column.cards, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: trimmed }] }
            : column),
        })
      }

      const removeCard = (columnId, cardId) => {
        persist({
          ...board,
          columns: board.columns.map((column) => column.id === columnId
            ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) }
            : column),
        })
      }

      const renameCard = (columnId, cardId, text) => {
        const trimmed = text.trim()
        if (trimmed === '') return
        persist({
          ...board,
          columns: board.columns.map((column) => column.id === columnId
            ? { ...column, cards: column.cards.map((card) => (card.id === cardId ? { ...card, text: trimmed } : card)) }
            : column),
        })
      }

      const moveCard = (fromColumn, cardId, toColumn, toIndex) => {
        if (fromColumn === toColumn && dropAt !== null && drag.current?.card === cardId) {
          // same-column move: remove first, then clamp the target index
        }
        const source = board.columns.find((c) => c.id === fromColumn)
        const moving = source?.cards.find((c) => c.id === cardId)
        if (moving === undefined) return
        const without = board.columns.map((column) => column.id === fromColumn
          ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) }
          : column)
        persist({
          ...board,
          columns: without.map((column) => {
            if (column.id !== toColumn) return column
            const at = Math.max(0, Math.min(toIndex, column.cards.length))
            return { ...column, cards: [...column.cards.slice(0, at), moving, ...column.cards.slice(at)] }
          }),
        })
      }

      const onColumnDragOver = (event, columnId, cardCount) => {
        event.preventDefault()
        if (dropAt !== null && dropAt.column === columnId && dropAt.index === cardCount) return
        setDropAt({ column: columnId, index: cardCount })
      }

      const onCardDragOver = (event, columnId, index) => {
        event.preventDefault()
        event.stopPropagation()
        if (dropAt !== null && dropAt.column === columnId && dropAt.index === index) return
        setDropAt({ column: columnId, index })
      }

      const onDrop = (event, columnId) => {
        event.preventDefault()
        const source = drag.current
        const target = dropAt
        drag.current = null
        setDropAt(null)
        if (source === null) return
        const index = target !== null && target.column === columnId ? target.index : Number.MAX_SAFE_INTEGER
        if (source.column === columnId) {
          const column = board.columns.find((c) => c.id === columnId)
          const from = column.cards.findIndex((c) => c.id === source.card)
          if (from < 0) return
          const adjusted = from < index ? index - 1 : index
          if (adjusted === from) return
          moveCard(columnId, source.card, columnId, adjusted)
        } else {
          moveCard(source.column, source.card, columnId, index)
        }
      }

      return h(
        React.Fragment,
        null,
        h('div', { className: 'tbx-note' }, saved ? t('board.saved') : t('board.note')),
        h(
          'div',
          { className: 'tbx-board' },
          board.columns.map((column) => h(
            'div',
            {
              className: 'tbx-col' + (dropAt !== null && dropAt.column === column.id ? ' tbx-colOver' : ''),
              key: column.id,
              onDragOver: (event) => onColumnDragOver(event, column.id, column.cards.length),
              onDragLeave: (event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return
                setDropAt(null)
              },
              onDrop: (event) => onDrop(event, column.id),
            },
            h('div', { className: 'tbx-colHead' },
              h('span', null, column.title),
              h('span', null, String(column.cards.length)),
            ),
            column.cards.map((card, index) => h(
              React.Fragment,
              { key: card.id },
              dropAt !== null && dropAt.column === column.id && dropAt.index === index
                ? h('div', { className: 'tbx-drop' })
                : null,
              editing === card.id
                ? h('textarea', {
                    className: 'tbx-editCard',
                    autoFocus: true,
                    value: draft,
                    onChange: (event) => setDraft(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setEditing(null)
                      } else if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        renameCard(column.id, card.id, draft)
                        setEditing(null)
                      }
                    },
                    onBlur: () => {
                      renameCard(column.id, card.id, draft)
                      setEditing(null)
                    },
                  })
                : h(
                    'div',
                    {
                      className: 'tbx-card',
                      draggable: true,
                      onDragStart: () => { drag.current = { column: column.id, card: card.id } },
                      onDragOver: (event) => onCardDragOver(event, column.id, index),
                      onDoubleClick: () => {
                        setDraft(card.text)
                        setEditing(card.id)
                      },
                    },
                    h('span', { className: 'tbx-cardText' }, card.text),
                    h('button', {
                      type: 'button',
                      className: 'tbx-cardX',
                      'aria-label': t('board.remove', { text: card.text }),
                      onClick: () => removeCard(column.id, card.id),
                    }, '×'),
                  ),
            )),
            dropAt !== null && dropAt.column === column.id && dropAt.index >= column.cards.length
              ? h('div', { className: 'tbx-drop' })
              : null,
            h(AddCard, { onAdd: (text) => addCard(column.id, text), label: t('board.add') }),
          )),
        ),
      )
    }

    function CommandTab({ t, stop }) {
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [stopping, setStopping] = useState(null)
      const load = useCallback(() => {
        fetchJson('/api/toolbox/sessions').then(setData).catch((e) => setError(e.message))
      }, [])
      useEffect(load, [load])
      if (error) return h('div', { className: 'tbx-error' }, error)
      if (data === null) return h('div', { className: 'tbx-empty' }, t('loading'))
      if (data.rows.length === 0) return h('div', { className: 'tbx-empty' }, t('command.empty'))
      const workspace = (cwd) => (cwd || '').split('/').filter(Boolean).pop() || '—'
      const cancel = async (row) => {
        setStopping(row.id)
        try {
          const result = await stop(row.id)
          if (result?.ok === false) setError(result.error?.message || t('command.stopFailed'))
          window.setTimeout(load, 1200)
        } catch (e) {
          setError(e.message)
        } finally {
          setStopping(null)
        }
      }
      return h(
        'div',
        { className: 'tbx-list' },
        data.rows.map((row) => h(
          'div',
          { className: 'tbx-row', key: row.id },
          h('span', { className: 'tbx-dot' + (row.active ? ' tbx-dotOn' : ''), title: row.active ? t('sessions.active') : t('sessions.idle') }),
          h(
            'span',
            { className: 'tbx-copy' },
            h('span', { className: 'tbx-name', title: row.id }, row.title),
            h(
              'span',
              { className: 'tbx-desc' },
              `${workspace(row.cwd)} · ${row.model || '—'} · ${row.messages} ${t('sessions.messagesShort')} · ${n(row.tokens)} ${t('sessions.tokensShort')}`,
            ),
          ),
          row.active
            ? h('button', {
                type: 'button',
                className: 'tbx-btn',
                disabled: stopping === row.id,
                onClick: () => void cancel(row),
              }, stopping === row.id ? t('command.stopping') : t('command.stop'))
            : null,
          h('span', { className: 'tbx-muted' }, ago(row.updatedAt)),
        )),
      )
    }

    function CommandPage({ t, stop }) {
      return h(
        'div',
        { className: 'tbx-page' },
        h('div', { className: 'tbx-head' }, h('span', { className: 'tbx-title' }, t('command.title'))),
        h('div', { className: 'tbx-body' },
          h('div', { className: 'tbx-note' }, t('command.note')),
          h(CommandTab, { t, stop }),
        ),
      )
    }

    function KanbanPage({ t }) {
      return h(
        'div',
        { className: 'tbx-page' },
        h('div', { className: 'tbx-head' }, h('span', { className: 'tbx-title' }, t('kanban.title'))),
        h('div', { className: 'tbx-body' }, h(BoardTab, { t })),
      )
    }

    function AddCard({ onAdd, label }) {
      const [text, setText] = useState('')
      return h(
        'form',
        {
          className: 'tbx-add',
          onSubmit: (event) => {
            event.preventDefault()
            onAdd(text)
            setText('')
          },
        },
        h('input', {
          value: text,
          onChange: (event) => setText(event.target.value),
          placeholder: label,
          'aria-label': label,
        }),
        h('button', { type: 'submit', className: 'tbx-btn' }, '+'),
      )
    }

    function SkillsPage({ t }) {
      return h(
        'div',
        { className: 'tbx-page' },
        h('div', { className: 'tbx-head' }, h('span', { className: 'tbx-title' }, t('skills.title'))),
        h('div', { className: 'tbx-body' }, h(SkillsTab, { t })),
      )
    }

    function ProvidersPage({ t }) {
      return h(
        'div',
        { className: 'tbx-page' },
        h('div', { className: 'tbx-head' }, h('span', { className: 'tbx-title' }, t('providers.title'))),
        h('div', { className: 'tbx-body' }, h(ProvidersTab, { t })),
      )
    }

    const SkillsIcon = () => h(
      'svg',
      { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      h('path', {
        d: 'M3 3.5h4v4H3zM9 3.5h4v4H9zM3 9.5h4v4H3zM9 9.5h4v4H9z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.2,
      }),
    )

    const KanbanIcon = () => h(
      'svg',
      { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      h('path', {
        d: 'M2.5 2.5h3v11h-3zM6.5 2.5h3v7h-3zM10.5 2.5h3v9h-3z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.2,
      }),
    )

    const CommandIcon = () => h(
      'svg',
      { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      h('path', {
        d: 'M1.5 8h3l2-4.5 3 9 2-4.5h3',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
    )

    const ProvidersIcon = () => h(
      'svg',
      { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      h('path', {
        d: 'M8 2.2 13.8 5 8 7.8 2.2 5zM2.2 8 8 10.8 13.8 8M2.2 11 8 13.8 13.8 11',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.1,
        strokeLinejoin: 'round',
      }),
    )

    const en = {
      panel: 'Toolbox',
      'skills.title': 'Skills',
      'providers.title': 'Providers',
      loading: 'Loading…',
      'tab.skills': 'Skills',
      'tab.providers': 'Providers',
      'kanban.title': 'Kanban',
      'command.title': 'Command Center',
      'command.note': 'Every durable session with its model, message count, token total and last write. An active session can be stopped here; opening one stays with the sidebar.',
      'command.empty': 'No sessions found.',
      'command.stop': 'Stop',
      'command.stopping': 'Stopping…',
      'command.stopFailed': 'The session did not accept the stop request.',
      'sessions.status': 'Status',
      'sessions.title': 'Session',
      'sessions.workspace': 'Workspace',
      'sessions.model': 'Model',
      'sessions.messages': 'Messages',
      'sessions.tokens': 'Tokens',
      'sessions.last': 'Last write',
      'sessions.messagesShort': 'messages',
      'sessions.tokensShort': 'tokens',
      'sessions.active': 'active',
      'sessions.idle': 'idle',
      'skills.search': 'Filter skills',
      'skills.totals': '{enabled} enabled · {all} total · {retired} retired',
      'skills.note': 'Loads come from the curator. Disabling moves a skill to ~/.dsh/skills-retired.',
      'skills.loads': 'Skill loads',
      'skills.sort': 'Sort skills',
      'skills.sortLoads': 'Most loaded',
      'skills.sortRecent': 'Recently used',
      'skills.sortName': 'Name',
      'skills.neverFired': 'Never fired',
      'skills.duplicates': '{count} copies share this name',
      'skills.toggle': 'Enable {name}',
      'skills.empty': 'No skills match.',
      'providers.note': 'From the newest {scanned} session logs. Tokens are reported by the provider.',
      'providers.model': 'Model',
      'providers.messages': 'Messages',
      'providers.input': 'Input',
      'providers.output': 'Output',
      'providers.cache': 'Cache read',
      'providers.latency': 'Response',
      'providers.errors': 'Errors',
      'providers.last': 'Last',
      'providers.test': 'Test',
      'providers.testing': 'Testing…',
      'providers.testFailed': 'failed',
      'providers.empty': 'No model calls recorded yet.',
      'board.note': 'Drag cards between columns. Saved to ~/.dsh/toolbox/board.json.',
      'board.saved': 'Saved.',
      'board.add': 'Add a card',
      'board.remove': 'Remove {text}',
    }

    const zh = {
      panel: '工具箱',
      'skills.title': '技能',
      'providers.title': '提供商',
      loading: '加载中…',
      'tab.skills': '技能',
      'tab.providers': '提供商',
      'kanban.title': '看板',
      'command.title': '指挥中心',
      'command.note': '每个持久会话的模型、消息数、token 总量与最近写入。活跃会话可在此停止；打开会话仍使用左侧边栏。',
      'command.empty': '没有会话。',
      'command.stop': '停止',
      'command.stopping': '停止中…',
      'command.stopFailed': '会话没有接受停止请求。',
      'sessions.status': '状态',
      'sessions.title': '会话',
      'sessions.workspace': '工作区',
      'sessions.model': '模型',
      'sessions.messages': '消息',
      'sessions.tokens': 'Token',
      'sessions.last': '最近写入',
      'sessions.messagesShort': '条消息',
      'sessions.tokensShort': 'token',
      'sessions.active': '活跃',
      'sessions.idle': '空闲',
      'skills.search': '筛选技能',
      'skills.totals': '{enabled} 启用 · {all} 总数 · {retired} 已停用',
      'skills.note': '加载次数来自 curator。停用会把技能移动到 ~/.dsh/skills-retired。',
      'skills.loads': '加载次数',
      'skills.sort': '排序',
      'skills.sortLoads': '加载最多',
      'skills.sortRecent': '最近使用',
      'skills.sortName': '名称',
      'skills.neverFired': '从未触发',
      'skills.duplicates': '{count} 个同名副本',
      'skills.toggle': '启用 {name}',
      'skills.empty': '没有匹配的技能。',
      'providers.note': '来自最新 {scanned} 个会话日志。token 由提供商上报。',
      'providers.model': '模型',
      'providers.messages': '消息',
      'providers.input': '输入',
      'providers.output': '输出',
      'providers.cache': '缓存读取',
      'providers.latency': '响应',
      'providers.errors': '错误',
      'providers.last': '最近',
      'providers.test': '测试',
      'providers.testing': '测试中…',
      'providers.testFailed': '失败',
      'providers.empty': '还没有模型调用记录。',
      'board.note': '拖动卡片到其他列。保存于 ~/.dsh/toolbox/board.json。',
      'board.saved': '已保存。',
      'board.add': '添加卡片',
      'board.remove': '删除 {text}',
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'toolbox: dictionaries')
      const t = ctx.locale.bind(NS)
      const stopSession = (sessionId) => ctx.remote.session.cancel({ sessionId })
      const rows = [
        { key: 'skills', order: 23, label: 'skills.title', icon: SkillsIcon },
        { key: 'providers', order: 24, label: 'providers.title', icon: ProvidersIcon },
        { key: 'kanban', order: 25, label: 'kanban.title', icon: KanbanIcon },
        { key: 'command', order: 26, label: 'command.title', icon: CommandIcon },
      ]
      for (const row of rows) {
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: row.key, order: row.order, locale: NS, label: () => t(row.label) },
            row.icon,
          ),
        )
      }
      const pages = {
        skills: SkillsPage,
        providers: ProvidersPage,
        kanban: KanbanPage,
        command: (props) => h(CommandPage, { ...props, stop: stopSession }),
      }
      for (const key of Object.keys(pages)) {
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key, locale: NS }, pages[key]),
        )
      }
    }

    return { inject: ['slots', 'locale', 'remote'], apply }
  },
})
