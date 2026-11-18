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
.tbx-preview{margin:2px 8px 6px 12px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto}
.tbx-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-caption);margin-right:6px;vertical-align:middle;flex:none}
.tbx-dotOn{background:var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary))}
.tbx-dotWait{background:var(--dsw-alias-state-warning-primary)}
.tbx-dotErr{background:var(--dsw-alias-state-error-primary)}
.tbx-state{flex:none;font-size:10px;line-height:15px;padding:0 5px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.tbx-stateErr{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.tbx-stateWait{color:var(--dsw-alias-state-warning-primary);border-color:var(--dsw-alias-state-warning-primary)}
.tbx-stateRun{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary));border-color:currentColor}
.tbx-filters{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:2px 0 8px}
.tbx-chip{border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:16px;padding:1px 8px;cursor:pointer}
.tbx-chip:hover{background:var(--dsw-alias-bg-layer-2)}
.tbx-chip[aria-pressed="true"]{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary)}
.tbx-prices{display:flex;flex-direction:column;gap:6px;padding:6px 0 10px}
.tbx-pricesText{width:100%;box-sizing:border-box;resize:vertical;font-family:var(--dsw-alias-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;line-height:16px;padding:8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.tbx-sort{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;padding:3px 6px}
.tbx-check{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.tbx-copies{flex:none;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 5px;font-size:10px;line-height:15px;color:var(--dsw-alias-label-secondary)}
.tbx-drop{height:2px;margin:2px 0;border-radius:2px;background:var(--dsw-alias-state-business-primary)}
.tbx-editCard{display:flex;flex-direction:column;gap:5px;border:1px solid var(--dsw-alias-state-business-primary);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2);padding:5px 7px;width:100%;box-sizing:border-box}
.tbx-editCard textarea{width:100%;box-sizing:border-box;border:none;background:0 0;color:inherit;font:inherit;font-size:12px;resize:vertical;min-height:34px;outline:none}
.tbx-bulk{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 8px;margin:4px 0;border:1px solid var(--dsw-alias-state-business-primary);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1)}
.tbx-prio{flex:none;width:6px;height:6px;border-radius:50%;margin-right:2px}
.tbx-cardCheck{flex:none;margin:0 2px 0 0;accent-color:var(--dsw-alias-state-business-primary)}
.tbx-assignee{flex:none;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 6px;font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tbx-cardArchived{opacity:.55}
.tbx-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin:6px 0 12px}
.tbx-stat{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);padding:7px 9px;background:var(--dsw-alias-bg-layer-1)}
.tbx-statLabel{display:block;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.tbx-statValue{display:block;font-size:16px;line-height:22px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
.tbx-chart{display:flex;align-items:flex-end;gap:2px;height:96px;padding:6px 0 0;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:4px}
.tbx-bar{flex:1;min-width:2px;border-radius:2px 2px 0 0;background:var(--dsw-alias-state-business-primary);opacity:.75;min-height:1px}
.tbx-bar:hover{opacity:1}
.tbx-chartFoot{display:flex;justify-content:space-between;font-size:10px;color:var(--dsw-alias-label-tertiary);margin-bottom:12px}
.tbx-section{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);margin:14px 0 4px}
.tbx-log{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);padding:6px 8px;max-height:60vh;overflow:auto}
.tbx-logLine{display:flex;gap:8px;white-space:pre-wrap;word-break:break-word}
.tbx-logLineNoWrap{white-space:pre;overflow-x:auto}
.tbx-sev{flex:none;width:44px;text-transform:uppercase;font-size:9px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);padding-top:2px}
.tbx-sevError{color:var(--dsw-alias-state-error-primary)}
.tbx-sevWarn{color:var(--dsw-alias-state-warning-primary)}
.tbx-noteRow{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:var(--dsw-radius-md)}
.tbx-noteRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.tbx-kind{flex:none;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 6px;font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary);text-transform:lowercase}
.tbx-noteText{flex:1;min-width:0;font-size:12px;line-height:17px;word-break:break-word}
.tbx-addForm{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);padding:8px;margin:8px 0 12px;background:var(--dsw-alias-bg-layer-1)}
.tbx-addForm textarea{box-sizing:border-box;width:100%;min-height:52px;resize:vertical;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);color:inherit;font:inherit;font-size:12px;padding:6px 8px;outline:none}
.tbx-addForm textarea:focus{border-color:var(--dsw-alias-state-business-primary)}
.tbx-addRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tbx-select{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:11px;padding:3px 6px}
.tbx-voice{display:flex;align-items:center;gap:2px}
.tbx-voiceBtn{width:24px;height:24px;border:none;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0}
.tbx-voiceBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.tbx-voiceBtn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.tbx-voiceOn{color:var(--dsw-alias-state-business-primary)}
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
      const [preview, setPreview] = useState(null)
      const load = useCallback(() => {
        fetchJson('/api/toolbox/skills').then(setData).catch((e) => setError(e.message))
      }, [])
      const togglePreview = async (row) => {
        if (preview !== null && preview.dir === row.dir) return setPreview(null)
        try {
          const body = await fetchJson(`/api/toolbox/skill?dir=${encodeURIComponent(row.dir)}`)
          setPreview({ dir: row.dir, text: body.text })
        } catch (e) {
          setError(e.message)
        }
      }
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
            React.Fragment,
            { key: row.dir },
            h(
              'div',
              { className: 'tbx-row' + (row.enabled ? '' : ' tbx-rowOff') },
              h('button', {
                type: 'button',
                className: 'tbx-name',
                style: { background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' },
                title: t('skills.preview'),
                'aria-expanded': preview !== null && preview.dir === row.dir,
                onClick: () => void togglePreview(row),
              }, row.name),
              row.copies > 1 ? h('span', { className: 'tbx-copies', title: t('skills.duplicates', { count: row.copies }) }, `×${row.copies}`) : null,
              h('span', { className: 'tbx-desc', title: row.description }, row.description),
              h('span', { className: 'tbx-load', title: t('skills.loads') }, String(row.loads)),
              h('span', { className: 'tbx-muted' }, ago(row.lastSeen)),
              h(Switch, { checked: row.enabled, label: t('skills.toggle', { name: row.name }), onChange: () => toggle(row) }),
            ),
            preview !== null && preview.dir === row.dir
              ? h('pre', { className: 'tbx-preview' }, preview.text)
              : null,
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
              'div',
              { className: 'tbx-list' },
              data.rows.map((row) => {
                const key = `${row.provider}::${row.model}`
                const test = tests[key]
                return h(
                  'div',
                  { className: 'tbx-row', key },
                  h('span', { className: 'tbx-copy' },
                    h('span', { className: 'tbx-name' },
                      h('span', { className: 'tbx-badge' }, row.provider),
                      ' ',
                      h('span', { className: 'tbx-prov' }, row.model),
                    ),
                    h('span', { className: 'tbx-desc' },
                      `${row.messages} ${t('sessions.messagesShort')} · ${n(row.inputTokens)}/${n(row.outputTokens)} ${t('providers.tokensShort')} · ${n(row.cacheReadTokens)} ${t('providers.cacheShort')} · ${row.errors} ${t('providers.errorsShort')} · ${ago(row.lastUsed)}`,
                    ),
                  ),
                  h('span', { className: 'tbx-muted', title: t('providers.responseTitle') },
                    row.latencyMs === null || row.latencyMs === undefined ? '—' : row.latencyMs < 1000 ? `${row.latencyMs}ms` : `${(row.latencyMs / 1000).toFixed(1)}s`,
                  ),
                  test === undefined
                    ? h('button', { type: 'button', className: 'tbx-btn', onClick: () => void ping(row) }, t('providers.test'))
                    : test.state === 'loading'
                      ? h('span', { className: 'tbx-muted' }, t('providers.testing'))
                      : h('span', { className: 'tbx-muted', title: test.label }, test.state === 'ok' ? `✓ ${test.label}` : `✕ ${test.label.slice(0, 24)}`),
                )
              }),
            ),
      )
    }

    function BoardTab({ t }) {
      const [state, setState] = useState(null)
      const [error, setError] = useState(null)
      const [saved, setSaved] = useState(false)
      const [dropAt, setDropAt] = useState(null)
      const [editing, setEditing] = useState(null)
      const [draft, setDraft] = useState({ text: '', assignee: '', priority: 'normal' })
      const [selected, setSelected] = useState([])
      const [showArchived, setShowArchived] = useState(false)
      const [renaming, setRenaming] = useState(null)
      const [boardName, setBoardName] = useState('')
      const drag = useRef(null)
      const saveTimer = useRef(null)

      useEffect(() => {
        fetchJson('/api/toolbox/board').then(setState).catch((e) => setError(e.message))
      }, [])

      const persist = useCallback((next) => {
        setState(next)
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
      if (state === null) return h('div', { className: 'tbx-empty' }, t('loading'))

      const board = state.boards.find((entry) => entry.id === state.activeBoard) || state.boards[0]
      const withBoard = (mutate) => persist({
        ...state,
        boards: state.boards.map((entry) => (entry.id === board.id ? mutate(entry) : entry)),
      })
      const withColumn = (columnId, mutate) => withBoard((entry) => ({
        ...entry,
        columns: entry.columns.map((column) => (column.id === columnId ? mutate(column) : column)),
      }))
      const allCards = board.columns.flatMap((column) => column.cards)
      const visible = (card) => showArchived || !card.archived

      const addCard = (columnId, text) => {
        const trimmed = text.trim()
        if (trimmed === '') return
        withColumn(columnId, (column) => ({
          ...column,
          cards: [...column.cards, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: trimmed, assignee: '', priority: 'normal', archived: false, createdAt: Date.now() }],
        }))
      }

      const patchCard = (cardId, patch) => withBoard((entry) => ({
        ...entry,
        columns: entry.columns.map((column) => ({
          ...column,
          cards: column.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)),
        })),
      }))

      const removeCards = (ids) => {
        const drop = new Set(ids)
        withBoard((entry) => ({
          ...entry,
          columns: entry.columns.map((column) => ({ ...column, cards: column.cards.filter((card) => !drop.has(card.id)) })),
        }))
        setSelected((previous) => previous.filter((id) => !drop.has(id)))
      }

      const archiveCards = (ids) => {
        const drop = new Set(ids)
        withBoard((entry) => ({
          ...entry,
          columns: entry.columns.map((column) => ({
            ...column,
            cards: column.cards.map((card) => (drop.has(card.id) ? { ...card, archived: true } : card)),
          })),
        }))
        setSelected([])
      }

      const moveCards = (ids, toColumn) => {
        const moving = allCards.filter((card) => ids.includes(card.id))
        if (moving.length === 0) return
        withBoard((entry) => {
          const stripped = entry.columns.map((column) => ({ ...column, cards: column.cards.filter((card) => !ids.includes(card.id)) }))
          return {
            ...entry,
            columns: stripped.map((column) => (column.id === toColumn ? { ...column, cards: [...column.cards, ...moving] } : column)),
          }
        })
        setSelected([])
      }

      const moveCard = (fromColumn, cardId, toColumn, toIndex) => {
        const source = board.columns.find((column) => column.id === fromColumn)
        const moving = source?.cards.find((card) => card.id === cardId)
        if (moving === undefined) return
        withBoard((entry) => {
          const without = entry.columns.map((column) => (column.id === fromColumn
            ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) }
            : column))
          return {
            ...entry,
            columns: without.map((column) => {
              if (column.id !== toColumn) return column
              const at = Math.max(0, Math.min(toIndex, column.cards.length))
              return { ...column, cards: [...column.cards.slice(0, at), moving, ...column.cards.slice(at)] }
            }),
          }
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
          const column = board.columns.find((entry) => entry.id === columnId)
          const from = column.cards.findIndex((card) => card.id === source.card)
          if (from < 0) return
          const adjusted = from < index ? index - 1 : index
          if (adjusted === from) return
          moveCard(columnId, source.card, columnId, adjusted)
        } else {
          moveCard(source.column, source.card, columnId, index)
        }
      }

      const toggleSelected = (cardId) => setSelected((previous) => (
        previous.includes(cardId) ? previous.filter((id) => id !== cardId) : [...previous, cardId]
      ))

      const newBoard = () => {
        const id = `board-${Date.now().toString(36)}`
        const name = t('board.newName', { count: String(state.boards.length + 1) })
        persist({
          ...state,
          activeBoard: id,
          boards: [...state.boards, {
            id,
            name,
            columns: [
              { id: 'todo', title: t('board.todo'), cards: [] },
              { id: 'doing', title: t('board.doing'), cards: [] },
              { id: 'done', title: t('board.done'), cards: [] },
            ],
          }],
        })
      }

      const deleteBoard = () => {
        if (state.boards.length <= 1) return
        const remaining = state.boards.filter((entry) => entry.id !== board.id)
        persist({ ...state, activeBoard: remaining[0].id, boards: remaining })
      }

      const priorityDot = (priority) => h('span', {
        className: 'tbx-prio',
        title: t(`board.priority.${priority}`),
        style: { background: priority === 'high' ? 'var(--dsw-alias-state-error-primary)' : priority === 'low' ? 'var(--dsw-alias-label-tertiary)' : 'var(--dsw-alias-state-business-primary)' },
      })

      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'tbx-toolbar' },
          h('select', {
            className: 'tbx-select',
            value: board.id,
            'aria-label': t('board.switch'),
            onChange: (event) => persist({ ...state, activeBoard: event.target.value }),
          }, state.boards.map((entry) => h('option', { key: entry.id, value: entry.id }, entry.name))),
          renaming === board.id
            ? h('input', {
                className: 'tbx-search',
                style: { maxWidth: 180 },
                autoFocus: true,
                value: boardName,
                'aria-label': t('board.rename'),
                onChange: (event) => setBoardName(event.target.value),
                onBlur: () => {
                  const name = boardName.trim()
                  if (name !== '') withBoard((entry) => ({ ...entry, name }))
                  setRenaming(null)
                },
                onKeyDown: (event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') setRenaming(null)
                },
              })
            : h('button', {
                type: 'button',
                className: 'tbx-btn',
                title: t('board.rename'),
                onClick: () => { setBoardName(board.name); setRenaming(board.id) },
              }, t('board.rename')),
          h('button', { type: 'button', className: 'tbx-btn', onClick: newBoard }, t('board.new')),
          state.boards.length > 1
            ? h('button', { type: 'button', className: 'tbx-btn', onClick: deleteBoard }, t('board.delete'))
            : null,
          h('label', { className: 'tbx-check' },
            h('input', { type: 'checkbox', checked: showArchived, onChange: (event) => setShowArchived(event.target.checked) }),
            t('board.showArchived'),
          ),
          h('span', { className: 'tbx-muted' }, saved ? t('board.saved') : t('board.note')),
        ),
        selected.length > 0
          ? h(
              'div',
              { className: 'tbx-bulk' },
              h('span', { className: 'tbx-muted' }, t('board.selected', { count: String(selected.length) })),
              h('select', {
                className: 'tbx-select',
                value: '',
                'aria-label': t('board.moveTo'),
                onChange: (event) => {
                  if (event.target.value !== '') moveCards(selected, event.target.value)
                },
              },
                h('option', { value: '' }, t('board.moveTo')),
                board.columns.map((column) => h('option', { key: column.id, value: column.id }, column.title)),
              ),
              h('button', { type: 'button', className: 'tbx-btn', onClick: () => archiveCards(selected) }, t('board.archive')),
              h('button', { type: 'button', className: 'tbx-btn', onClick: () => removeCards(selected) }, t('board.removeSelected')),
              h('button', { type: 'button', className: 'tbx-btn', onClick: () => setSelected([]) }, t('board.clear')),
            )
          : null,
        h(
          'div',
          { className: 'tbx-board' },
          board.columns.map((column) => {
            const cards = column.cards.filter(visible)
            return h(
              'div',
              {
                className: 'tbx-col' + (dropAt !== null && dropAt.column === column.id ? ' tbx-colOver' : ''),
                key: column.id,
                onDragOver: (event) => onColumnDragOver(event, column.id, cards.length),
                onDragLeave: (event) => {
                  if (event.currentTarget.contains(event.relatedTarget)) return
                  setDropAt(null)
                },
                onDrop: (event) => onDrop(event, column.id),
              },
              h('div', { className: 'tbx-colHead' },
                h('span', null, column.title),
                h('span', null, String(cards.length)),
              ),
              cards.map((card, index) => h(
                React.Fragment,
                { key: card.id },
                dropAt !== null && dropAt.column === column.id && dropAt.index === index
                  ? h('div', { className: 'tbx-drop' })
                  : null,
                editing === card.id
                  ? h(
                      'div',
                      { className: 'tbx-editCard' },
                      h('textarea', {
                        autoFocus: true,
                        value: draft.text,
                        'aria-label': t('board.cardText'),
                        onChange: (event) => setDraft({ ...draft, text: event.target.value }),
                        onKeyDown: (event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            setEditing(null)
                          } else if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            if (draft.text.trim() !== '') patchCard(card.id, { text: draft.text.trim(), assignee: draft.assignee.trim(), priority: draft.priority })
                            setEditing(null)
                          }
                        },
                      }),
                      h('div', { className: 'tbx-addRow' },
                        h('input', {
                          className: 'tbx-search',
                          style: { maxWidth: 120 },
                          placeholder: t('board.assignee'),
                          value: draft.assignee,
                          'aria-label': t('board.assignee'),
                          onChange: (event) => setDraft({ ...draft, assignee: event.target.value }),
                        }),
                        h('select', {
                          className: 'tbx-select',
                          value: draft.priority,
                          'aria-label': t('board.priority'),
                          onChange: (event) => setDraft({ ...draft, priority: event.target.value }),
                        }, ['low', 'normal', 'high'].map((level) => h('option', { key: level, value: level }, t(`board.priority.${level}`)))),
                        h('button', {
                          type: 'button',
                          className: 'tbx-btn',
                          onClick: () => {
                            if (draft.text.trim() !== '') patchCard(card.id, { text: draft.text.trim(), assignee: draft.assignee.trim(), priority: draft.priority })
                            setEditing(null)
                          },
                        }, t('board.save')),
                        h('button', { type: 'button', className: 'tbx-btn', onClick: () => setEditing(null) }, t('board.cancel')),
                      ),
                    )
                  : h(
                      'div',
                      {
                        className: 'tbx-card' + (card.archived ? ' tbx-cardArchived' : ''),
                        draggable: true,
                        onDragStart: () => { drag.current = { column: column.id, card: card.id } },
                        onDragOver: (event) => onCardDragOver(event, column.id, index),
                        onDoubleClick: () => {
                          setDraft({ text: card.text, assignee: card.assignee || '', priority: card.priority || 'normal' })
                          setEditing(card.id)
                        },
                      },
                      h('input', {
                        type: 'checkbox',
                        className: 'tbx-cardCheck',
                        checked: selected.includes(card.id),
                        'aria-label': t('board.select', { text: card.text }),
                        onChange: () => toggleSelected(card.id),
                      }),
                      priorityDot(card.priority || 'normal'),
                      h('span', { className: 'tbx-cardText' }, card.text),
                      card.assignee ? h('span', { className: 'tbx-assignee' }, card.assignee) : null,
                      h('button', {
                        type: 'button',
                        className: 'tbx-cardX',
                        'aria-label': t('board.remove', { text: card.text }),
                        onClick: () => removeCards([card.id]),
                      }, '×'),
                    ),
              )),
              dropAt !== null && dropAt.column === column.id && dropAt.index >= cards.length
                ? h('div', { className: 'tbx-drop' })
                : null,
              h(AddCard, { onAdd: (text) => addCard(column.id, text), label: t('board.add') }),
            )
          }),
        ),
      )
    }

    function CommandTab({ t, stop, open, send }) {
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [filter, setFilter] = useState('all')
      const [stopping, setStopping] = useState(null)
      const [composing, setComposing] = useState(null)
      const [draft, setDraft] = useState('')
      const [sending, setSending] = useState(null)
      const [sent, setSent] = useState(null)
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
      // `state` is computed by the Host from the log's own turn events. Fall
      // back to the old liveness flag so a client that reloads before the Host
      // restarts still renders a sane dot instead of a missing label.
      const stateOf = (row) => row.state || (row.active === true ? 'running' : 'idle')
      // A stopped turn is a normal ending, so it never borrows the error style.
      const pillOf = (state) => (state === 'idle' ? null : state)
      // Triage counts are derived from the same rows the list renders, so the
      // filter chips can never disagree with what clicking them shows.
      const counts = { all: data.rows.length, running: 0, waiting: 0, error: 0, stopped: 0 }
      for (const row of data.rows) {
        const state = stateOf(row)
        if (state in counts) counts[state] += 1
      }
      const visible = filter === 'all' ? data.rows : data.rows.filter((row) => stateOf(row) === filter)
      return h(
        'div',
        { className: 'tbx-list' },
        h(
          'div',
          { className: 'tbx-filters', role: 'group', 'aria-label': t('command.filter') },
          ['all', 'running', 'waiting', 'error', 'stopped'].map((key) => h('button', {
            key,
            type: 'button',
            className: 'tbx-chip' + (filter === key ? ' tbx-chipOn' : ''),
            'aria-pressed': filter === key,
            onClick: () => setFilter(key),
          }, `${t(`sessions.state.${key}`)} ${counts[key]}`)),
          data.unreadable > 0
            ? h('span', { className: 'tbx-muted' }, t('sessions.unreadable', { count: String(data.unreadable) }))
            : null,
        ),
        visible.length === 0
          ? h('div', { className: 'tbx-empty' }, t('command.emptyFilter'))
          : null,
        visible.map((row) => h(
          'div',
          { className: 'tbx-row', key: row.id },
          h('span', {
            className: 'tbx-dot'
              + (stateOf(row) === 'running' ? ' tbx-dotOn' : '')
              + (stateOf(row) === 'waiting' ? ' tbx-dotWait' : '')
              + (stateOf(row) === 'error' ? ' tbx-dotErr' : ''),
            title: t(`sessions.state.${stateOf(row)}`),
          }),
          pillOf(stateOf(row)) === null
            ? null
            : h('span', {
                className: 'tbx-state'
                  + (stateOf(row) === 'error' ? ' tbx-stateErr' : '')
                  + (stateOf(row) === 'waiting' ? ' tbx-stateWait' : '')
                  + (stateOf(row) === 'running' ? ' tbx-stateRun' : ''),
                title: row.lastError || t(`sessions.state.${stateOf(row)}`),
              }, row.severity === 'limit' ? t('sessions.state.limit') : t(`sessions.state.${stateOf(row)}`)),
          h(
            'span',
            { className: 'tbx-copy' },
            h('span', { className: 'tbx-name', title: row.id }, row.title),
            h(
              'span',
              { className: 'tbx-desc' },
              `${workspace(row.cwd)} · ${row.model || '—'} · ${row.messages} ${t('sessions.messagesShort')} · ${n(row.tokens)} ${t('sessions.tokensShort')}`,
            ),
            row.lastError !== null && row.lastError !== undefined
              ? h('span', { className: 'tbx-desc tbx-sevError', title: row.lastError }, row.lastError)
              : null,
          ),
          h('button', {
            type: 'button',
            className: 'tbx-btn',
            onClick: () => open(row.id),
          }, t('command.open')),
          stateOf(row) === 'running'
            ? h('button', {
                type: 'button',
                className: 'tbx-btn',
                disabled: stopping === row.id,
                onClick: () => void cancel(row),
              }, stopping === row.id ? t('command.stopping') : t('command.stop'))
            : null,
          h('span', { className: 'tbx-muted' }, ago(row.updatedAt)),
          h('button', {
            type: 'button',
            className: 'tbx-btn',
            onClick: () => {
              setComposing(composing === row.id ? null : row.id)
              setDraft('')
            },
          }, t('command.message')),
          composing === row.id
            ? h('form', {
                className: 'tbx-add',
                style: { flexBasis: '100%', marginTop: 4 },
                onSubmit: async (event) => {
                  event.preventDefault()
                  const text = draft.trim()
                  if (text === '') return
                  setSending(row.id)
                  try {
                    const result = await send(row.id, text, stateOf(row) === 'running')
                    if (result?.ok === false) setError(result.error?.message || t('command.sendFailed'))
                    else {
                      setSent(row.id)
                      setComposing(null)
                      setDraft('')
                      window.setTimeout(() => setSent(null), 2000)
                    }
                  } catch (e) {
                    setError(e.message)
                  } finally {
                    setSending(null)
                  }
                },
              },
                h('input', {
                  autoFocus: true,
                  value: draft,
                  placeholder: stateOf(row) === 'running' ? t('command.steerPlaceholder') : t('command.queuePlaceholder'),
                  'aria-label': t('command.message'),
                  onChange: (event) => setDraft(event.target.value),
                }),
                h('button', { type: 'submit', className: 'tbx-btn', disabled: sending === row.id },
                  sending === row.id ? t('command.sending') : t('command.send')),
              )
            : null,
          sent === row.id ? h('span', { className: 'tbx-muted' }, t('command.sent')) : null,
        )),
      )
    }

    function CommandPage({ t, stop, open, send }) {
      return h(
        'div',
        { className: 'tbx-page' },
        h('div', { className: 'tbx-head' }, h('span', { className: 'tbx-title' }, t('command.title'))),
        h('div', { className: 'tbx-body' },
          h('div', { className: 'tbx-note' }, t('command.note')),
          h(CommandTab, { t, stop, open, send }),
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

    function InsightsPage({ t }) {
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [days, setDays] = useState(30)
      const [reload, setReload] = useState(0)
      const [editing, setEditing] = useState(false)
      const [prices, setPrices] = useState('')
      const [note, setNote] = useState(null)
      const [saving, setSaving] = useState(false)
      useEffect(() => {
        setData(null)
        setError(null)
        fetchJson(`/api/toolbox/insights?days=${days}`).then(setData).catch((e) => setError(e.message))
      }, [days, reload])
      const openPrices = async () => {
        setNote(null)
        try {
          const current = await fetchJson('/api/toolbox/prices')
          setPrices(JSON.stringify(current, null, 2))
        } catch {
          // The Host half only loads at boot, so a freshly copied plugin can
          // reach a page that has no route yet. Start from an empty table
          // rather than replacing the whole panel with an error.
          setPrices('{}')
        }
        setEditing(true)
      }
      const savePrices = async () => {
        let parsed
        try {
          parsed = JSON.parse(prices)
        } catch {
          setNote(t('insights.pricesInvalid'))
          return
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setNote(t('insights.pricesInvalid'))
          return
        }
        setSaving(true)
        try {
          const saved = await fetchJson('/api/toolbox/prices', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(parsed),
          })
          if (saved?.ok === false) throw new Error(saved.error || 'save failed')
          setNote(t('insights.pricesSaved', { count: String(Object.keys(saved.saved || {}).length) }))
          setEditing(false)
          setReload((n) => n + 1)
        } catch (e) {
          setNote(e.message)
        } finally {
          setSaving(false)
        }
      }
      const head = h(
        'div',
        { className: 'tbx-head' },
        h('span', { className: 'tbx-title' }, t('insights.title')),
        h('span', { className: 'tbx-muted' }, t('insights.window', { days: String(days) })),
      )
      if (error) return h('div', { className: 'tbx-page' }, head, h('div', { className: 'tbx-body' }, h('div', { className: 'tbx-error' }, error)))
      if (data === null) return h('div', { className: 'tbx-page' }, head, h('div', { className: 'tbx-body' }, h('div', { className: 'tbx-empty' }, t('loading'))))
      const peak = Math.max(1, ...data.daily.map((day) => day.input + day.output))
      const stat = (label, value) => h(
        'div',
        { className: 'tbx-stat' },
        h('span', { className: 'tbx-statLabel' }, label),
        h('span', { className: 'tbx-statValue' }, value),
      )
      return h(
        'div',
        { className: 'tbx-page' },
        head,
        h(
          'div',
          { className: 'tbx-body' },
          h(
            'div',
            { className: 'tbx-toolbar' },
            [7, 30, 90].map((value) => h('button', {
              key: value,
              type: 'button',
              className: 'tbx-btn',
              'aria-pressed': days === value,
              style: days === value ? { borderColor: 'var(--dsw-alias-state-business-primary)', color: 'var(--dsw-alias-label-primary)' } : undefined,
              onClick: () => setDays(value),
            }, t('insights.days', { days: String(value) }))),
            h('span', { className: 'tbx-muted' }, t('insights.scanned', { count: String(data.scanned) })),
            data.totals.unpriced > 0
              ? h('span', { className: 'tbx-muted' }, t('insights.unpriced', { count: n(data.totals.unpriced) }))
              : null,
            h('button', {
              type: 'button',
              className: 'tbx-btn',
              onClick: () => void openPrices(),
            }, t('insights.prices')),
          ),
          editing
            ? h(
                'div',
                { className: 'tbx-prices' },
                h('div', { className: 'tbx-muted' }, t('insights.pricesHint')),
                h('textarea', {
                  className: 'tbx-pricesText',
                  spellCheck: false,
                  rows: 8,
                  value: prices,
                  onChange: (event) => setPrices(event.target.value),
                  'aria-label': t('insights.prices'),
                }),
                h(
                  'div',
                  { className: 'tbx-filters' },
                  h('button', {
                    type: 'button',
                    className: 'tbx-btn',
                    disabled: saving,
                    onClick: () => void savePrices(),
                  }, saving ? t('board.save') : t('insights.pricesSave')),
                  h('button', {
                    type: 'button',
                    className: 'tbx-btn',
                    onClick: () => { setEditing(false); setNote(null) },
                  }, t('board.cancel')),
                ),
              )
            : null,
          note !== null ? h('span', { className: 'tbx-muted', role: 'status', 'aria-live': 'polite' }, note) : null,
          h(
            'div',
            { className: 'tbx-stats' },
            stat(t('insights.sessions'), String(data.totals.sessions)),
            stat(t('insights.messages'), n(data.totals.messages)),
            stat(t('insights.input'), n(data.totals.input)),
            stat(t('insights.output'), n(data.totals.output)),
            stat(t('insights.cache'), n(data.totals.cache)),
            stat(t('insights.tools'), n(data.totals.tools)),
            stat(t('insights.errors'), n(data.totals.errors)),
            stat(t('insights.cost'), data.totals.cost > 0 ? `$${data.totals.cost.toFixed(2)}` : '—'),
          ),
          data.daily.length === 0
            ? h('div', { className: 'tbx-empty' }, t('insights.empty'))
            : h(
                React.Fragment,
                null,
                h('div', { className: 'tbx-section' }, t('insights.perDay')),
                h(
                  'div',
                  { className: 'tbx-chart', role: 'img', 'aria-label': t('insights.chartLabel') },
                  data.daily.map((day) => h('div', {
                    key: day.date,
                    className: 'tbx-bar',
                    style: { height: `${Math.max(1, Math.round(((day.input + day.output) / peak) * 100))}%` },
                    title: `${day.date} · ${n(day.input + day.output)} ${t('insights.tokens')} · ${day.messages} ${t('sessions.messagesShort')} · ${day.tools} ${t('insights.toolCalls')}`,
                  })),
                ),
                h(
                  'div',
                  { className: 'tbx-chartFoot' },
                  h('span', null, data.daily[0].date),
                  h('span', null, data.daily[data.daily.length - 1].date),
                ),
              ),
          h('div', { className: 'tbx-section' }, t('insights.byModel')),
          h(
            'div',
            { className: 'tbx-list' },
            data.models.length === 0
              ? h('div', { className: 'tbx-empty' }, t('insights.empty'))
              : data.models.map((row) => h(
                  'div',
                  { className: 'tbx-row', key: `${row.provider}/${row.model}` },
                  h('span', { className: 'tbx-copy' },
                    h('span', { className: 'tbx-name' }, h('span', { className: 'tbx-badge' }, row.provider), ' ', row.model),
                    h('span', { className: 'tbx-desc' },
                      `${n(row.messages)} ${t('sessions.messagesShort')} · ${n(row.input)} ${t('insights.inShort')} · ${n(row.output)} ${t('insights.outShort')} · ${n(row.cache)} ${t('providers.cacheShort')} · ${row.errors} ${t('providers.errorsShort')}`
                        + (row.priced > 0 ? ` · $${row.cost.toFixed(2)}` : '')
                        + (row.unpriced > 0 ? ` · ${t('insights.partlyUnpriced', { count: n(row.unpriced) })}` : '')),
                  ),
                )),
          ),
          h('div', { className: 'tbx-section' }, t('insights.byTool')),
          h(
            'div',
            { className: 'tbx-list' },
            data.tools.length === 0
              ? h('div', { className: 'tbx-empty' }, t('insights.empty'))
              : data.tools.slice(0, 20).map((row) => h(
                  'div',
                  { className: 'tbx-row', key: row.name },
                  h('span', { className: 'tbx-name', style: { flex: '0 0 140px' } }, row.name),
                  h('span', { className: 'tbx-desc' }, `${n(row.calls)} ${t('insights.calls')}`),
                  h('span', { className: 'tbx-muted' }, row.errors === 0 ? t('insights.noErrors') : `${row.errors} ${t('providers.errorsShort')}`),
                )),
          ),
        ),
      )
    }

    function LogsPage({ t }) {
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [index, setIndex] = useState(0)
      const [level, setLevel] = useState('all')
      const [tail, setTail] = useState(200)
      const [wrap, setWrap] = useState(true)
      const [auto, setAuto] = useState(false)
      const load = useCallback(() => {
        fetchJson(`/api/toolbox/logs?index=${index}&tail=${tail}&level=${level}`)
          .then((next) => { setData(next); setError(null) })
          .catch((e) => setError(e.message))
      }, [index, tail, level])
      useEffect(load, [load])
      useEffect(() => {
        if (!auto) return undefined
        const id = window.setInterval(load, 5000)
        return () => window.clearInterval(id)
      }, [auto, load])
      const head = h('div', { className: 'tbx-head' }, h('span', { className: 'tbx-title' }, t('logs.title')))
      if (error) return h('div', { className: 'tbx-page' }, head, h('div', { className: 'tbx-body' }, h('div', { className: 'tbx-error' }, error)))
      if (data === null) return h('div', { className: 'tbx-page' }, head, h('div', { className: 'tbx-body' }, h('div', { className: 'tbx-empty' }, t('loading'))))
      if (data.files.length === 0) {
        return h('div', { className: 'tbx-page' }, head, h('div', { className: 'tbx-body' }, h('div', { className: 'tbx-empty' }, t('logs.none'))))
      }
      return h(
        'div',
        { className: 'tbx-page' },
        head,
        h(
          'div',
          { className: 'tbx-body' },
          h(
            'div',
            { className: 'tbx-toolbar' },
            h('select', {
              className: 'tbx-select',
              value: String(index),
              'aria-label': t('logs.file'),
              onChange: (event) => setIndex(Number(event.target.value)),
            }, data.files.map((file, position) => h('option', { key: file.label, value: String(position) }, file.label))),
            h('select', {
              className: 'tbx-select',
              value: level,
              'aria-label': t('logs.level'),
              onChange: (event) => setLevel(event.target.value),
            },
              h('option', { value: 'all' }, t('logs.all')),
              h('option', { value: 'error' }, t('logs.errors')),
              h('option', { value: 'warn' }, t('logs.warnings')),
              h('option', { value: 'info' }, t('logs.info')),
            ),
            h('select', {
              className: 'tbx-select',
              value: String(tail),
              'aria-label': t('logs.tail'),
              onChange: (event) => setTail(Number(event.target.value)),
            }, [100, 200, 500, 1000].map((value) => h('option', { key: value, value: String(value) }, `${value} ${t('logs.lines')}`))),
            h('label', { className: 'tbx-check' },
              h('input', { type: 'checkbox', checked: wrap, onChange: (event) => setWrap(event.target.checked) }),
              t('logs.wrap'),
            ),
            h('label', { className: 'tbx-check' },
              h('input', { type: 'checkbox', checked: auto, onChange: (event) => setAuto(event.target.checked) }),
              t('logs.auto'),
            ),
            h('button', { type: 'button', className: 'tbx-btn', onClick: load }, t('logs.refresh')),
            h('span', { className: 'tbx-muted' }, t('logs.count', { shown: String(data.lines.length), total: String(data.total ?? data.lines.length) })),
          ),
          h(
            'div',
            { className: 'tbx-log' },
            data.lines.length === 0
              ? h('div', { className: 'tbx-empty' }, t('logs.empty'))
              : data.lines.map((line, position) => h(
                  'div',
                  { className: 'tbx-logLine' + (wrap ? '' : ' tbx-logLineNoWrap'), key: position },
                  h('span', { className: 'tbx-sev' + (line.severity === 'error' ? ' tbx-sevError' : line.severity === 'warn' ? ' tbx-sevWarn' : '') }, line.severity),
                  h('span', null, line.text),
                )),
          ),
        ),
      )
    }

    function MemoryPage({ t }) {
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [query, setQuery] = useState('')
      const [draft, setDraft] = useState('')
      const [kind, setKind] = useState('fact')
      const [pin, setPin] = useState(false)
      const [busy, setBusy] = useState(false)
      const load = useCallback(() => {
        fetchJson(`/api/toolbox/memory?q=${encodeURIComponent(query)}`)
          .then((next) => { setData(next); setError(next.error || null) })
          .catch((e) => setError(e.message))
      }, [query])
      useEffect(() => {
        const id = window.setTimeout(load, 200)
        return () => window.clearTimeout(id)
      }, [load])
      const act = async (body) => {
        setBusy(true)
        setError(null)
        try {
          await fetchJson('/api/toolbox/memory', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
          load()
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }
      const head = h('div', { className: 'tbx-head' }, h('span', { className: 'tbx-title' }, t('memory.title')))
      return h(
        'div',
        { className: 'tbx-page' },
        head,
        h(
          'div',
          { className: 'tbx-body' },
          h(
            'div',
            { className: 'tbx-toolbar' },
            h('input', {
              className: 'tbx-search',
              placeholder: t('memory.search'),
              value: query,
              'aria-label': t('memory.search'),
              onChange: (event) => setQuery(event.target.value),
            }),
            data === null ? null : h('span', { className: 'tbx-muted' }, t('memory.count', { count: String(data.total) })),
          ),
          h(
            'form',
            {
              className: 'tbx-addForm',
              onSubmit: (event) => {
                event.preventDefault()
                const text = draft.trim()
                if (text === '') return
                void act({ action: 'add', text, kind, pin }).then(() => { setDraft(''); setPin(false) })
              },
            },
            h('textarea', {
              value: draft,
              placeholder: t('memory.placeholder'),
              'aria-label': t('memory.placeholder'),
              onChange: (event) => setDraft(event.target.value),
            }),
            h(
              'div',
              { className: 'tbx-addRow' },
              h('select', {
                className: 'tbx-select',
                value: kind,
                'aria-label': t('memory.kind'),
                onChange: (event) => setKind(event.target.value),
              }, ['fact', 'pref', 'decision', 'person', 'project', 'lesson'].map((value) => h('option', { key: value, value }, value))),
              h('label', { className: 'tbx-check' },
                h('input', { type: 'checkbox', checked: pin, onChange: (event) => setPin(event.target.checked) }),
                t('memory.pin'),
              ),
              h('button', { type: 'submit', className: 'tbx-btn', disabled: busy || draft.trim() === '' }, t('memory.add')),
            ),
          ),
          error ? h('div', { className: 'tbx-error' }, error) : null,
          data === null
            ? h('div', { className: 'tbx-empty' }, t('loading'))
            : data.notes.length === 0
              ? h('div', { className: 'tbx-empty' }, t('memory.empty'))
              : h(
                  'div',
                  { className: 'tbx-list' },
                  data.notes.map((note) => h(
                    'div',
                    { className: 'tbx-noteRow', key: note.id },
                    h('span', { className: 'tbx-kind' }, note.kind),
                    h('span', { className: 'tbx-noteText' }, note.text),
                    h('button', {
                      type: 'button',
                      className: 'tbx-btn',
                      'aria-pressed': note.pinned === 1,
                      title: note.pinned === 1 ? t('memory.unpin') : t('memory.pin'),
                      onClick: () => void act({ action: 'pin', id: note.id, pinned: note.pinned !== 1 }),
                    }, note.pinned === 1 ? '★' : '☆'),
                    h('button', {
                      type: 'button',
                      className: 'tbx-btn',
                      title: t('memory.forget'),
                      onClick: () => void act({ action: 'forget', ids: [note.id] }),
                    }, '×'),
                  )),
                ),
        ),
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

    /**
     * Header actions: read the last answer aloud, and notify when a turn ends
     * while the window is in the background. Both are opt-in and local — the
     * speech engine is the browser's, and the notification is the OS's.
     */
    function VoiceActions({ sessionId, sessions, t }) {
      const [notify, setNotify] = useState(() => {
        try {
          return window.localStorage.getItem('dsh.toolbox.notify') === '1'
        } catch {
          return false
        }
      })
      const [speaking, setSpeaking] = useState(false)
      const [error, setError] = useState(null)
      const binding = useMemo(() => {
        try {
          return sessions?.binding?.(sessionId)
        } catch {
          return undefined
        }
      }, [sessions, sessionId])
      const subscribe = useCallback(
        (notifyChange) => (binding === undefined ? () => {} : binding.session.subscribe(notifyChange)),
        [binding],
      )
      const snapshot = React.useSyncExternalStore(
        subscribe,
        () => (binding === undefined ? null : binding.session.getSnapshot()),
        () => null,
      )
      const running = snapshot?.running === true
      const wasRunning = useRef(false)

      useEffect(() => {
        if (!notify) {
          wasRunning.current = running
          return
        }
        if (wasRunning.current && !running && document.hidden) {
          try {
            const note = new window.Notification(t('voice.doneTitle'), { body: t('voice.doneBody'), tag: `dsh-${sessionId}` })
            note.onclick = () => window.focus()
          } catch {
            /* notifications unavailable */
          }
        }
        wasRunning.current = running
      }, [running, notify, sessionId, t])

      const speak = async () => {
        setError(null)
        if (typeof window.speechSynthesis === 'undefined') {
          setError(t('voice.unsupported'))
          return
        }
        if (speaking) {
          window.speechSynthesis.cancel()
          setSpeaking(false)
          return
        }
        try {
          const body = await fetchJson(`/api/toolbox/last-message?sessionId=${encodeURIComponent(sessionId)}`)
          const text = String(body.text || '').trim()
          if (text === '') {
            setError(t('voice.empty'))
            return
          }
          const utterance = new window.SpeechSynthesisUtterance(text.slice(0, 4000))
          utterance.onend = () => setSpeaking(false)
          utterance.onerror = () => setSpeaking(false)
          setSpeaking(true)
          window.speechSynthesis.speak(utterance)
        } catch (e) {
          setError(e.message)
          setSpeaking(false)
        }
      }

      const toggleNotify = async () => {
        const next = !notify
        if (next && typeof window.Notification !== 'undefined' && window.Notification.permission === 'default') {
          try {
            await window.Notification.requestPermission()
          } catch {
            /* denied */
          }
        }
        setNotify(next)
        try {
          window.localStorage.setItem('dsh.toolbox.notify', next ? '1' : '0')
        } catch {
          /* storage unavailable */
        }
      }

      return h(
        'div',
        { className: 'tbx-voice' },
        h('button', {
          type: 'button',
          className: 'tbx-voiceBtn',
          'aria-pressed': speaking,
          title: error || t('voice.read'),
          onClick: () => void speak(),
        }, speaking ? '■' : '▶'),
        h('button', {
          type: 'button',
          className: 'tbx-voiceBtn' + (notify ? ' tbx-voiceOn' : ''),
          'aria-pressed': notify,
          title: t('voice.notify'),
          onClick: () => void toggleNotify(),
        }, '◔'),
      )
    }

    const InsightsIcon = () => h(
      'svg',
      { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      h('path', {
        d: 'M2.5 13.5V9M6 13.5V5.5M9.5 13.5V7.5M13 13.5V3',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
      }),
    )

    const LogsIcon = () => h(
      'svg',
      { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      h('path', {
        d: 'M2.5 4h11M2.5 8h11M2.5 12h7',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
      }),
    )

    const MemoryIcon = () => h(
      'svg',
      { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      h('path', {
        d: 'M4 2.5h8v11l-4-2.6-4 2.6z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.2,
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
      'command.note': 'Every durable session with its model, message count, token total and last write. Open switches the main view to that session; Stop cancels an active turn.',
      'command.empty': 'No sessions found.',
      'command.open': 'Open',
      'command.message': 'Message',
      'command.send': 'Send',
      'command.sending': 'Sending…',
      'command.sent': 'Sent.',
      'command.sendFailed': 'The session did not accept the message.',
      'command.steerPlaceholder': 'Steer this running session…',
      'command.queuePlaceholder': 'Queue a message for this session…',
      'command.stop': 'Stop',
      'command.stopping': 'Stopping…',
      'command.stopFailed': 'The session did not accept the stop request.',
      'insights.title': 'Insights',
      'insights.window': 'last {days} days',
      'insights.days': '{days}d',
      'insights.scanned': '{count} session logs scanned',
      'insights.sessions': 'Sessions',
      'insights.messages': 'Messages',
      'insights.input': 'Input tokens',
      'insights.output': 'Output tokens',
      'insights.cache': 'Cache read',
      'insights.tools': 'Tool calls',
      'insights.errors': 'Tool errors',
      'insights.cost': 'Cost (priced only)',
      'insights.unpriced': '{count} messages from models with no price set',
      'insights.partlyUnpriced': '{count} unpriced',
      'insights.prices': 'Set prices…',
      'insights.pricesHint': 'USD per million tokens, keyed "<provider>/<model>". Anything absent is counted as unpriced instead of guessed.',
      'insights.pricesSave': 'Save prices',
      'insights.pricesSaved': 'Saved {count} price(s).',
      'insights.pricesInvalid': 'That is not a JSON object.',
      'insights.perDay': 'Tokens per day',
      'insights.chartLabel': 'Daily token usage',
      'insights.tokens': 'tokens',
      'insights.toolCalls': 'tool calls',
      'insights.byModel': 'By model',
      'insights.byTool': 'By tool',
      'insights.inShort': 'in',
      'insights.outShort': 'out',
      'insights.calls': 'calls',
      'insights.noErrors': 'no errors',
      'insights.empty': 'Nothing recorded in this window.',
      'logs.title': 'Logs',
      'logs.file': 'Log file',
      'logs.level': 'Severity',
      'logs.all': 'All levels',
      'logs.errors': 'Errors',
      'logs.warnings': 'Warnings',
      'logs.info': 'Info',
      'logs.tail': 'Lines',
      'logs.lines': 'lines',
      'logs.wrap': 'Wrap',
      'logs.auto': 'Auto',
      'logs.refresh': 'Refresh',
      'logs.count': '{shown} of {total}',
      'logs.empty': 'No lines at this level.',
      'logs.none': 'No log files found under ~/.dsh or ~/Library/Logs.',
      'memory.title': 'Memory',
      'memory.search': 'Search notes',
      'memory.count': '{count} notes',
      'memory.placeholder': 'One standalone sentence worth keeping…',
      'memory.kind': 'Kind',
      'memory.pin': 'Pin',
      'memory.unpin': 'Unpin',
      'memory.add': 'Add note',
      'memory.forget': 'Forget this note',
      'memory.empty': 'No notes match.',
      'voice.read': 'Read the last answer aloud',
      'voice.notify': 'Notify when a turn finishes in the background',
      'voice.doneTitle': 'Turn finished',
      'voice.doneBody': 'The agent finished while you were away.',
      'voice.empty': 'No answer to read yet.',
      'voice.unsupported': 'This browser has no speech engine.',
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
      'sessions.state.running': 'running',
      'sessions.state.waiting': 'waiting',
      'sessions.state.error': 'error',
      'sessions.state.limit': 'rate limit',
      'sessions.state.idle': 'idle',
      'sessions.state.all': 'all',
      'sessions.state.stopped': 'stopped',
      'sessions.unreadable': '{count} log(s) could not be read',
      'command.filter': 'Filter sessions',
      'command.emptyFilter': 'No session in this state.',
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
      'skills.preview': 'Show the skill body',
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
      'providers.tokensShort': 'tokens',
      'providers.cacheShort': 'cache',
      'providers.errorsShort': 'errors',
      'providers.responseTitle': 'Mean request to message',
      'providers.testing': 'Testing…',
      'providers.testFailed': 'failed',
      'providers.empty': 'No model calls recorded yet.',
      'board.note': 'Drag cards between columns. Saved to ~/.dsh/toolbox/board.json.',
      'board.saved': 'Saved.',
      'board.newName': 'Board {count}',
      'board.todo': 'Todo',
      'board.doing': 'Doing',
      'board.done': 'Done',
      'board.switch': 'Switch board',
      'board.rename': 'Rename',
      'board.new': 'New board',
      'board.delete': 'Delete board',
      'board.showArchived': 'Archived',
      'board.selected': '{count} selected',
      'board.moveTo': 'Move to…',
      'board.archive': 'Archive',
      'board.removeSelected': 'Delete',
      'board.clear': 'Clear',
      'board.cardText': 'Card text',
      'board.assignee': 'Assignee',
      'board.priority': 'Priority',
      'board.priority.low': 'Low',
      'board.priority.normal': 'Normal',
      'board.priority.high': 'High',
      'board.save': 'Save',
      'board.cancel': 'Cancel',
      'board.select': 'Select {text}',
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
      'command.note': '每个持久会话的模型、消息数、token 总量与最近写入。打开会切换到该会话；停止会取消正在进行的回合。',
      'command.empty': '没有会话。',
      'command.open': '打开',
      'command.message': '消息',
      'command.send': '发送',
      'command.sending': '发送中…',
      'command.sent': '已发送。',
      'command.sendFailed': '会话没有接受该消息。',
      'command.steerPlaceholder': '引导这个正在运行的会话…',
      'command.queuePlaceholder': '为这个会话排队一条消息…',
      'command.stop': '停止',
      'command.stopping': '停止中…',
      'command.stopFailed': '会话没有接受停止请求。',
      'insights.title': '洞察',
      'insights.window': '最近 {days} 天',
      'insights.days': '{days}天',
      'insights.scanned': '已扫描 {count} 个会话日志',
      'insights.sessions': '会话',
      'insights.messages': '消息',
      'insights.input': '输入 token',
      'insights.output': '输出 token',
      'insights.cache': '缓存读取',
      'insights.tools': '工具调用',
      'insights.errors': '工具错误',
      'insights.cost': '费用（仅已定价）',
      'insights.unpriced': '{count} 条消息来自未定价的模型',
      'insights.partlyUnpriced': '{count} 条未定价',
      'insights.prices': '设置价格…',
      'insights.pricesHint': '美元 / 百万 token，键为 "<provider>/<model>"。未列出的模型计为未定价，不做猜测。',
      'insights.pricesSave': '保存价格',
      'insights.pricesSaved': '已保存 {count} 条价格。',
      'insights.pricesInvalid': '这不是一个 JSON 对象。',
      'insights.perDay': '每日 token',
      'insights.chartLabel': '每日 token 用量',
      'insights.tokens': 'token',
      'insights.toolCalls': '次工具调用',
      'insights.byModel': '按模型',
      'insights.byTool': '按工具',
      'insights.inShort': '入',
      'insights.outShort': '出',
      'insights.calls': '次',
      'insights.noErrors': '无错误',
      'insights.empty': '该时间窗口内没有记录。',
      'logs.title': '日志',
      'logs.file': '日志文件',
      'logs.level': '级别',
      'logs.all': '全部级别',
      'logs.errors': '错误',
      'logs.warnings': '警告',
      'logs.info': '信息',
      'logs.tail': '行数',
      'logs.lines': '行',
      'logs.wrap': '换行',
      'logs.auto': '自动',
      'logs.refresh': '刷新',
      'logs.count': '{shown} / {total}',
      'logs.empty': '该级别没有日志行。',
      'logs.none': '在 ~/.dsh 或 ~/Library/Logs 下没有找到日志文件。',
      'memory.title': '记忆',
      'memory.search': '搜索笔记',
      'memory.count': '{count} 条笔记',
      'memory.placeholder': '一句值得长期保留的独立陈述…',
      'memory.kind': '类型',
      'memory.pin': '置顶',
      'memory.unpin': '取消置顶',
      'memory.add': '添加笔记',
      'memory.forget': '删除这条笔记',
      'memory.empty': '没有匹配的笔记。',
      'voice.read': '朗读上一条回答',
      'voice.notify': '后台完成时通知',
      'voice.doneTitle': '回合完成',
      'voice.doneBody': '你离开时 agent 已完成。',
      'voice.empty': '还没有可朗读的回答。',
      'voice.unsupported': '此浏览器没有语音引擎。',
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
      'sessions.state.running': '运行中',
      'sessions.state.waiting': '待确认',
      'sessions.state.error': '出错',
      'sessions.state.limit': '限流',
      'sessions.state.idle': '空闲',
      'sessions.state.all': '全部',
      'sessions.state.stopped': '已停止',
      'sessions.unreadable': '{count} 个日志无法读取',
      'command.filter': '筛选会话',
      'command.emptyFilter': '该状态下没有会话。',
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
      'skills.preview': '查看技能正文',
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
      'providers.tokensShort': 'token',
      'providers.cacheShort': '缓存',
      'providers.errorsShort': '错误',
      'providers.responseTitle': '请求到消息的平均耗时',
      'providers.testing': '测试中…',
      'providers.testFailed': '失败',
      'providers.empty': '还没有模型调用记录。',
      'board.note': '拖动卡片到其他列。保存于 ~/.dsh/toolbox/board.json。',
      'board.saved': '已保存。',
      'board.newName': '看板 {count}',
      'board.todo': '待办',
      'board.doing': '进行中',
      'board.done': '完成',
      'board.switch': '切换看板',
      'board.rename': '重命名',
      'board.new': '新建看板',
      'board.delete': '删除看板',
      'board.showArchived': '已归档',
      'board.selected': '已选 {count} 项',
      'board.moveTo': '移动到…',
      'board.archive': '归档',
      'board.removeSelected': '删除',
      'board.clear': '清除',
      'board.cardText': '卡片内容',
      'board.assignee': '负责人',
      'board.priority': '优先级',
      'board.priority.low': '低',
      'board.priority.normal': '普通',
      'board.priority.high': '高',
      'board.save': '保存',
      'board.cancel': '取消',
      'board.select': '选择 {text}',
      'board.add': '添加卡片',
      'board.remove': '删除 {text}',
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'toolbox: dictionaries')
      const t = ctx.locale.bind(NS)
      const stopSession = (sessionId) => ctx.remote.session.cancel({ sessionId })
      const sendPrompt = (sessionId, text, active) =>
        ctx.remote.session.prompt({
          requestId: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`),
          sessionId,
          mode: active ? 'steer' : 'queue',
          content: [{ type: 'text', text }],
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      let openSession = () => {}
      ctx.inject(['uiWorkspace'], (scope) => {
        openSession = (sessionId) => scope.uiWorkspace.openSession(sessionId)
      })
      const rows = [
        { key: 'skills', order: 23, label: 'skills.title', icon: SkillsIcon },
        { key: 'providers', order: 24, label: 'providers.title', icon: ProvidersIcon },
        { key: 'kanban', order: 25, label: 'kanban.title', icon: KanbanIcon },
        { key: 'command', order: 26, label: 'command.title', icon: CommandIcon },
        { key: 'insights', order: 27, label: 'insights.title', icon: InsightsIcon },
        { key: 'logs', order: 28, label: 'logs.title', icon: LogsIcon },
        { key: 'memory', order: 29, label: 'memory.title', icon: MemoryIcon },
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
        command: (props) => h(CommandPage, { ...props, stop: stopSession, open: (id) => openSession(id), send: sendPrompt }),
        insights: InsightsPage,
        logs: LogsPage,
        memory: MemoryPage,
      }
      for (const key of Object.keys(pages)) {
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key, locale: NS }, pages[key]),
        )
      }
      ctx.slots.inject('conversation.session.header.actions', () =>
        ctx.slots.register(
          {
            name: 'conversation.session.header.actions',
            id: 'toolbox-voice',
            order: 30,
            locale: NS,
            inject: () => ({ sessions: ctx.sessions }),
          },
          VoiceActions,
        ),
      )
    }

    return { inject: ['slots', 'locale', 'remote', 'remote.session', 'sessions', 'workspaces'], apply }
  },
})
