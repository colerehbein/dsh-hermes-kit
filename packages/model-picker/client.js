/**
 * Hermes-style model picker for the DSH composer.
 *
 * The shape is lifted from the Hermes desktop app's model menu
 * (apps/desktop/src/app/shell/model-catalog-menu.tsx): one searchable panel
 * instead of drilled menus, a Favorites section above the providers, provider
 * groups that collapse, a star on every row (Shift+Enter from the keyboard),
 * per-model reasoning levels one key away, and a check on the active model.
 *
 * It registers into `conversation.input.model`, the composer's single model
 * seat. A dynamically registered entry shadows the shipped occupant, so this
 * replaces the stock two-level menu while keeping the same injected face
 * (the shared per-session ModelDirectory store and its select verb).
 */
window.__ModuleLoader__.load({
  id: '@dsh-local/hermes-model-picker',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    /** Locale namespace owned by this plugin. */
    const NS = 'hermesModelPicker'
    /** localStorage key of starred provider::model pairs. */
    const FAV_KEY = 'dsh.hermes-model-picker.favorites'
    /** localStorage key of collapsed provider ids. */
    /** localStorage key of explicitly visible family keys; null = never curated. */
    const VISIBLE_KEY = 'dsh.hermes-model-picker.visible'
    /** localStorage key of keys judged at the last save, so new arrivals default on. */
    const KNOWN_KEY = 'dsh.hermes-model-picker.known'
    const COLLAPSE_KEY = 'dsh.hermes-model-picker.collapsed'
    /** Unique stylesheet tag so a reload does not append a second copy. */
    const CSS_TAG = '@dsh-local/hermes-model-picker/picker.css'

    const css = `
.dsh-hmp-root{position:relative;min-width:0}
.dsh-hmp-trigger{border-radius:var(--dsw-radius-sm);min-width:0;max-width:360px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:400;line-height:20px;display:flex}
.dsh-hmp-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-hmp-trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}
.dsh-hmp-trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
.dsh-hmp-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}
.dsh-hmp-caption{color:var(--dsw-alias-label-caption);flex-shrink:1000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dsh-hmp-chev{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}
.dsh-hmp-chevOpen{transform:rotate(180deg)}
.dsh-hmp-panel{position:fixed;z-index:1100;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;padding:4px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}
.dsh-hmp-searchRow{flex-shrink:0;position:relative;margin:2px 0 3px}
.dsh-hmp-search{box-sizing:border-box;width:100%;border-radius:var(--dsw-radius-md);background:0 0;border:0;padding:5px 30px 5px 7px;font-size:12px;line-height:normal;color:var(--dsw-alias-label-primary);outline:none}
.dsh-hmp-search::placeholder{color:var(--dsw-alias-label-caption)}
.dsh-hmp-clear{width:22px;height:22px;border-radius:50%;border:none;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;position:absolute;top:50%;right:4px;transform:translateY(-50%)}
.dsh-hmp-clear:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-hmp-list{min-height:0;overflow:hidden auto;padding-bottom:2px}
.dsh-hmp-section{padding:7px 8px 3px;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.dsh-hmp-groupHead{display:flex;align-items:center;gap:4px;width:100%;box-sizing:border-box;border:none;background:0 0;border-radius:var(--dsw-radius-sm);padding:5px 7px;margin-top:3px;cursor:pointer;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:left}
.dsh-hmp-groupHead:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-hmp-groupHead:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dsh-hmp-count{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-caption);font-weight:400;letter-spacing:0}
.dsh-hmp-row{display:flex;align-items:center;gap:4px;width:100%;box-sizing:border-box;min-height:34px;border:none;background:0 0;border-radius:var(--dsw-radius-md);padding:4px 7px 4px 3px;cursor:pointer;text-align:left;color:inherit;font:inherit}
.dsh-hmp-row:hover,.dsh-hmp-rowActive{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-hmp-row:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dsh-hmp-star{flex:none;width:24px;height:24px;border:none;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-caption);opacity:.45;cursor:pointer;display:grid;place-items:center;padding:0}
.dsh-hmp-star:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover)}
.dsh-hmp-starOn{opacity:1;color:var(--dsw-alias-label-primary)}
.dsh-hmp-star:focus-visible{opacity:1;outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dsh-hmp-copy{display:flex;flex-direction:column;flex:1;min-width:0;gap:1px}
.dsh-hmp-name{display:flex;align-items:center;gap:5px;min-width:0;font-size:13px;line-height:18px}
.dsh-hmp-nameText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dsh-hmp-hit{color:var(--dsw-alias-state-business-primary);font-weight:500}
.dsh-hmp-badge{flex:none;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 5px;font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary)}
.dsh-hmp-desc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:15px;color:var(--dsw-alias-label-caption)}
.dsh-hmp-effortChip{flex:none;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;padding:0 6px;cursor:pointer}
.dsh-hmp-effortChip:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.dsh-hmp-effortChip:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-1px}
.dsh-hmp-check{flex:0 0 16px;display:grid;place-items:center;color:var(--dsw-alias-label-primary)}
.dsh-hmp-efforts{padding:2px 0 4px 30px;display:flex;flex-wrap:wrap;gap:4px}
.dsh-hmp-effortOpt{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;padding:1px 8px;cursor:pointer}
.dsh-hmp-effortOpt:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-hmp-effortOpt:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dsh-hmp-effortOptOn{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary)}
.dsh-hmp-note{margin:2px 4px 4px;padding:6px 7px;border-radius:var(--dsw-radius-md);font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-module-platform)}
.dsh-hmp-error{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-interactive-bg-hover-danger)}
.dsh-hmp-retry{border:none;background:0 0;padding:0;font:inherit;font-weight:600;color:inherit;cursor:pointer;text-decoration:underline}
.dsh-hmp-empty{padding:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dsh-hmp-foot{flex-shrink:0;display:flex;flex-direction:column;gap:2px;padding:5px 8px 3px;border-top:1px solid var(--dsw-alias-border-l1);margin-top:3px;font-size:10px;color:var(--dsw-alias-label-caption)}
.dsh-hmp-hints{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dsh-hmp-footAction{display:flex;justify-content:flex-end}
.dsh-hmp-kbd{border:1px solid var(--dsw-alias-border-l1);border-radius:3px;padding:0 3px;font-size:10px;color:var(--dsw-alias-label-tertiary)}
.dsh-hmp-editHead{display:flex;align-items:center;justify-content:space-between;padding:2px 6px 4px;color:var(--dsw-alias-label-primary);font-size:12px;font-weight:500}
.dsh-hmp-footBtn{border:none;background:0 0;color:var(--dsw-alias-state-business-primary);font:inherit;font-size:11px;cursor:pointer;padding:2px 5px;border-radius:var(--dsw-radius-sm)}
.dsh-hmp-footBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-hmp-footBtn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dsh-hmp-editProvider{display:flex;align-items:center;gap:4px}
.dsh-hmp-pcheck{flex:none;width:19px;height:19px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:0 0;color:var(--dsw-alias-label-primary);display:grid;place-items:center;cursor:pointer;padding:0;margin-left:4px}
.dsh-hmp-pcheck[aria-checked="true"]{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:#fff}
.dsh-hmp-pcheck[aria-checked="mixed"]{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.dsh-hmp-minus{font-size:12px;line-height:1}
.dsh-hmp-editRow{display:flex;align-items:center;gap:6px;padding:3px 7px 3px 12px;border-radius:var(--dsw-radius-sm)}
.dsh-hmp-editRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-hmp-editName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.dsh-hmp-switch{flex:none;width:30px;height:18px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);cursor:pointer;padding:0;position:relative;transition:background .12s}
.dsh-hmp-switchOn{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.dsh-hmp-switch:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dsh-hmp-knob{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:transform .12s}
.dsh-hmp-switchOn .dsh-hmp-knob{transform:translateX(12px)}
.dsh-hmp-editFoot{display:flex;justify-content:flex-end;padding:4px 6px 2px;border-top:1px solid var(--dsw-alias-border-l1);margin-top:3px}
.dsh-hmp-editPane{position:absolute;inset:0;z-index:2;box-sizing:border-box;display:flex;flex-direction:column;padding:4px;background:var(--dsw-alias-bg-layer-2);border-radius:var(--dsw-radius-md)}
.dsh-hmp-editCount{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary);font-weight:400;letter-spacing:0}
`
    if (
      typeof document !== 'undefined' &&
      document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']') === null
    ) {
      const tag = document.createElement('style')
      tag.dataset.plugin = '@dsh-local/hermes-model-picker'
      tag.dataset.pluginCss = CSS_TAG
      tag.textContent = css
      document.head.appendChild(tag)
    }

    /** Read one string array preference; a broken value reads as empty. */
    function readList(key) {
      try {
        const value = JSON.parse(window.localStorage.getItem(key) || '[]')
        return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
      } catch {
        return []
      }
    }

    /** Persist one string array preference; storage refusal is not fatal. */
    function writeList(key, list) {
      try {
        window.localStorage.setItem(key, JSON.stringify(list))
      } catch {
        /* private mode / quota: favorites simply do not survive a reload */
      }
    }

    /** Stable identity for one provider's model. */
    function pairKey(provider, model) {
      return provider + '\u0000' + model
    }

    /** Read one nullable string array preference; absent reads as null. */
    function readSet(key) {
      try {
        const raw = window.localStorage.getItem(key)
        if (raw === null) return null
        const value = JSON.parse(raw)
        return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : null
      } catch {
        return null
      }
    }

    /** Persist one nullable string array preference. */
    function writeSet(key, list) {
      try {
        if (list === null) window.localStorage.removeItem(key)
        else window.localStorage.setItem(key, JSON.stringify(list))
      } catch {
        /* storage refusal only costs persistence across reloads */
      }
    }

    /** Stable catalog key for one model: `provider::model`. */
    function familyKey(provider, model) {
      return provider + '::' + model
    }

    /** Bookkeeping key recording "this provider was hidden outright". */
    function sentinelFor(provider) {
      return provider + '::'
    }

    /** Whether a stored key is a provider-hide sentinel. */
    function isSentinel(key) {
      return key.endsWith('::')
    }

    /** Every model key across the catalog. */
    function allModelKeys(groups) {
      const keys = new Set()
      for (const group of groups) for (const model of group.models) keys.add(familyKey(group.id, model.id))
      return keys
    }

    /**
     * Working visibility set, sentinels included — the shape toggles mutate and
     * persist. Never curated means every model; a provider with no stored key
     * keeps all its models; a provider whose hide-all sentinel is present stays
     * hidden; models absent from the `known` snapshot arrived after the last
     * save and are admitted rather than silently switched off.
     */
    function resolveVisible(stored, groups, known) {
      if (stored === null) return allModelKeys(groups)
      const next = new Set(stored)
      for (const group of groups) {
        if (next.has(sentinelFor(group.id))) continue
        const prefix = group.id + '::'
        let curated = false
        for (const key of next) if (key.startsWith(prefix) && !isSentinel(key)) curated = true
        for (const model of group.models) {
          const key = familyKey(group.id, model.id)
          if (!curated) next.add(key)
          else if (known !== null && !known.has(key)) next.add(key)
        }
      }
      return next
    }

    /** Display visibility set: the working set with bookkeeping sentinels removed. */
    function effectiveVisible(stored, groups, known) {
      const next = resolveVisible(stored, groups, known)
      for (const key of [...next]) if (isSentinel(key)) next.delete(key)
      return next
    }

    /** Next stored set when one model's switch is flipped. */
    function toggleVisible(stored, groups, known, provider, model) {
      const next = resolveVisible(stored, groups, known)
      const key = familyKey(provider, model)
      if (next.has(key)) {
        next.delete(key)
        let remaining = false
        for (const candidate of next) if (candidate.startsWith(provider + '::') && !isSentinel(candidate)) remaining = true
        if (!remaining) next.add(sentinelFor(provider))
      } else {
        next.delete(sentinelFor(provider))
        next.add(key)
      }
      return [...next]
    }

    /** Next stored set when a provider's master switch is flipped. */
    function setProviderVisible(stored, groups, known, provider, on) {
      const next = resolveVisible(stored, groups, known)
      for (const key of [...next]) if (key.startsWith(provider + '::')) next.delete(key)
      const group = groups.find((candidate) => candidate.id === provider)
      if (on === true && group !== undefined) for (const model of group.models) next.add(familyKey(provider, model.id))
      else next.add(sentinelFor(provider))
      return [...next]
    }

    /**
     * Ordered-subsequence match with the bonuses Hermes uses: exact, then
     * prefix, then word-start, then bare subsequence.
     * @param text - haystack.
     * @param query - lowercased needle.
     * @returns matched indices and a sort score, or null for no match.
     */
    function matchModel(text, query) {
      if (query === '') return { hits: [], score: 0 }
      const lower = text.toLowerCase()
      if (lower === query) return { hits: indexRange(0, query.length), score: 0 }
      if (lower.startsWith(query)) return { hits: indexRange(0, query.length), score: 1 }
      const hits = []
      let at = 0
      for (let index = 0; index < lower.length && at < query.length; index += 1) {
        if (lower[index] === query[at]) {
          hits.push(index)
          at += 1
        }
      }
      if (at < query.length) return null
      const before = hits[0] === 0 ? '' : lower[hits[0] - 1]
      const boundary = before === '' || /[\s\-_/.:]/.test(before)
      return { hits, score: boundary ? 2 : 3 }
    }

    /** Consecutive indices for a matched prefix. */
    function indexRange(start, length) {
      const out = []
      for (let index = 0; index < length; index += 1) out.push(start + index)
      return out
    }

    /**
     * Contiguous match used by the visibility editor, where substring search is
     * the right tool: Hermes filters that dialog by containment, not by an
     * ordered subsequence, so "glm" must not match a model whose letters happen
     * to sit in "Command Code".
     */
    function substringMatch(text, query) {
      if (query === '') return { hits: [], score: 0 }
      const at = text.toLowerCase().indexOf(query)
      if (at >= 0) return { hits: indexRange(at, query.length), score: 0 }
      return null
    }

    /** Name with matched characters marked. */
    function Highlighted({ hits, text }) {
      if (hits.length === 0) return h('span', { className: 'dsh-hmp-nameText' }, text)
      const set = new Set(hits)
      const parts = []
      let run = ''
      let runHit = null
      for (let index = 0; index < text.length; index += 1) {
        const hit = set.has(index)
        if (runHit !== null && hit !== runHit) {
          parts.push(
            runHit
              ? h('span', { className: 'dsh-hmp-hit', key: `h${parts.length}` }, run)
              : h('span', { key: `t${parts.length}` }, run),
          )
          run = ''
        }
        runHit = hit
        run += text[index]
      }
      if (run !== '') {
        parts.push(
          runHit
            ? h('span', { className: 'dsh-hmp-hit', key: `h${parts.length}` }, run)
            : h('span', { key: `t${parts.length}` }, run),
        )
      }
      return h('span', { className: 'dsh-hmp-nameText' }, parts)
    }

    const StarIcon = ({ filled }) =>
      h(
        'svg',
        { width: 13, height: 13, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        h('path', {
          d: 'M8 1.6l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6z',
          fill: filled ? 'currentColor' : 'none',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }),
      )

    const CheckIcon = () =>
      h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        h('path', {
          d: 'M3.2 8.4l3 3 6.6-6.8',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )

    const ChevronIcon = ({ open }) =>
      h(
        'svg',
        { className: open ? 'dsh-hmp-chev dsh-hmp-chevOpen' : 'dsh-hmp-chev', width: 12, height: 12, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        h('path', {
          d: 'M4 6l4 4 4-4',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )

    const CloseIcon = () =>
      h(
        'svg',
        { width: 12, height: 12, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        h('path', {
          d: 'M4 4l8 8M12 4l-8 8',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
      )

    /**
     * Reasoning caption for a model, in the menu's vocabulary.
     * @param reasoning - the model's reasoning metadata, when it has any.
     * @param effort - selected level id.
     * @param t - locale binder.
     * @returns display text, or undefined for a non-reasoning model.
     */
    function effortCaption(reasoning, effort, t) {
      if (reasoning === undefined) return undefined
      if (effort === undefined) return t('effort.default')
      const found = (reasoning.efforts || []).find((level) => level.id === effort)
      return found === undefined ? effort : found.name
    }

    /** Composer model seat: trigger plus the Hermes-style catalog panel. */
    function ModelPicker(props) {
      const { locked, available, directory, load, select, resolveText, t } = props
      const subscribe = useCallback((notify) => directory.subscribe(notify), [directory])
      const state = useSyncExternalStore(subscribe, () => directory.getSnapshot())
      const [open, setOpen] = useState(false)
      const [query, setQuery] = useState('')
      const [activeKey, setActiveKey] = useState(null)
      const [effortFor, setEffortFor] = useState(null)
      const [favorites, setFavorites] = useState(() => readList(FAV_KEY))
      const [collapsed, setCollapsed] = useState(() => readList(COLLAPSE_KEY))
      const [visible, setVisible] = useState(() => readSet(VISIBLE_KEY))
      const [known, setKnown] = useState(() => readSet(KNOWN_KEY))
      const [mode, setMode] = useState('pick')
      const [selectError, setSelectError] = useState(null)
      const [placement, setPlacement] = useState(null)
      const rootRef = useRef(null)
      const panelRef = useRef(null)
      const inputRef = useRef(null)
      const editInputRef = useRef(null)
      const listRef = useRef(null)

      const providerName = useCallback(
        (group) => (group.id === 'deepseek-account' ? t('provider.account') : group.name),
        [t],
      )

      const groups = useMemo(() => {
        const ordered = (state.groups || []).slice()
        ordered.sort((left, right) => {
          const rank = (id) => (id === 'deepseek-account' ? 0 : id === 'deepseek-official' ? 1 : 2)
          return rank(left.id) - rank(right.id)
        })
        return ordered
      }, [state.groups])

      const storedVisible = useMemo(() => (visible === null ? null : new Set(visible)), [visible])
      const storedKnown = useMemo(() => (known === null ? null : new Set(known)), [known])
      const visibleKeys = useMemo(
        () => effectiveVisible(storedVisible, groups, storedKnown),
        [storedVisible, groups, storedKnown],
      )
      const applyVisible = useCallback(
        (next) => {
          setVisible(next)
          writeSet(VISIBLE_KEY, next)
          if (next === null) return
          const merged = new Set(known ?? [])
          for (const key of allModelKeys(groups)) merged.add(key)
          const snapshot = [...merged]
          setKnown(snapshot)
          writeSet(KNOWN_KEY, snapshot)
        },
        [groups, known],
      )

      const currentGroup = groups.find((group) => group.id === state.current?.provider)
      const currentModel = currentGroup?.models.find((model) => model.id === state.current?.model)
      const currentLabel = currentModel?.name ?? state.current?.model ?? t('trigger.none')
      const currentEffort = effortCaption(currentModel?.reasoning, state.current?.reasoningEffort ?? currentModel?.reasoning?.defaultEffort, t)

      const loadRef = useRef(load)
      loadRef.current = load
      useEffect(() => {
        if (open) loadRef.current()
      }, [open])

      useEffect(() => {
        if (!open) return undefined
        const onDown = (event) => {
          if (rootRef.current?.contains(event.target) === true) return
          if (panelRef.current?.contains(event.target) === true) return
          setOpen(false)
        }
        const onResize = () => setOpen(false)
        document.addEventListener('mousedown', onDown)
        window.addEventListener('resize', onResize)
        return () => {
          document.removeEventListener('mousedown', onDown)
          window.removeEventListener('resize', onResize)
        }
      }, [open])

      const measure = useCallback(() => {
        const trigger = rootRef.current?.querySelector('button')
        if (trigger === null || trigger === undefined) return
        const rect = trigger.getBoundingClientRect()
        const width = Math.min(400, Math.max(280, rect.width + 160), window.innerWidth - 24)
        const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
        const above = rect.top > 220
        setPlacement({ above, left, width, anchor: rect.top, bottom: rect.bottom })
      }, [])

      useLayoutEffect(() => {
        if (!open) {
          setPlacement(null)
          return
        }
        measure()
        const frame = requestAnimationFrame(() => inputRef.current?.focus())
        return () => cancelAnimationFrame(frame)
      }, [open, measure])

      const normalized = query.trim().toLowerCase()

      const ordered = useMemo(() => {
        const favoritesSet = new Set(favorites)
        return groups.map((group) => {
          const models = group.models
            .map((model) => {
              const match = matchModel(model.name || model.id, normalized)
              return match === null ? null : { group, model, match }
            })
            .filter((entry) => entry !== null)
            .sort((left, right) => left.match.score - right.match.score)
            .filter((entry) => visibleKeys.has(familyKey(group.id, entry.model.id)))
            .filter((entry) => normalized !== '' || !favoritesSet.has(pairKey(group.id, entry.model.id)))
          return { group, models }
        })
      }, [groups, normalized, favorites, visibleKeys])

      const favoriteRows = useMemo(() => {
        if (normalized !== '') return []
        const rows = []
        for (const key of favorites) {
          for (const group of groups) {
            const model = group.models.find((candidate) => pairKey(group.id, candidate.id) === key)
            if (model !== undefined) {
              rows.push({ group, model, match: { hits: [], score: 0 } })
              break
            }
          }
        }
        return rows
      }, [favorites, groups, normalized])

      const visibleGroups = ordered.filter((entry) => entry.models.length > 0)

      const rows = useMemo(() => {
        const all = [...favoriteRows]
        for (const entry of visibleGroups) {
          if (normalized === '' && collapsed.includes(entry.group.id)) continue
          all.push(...entry.models)
        }
        return all
      }, [favoriteRows, visibleGroups, collapsed, normalized])

      useEffect(() => {
        if (!open) return
        if (activeKey !== null && rows.some((row) => pairKey(row.group.id, row.model.id) === activeKey)) return
        const currentIndex = rows.findIndex(
          (row) => row.group.id === state.current?.provider && row.model.id === state.current?.model,
        )
        const first = rows[currentIndex >= 0 ? currentIndex : 0]
        setActiveKey(first === undefined ? null : pairKey(first.group.id, first.model.id))
      }, [open, rows, activeKey, state.current])

      useEffect(() => {
        if (!open || activeKey === null) return
        const node = listRef.current?.querySelector('[data-active="true"]')
        if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' })
        // Re-follow the highlight whenever the visible set changes too (query,
        // collapse, favorites): otherwise a filtered list keeps its old offset.
      }, [open, activeKey, normalized, rows.length, collapsed])

      const toggleFavorite = useCallback((provider, model) => {
        const key = pairKey(provider, model)
        setFavorites((previous) => {
          const next = previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key]
          writeList(FAV_KEY, next)
          return next
        })
      }, [])

      const toggleCollapsed = useCallback((provider) => {
        setCollapsed((previous) => {
          const next = previous.includes(provider)
            ? previous.filter((item) => item !== provider)
            : [...previous, provider]
          writeList(COLLAPSE_KEY, next)
          return next
        })
      }, [])

      const choose = useCallback(
        async (group, model, effort) => {
          setSelectError(null)
          const selection = { provider: group.id, model: model.id }
          if (effort !== undefined) selection.reasoningEffort = effort
          else if (model.reasoning?.defaultEffort !== undefined) selection.reasoningEffort = model.reasoning.defaultEffort
          const result = await select(selection)
          if (result !== undefined && result.ok === false) {
            setSelectError(result.error?.message ?? t('error.select'))
            return
          }
          setOpen(false)
          setQuery('')
        },
        [select, t],
      )

      const move = useCallback(
        (delta) => {
          if (rows.length === 0) return
          const index = rows.findIndex((row) => pairKey(row.group.id, row.model.id) === activeKey)
          const next = index < 0 ? (delta > 0 ? 0 : rows.length - 1) : (index + delta + rows.length) % rows.length
          const row = rows[next]
          setActiveKey(pairKey(row.group.id, row.model.id))
          if (effortFor !== null && effortFor !== pairKey(row.group.id, row.model.id)) setEffortFor(null)
        },
        [rows, activeKey, effortFor],
      )

      const onSearchKeyDown = useCallback(
        (event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            move(event.key === 'ArrowDown' ? 1 : -1)
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            if (mode === 'edit') {
              setMode('pick')
              setQuery('')
            } else if (effortFor !== null) setEffortFor(null)
            else setOpen(false)
            return
          }
          if (event.key === 'Enter' && !event.nativeEvent?.isComposing) {
            event.preventDefault()
            const row = rows.find((candidate) => pairKey(candidate.group.id, candidate.model.id) === activeKey)
            if (row === undefined) return
            if (event.shiftKey) {
              toggleFavorite(row.group.id, row.model.id)
              return
            }
            if (event.altKey && row.model.reasoning !== undefined) {
              event.stopPropagation()
              setEffortFor((previous) => (previous === null ? pairKey(row.group.id, row.model.id) : null))
              return
            }
            void choose(row.group, row.model)
            return
          }
          if (event.key === 'ArrowRight' && activeKey !== null) {
            const row = rows.find((candidate) => pairKey(candidate.group.id, candidate.model.id) === activeKey)
            if (row === undefined || row.model.reasoning === undefined) return
            event.preventDefault()
            setEffortFor(pairKey(row.group.id, row.model.id))
          }
        },
        [activeKey, choose, effortFor, mode, move, rows, toggleFavorite],
      )

      const isCurrent = (group, model) =>
        state.current !== null &&
        state.current !== undefined &&
        state.current.provider === group.id &&
        state.current.model === model.id

      const pendingKey =
        state.pending === null || state.pending === undefined ? null : pairKey(state.pending.provider, state.pending.model)

      const trigger = h(
        'button',
        {
          type: 'button',
          className: 'dsh-hmp-trigger',
          disabled: locked === true || available === false,
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          title: t('trigger.title'),
          onClick: () => setOpen((previous) => !previous),
        },
        h('span', { className: 'dsh-hmp-label' }, currentLabel),
        currentEffort === undefined ? null : h('span', { className: 'dsh-hmp-caption' }, currentEffort),
        ChevronIcon({ open }),
      )

      if (!open) return h('div', { className: 'dsh-hmp-root', ref: rootRef }, trigger)

      const panelStyle = placement === null
        ? { visibility: 'hidden', left: 0, bottom: 0, width: 360 }
        : placement.above
          ? {
              left: placement.left,
              width: placement.width,
              bottom: Math.max(8, window.innerHeight - placement.anchor + 8),
              maxHeight: Math.min(460, placement.anchor - 24),
            }
          : {
              left: placement.left,
              width: placement.width,
              top: placement.bottom + 8,
              maxHeight: Math.min(460, window.innerHeight - placement.bottom - 24),
            }

      const failures = state.failures || []

      return h(
        'div',
        { className: 'dsh-hmp-root', ref: rootRef },
        trigger,
        ReactDOM.createPortal(
          h(
          'div',
          {
            className: 'dsh-hmp-panel',
            ref: panelRef,
            role: 'dialog',
            'aria-label': t('panel.label'),
            style: panelStyle,
          },
          h(
            'div',
            { className: 'dsh-hmp-searchRow' },
            h('input', {
              ref: inputRef,
              className: 'dsh-hmp-search',
              type: 'text',
              value: query,
              placeholder: t('search'),
              'aria-label': t('search'),
              autoComplete: 'off',
              spellCheck: false,
              onChange: (event) => setQuery(event.target.value),
              onKeyDown: onSearchKeyDown,
            }),
            query === ''
              ? null
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-hmp-clear',
                    'aria-label': t('search.clear'),
                    onMouseDown: (event) => event.preventDefault(),
                    onClick: () => {
                      setQuery('')
                      inputRef.current?.focus()
                    },
                  },
                  CloseIcon(),
                ),
          ),
          selectError === null
            ? null
            : h('div', { className: 'dsh-hmp-note dsh-hmp-error' }, selectError),
          state.error === null || state.error === undefined
            ? null
            : h(
                'div',
                { className: 'dsh-hmp-note dsh-hmp-error' },
                state.error,
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-hmp-retry',
                    onClick: () => {
                      setSelectError(null)
                      load()
                    },
                  },
                  t('retry'),
                ),
              ),
          h(
            'div',
            { className: 'dsh-hmp-list', ref: listRef, role: 'listbox', 'aria-label': t('panel.label') },
            rows.length === 0
              ? h(
                  'div',
                  { className: 'dsh-hmp-empty' },
                  state.status === 'loading' ? t('status.loading') : t('status.empty'),
                )
              : null,
            favoriteRows.length > 0
              ? h(
                  'div',
                  { key: 'favorites' },
                  h('div', { className: 'dsh-hmp-section' }, t('section.favorites')),
                  favoriteRows.map((row) => renderRow(row, true)),
                )
              : null,
            visibleGroups.map((entry) =>
              h(
                'div',
                { key: `group:${entry.group.id}` },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-hmp-groupHead',
                    'aria-expanded': !(normalized === '' && collapsed.includes(entry.group.id)),
                    onClick: () => toggleCollapsed(entry.group.id),
                  },
                  ChevronIcon({ open: !(normalized === '' && collapsed.includes(entry.group.id)) }),
                  h('span', null, providerName(entry.group)),
                  h('span', { className: 'dsh-hmp-count' }, String(entry.models.length)),
                ),
                normalized === '' && collapsed.includes(entry.group.id)
                  ? null
                  : entry.models.map((row) => renderRow(row, false)),
              ),
            ),
            failures.length > 0
              ? h(
                  'div',
                  { className: 'dsh-hmp-note' },
                  t('failures', { providers: failures.map((failure) => failure.name || failure.id).join(', ') }),
                )
              : null,
          ),
          h(
            'div',
            { className: 'dsh-hmp-foot' },
            h(
              'div',
              { className: 'dsh-hmp-hints' },
              h('span', { className: 'dsh-hmp-kbd' }, '↑↓'),
              h('span', null, t('hint.move')),
              h('span', { className: 'dsh-hmp-kbd' }, 'Enter'),
              h('span', null, t('hint.select')),
              h('span', { className: 'dsh-hmp-kbd' }, '⇧Enter'),
              h('span', null, t('hint.star')),
            ),
            h(
              'div',
              { className: 'dsh-hmp-footAction' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-hmp-footBtn',
                  style: { whiteSpace: 'nowrap' },
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => {
                    setMode('edit')
                    setQuery('')
                    setEffortFor(null)
                    window.setTimeout(() => editInputRef.current?.focus(), 0)
                  },
                },
                t('edit.open'),
              ),
            ),
          ),
          mode === 'edit'
            ? h(
                'div',
                { className: 'dsh-hmp-editPane' },
                h(
                  'div',
                  { className: 'dsh-hmp-editHead' },
                  h('span', null, t('edit.title')),
                  h(
                    'span',
                    { className: 'dsh-hmp-editCount' },
                    t('edit.count', {
                      shown: String(visibleKeys.size),
                      total: String(allModelKeys(groups).size),
                    }),
                  ),
                ),
                h(
                  'div',
                  { className: 'dsh-hmp-searchRow' },
                  h('input', {
                    ref: editInputRef,
                    className: 'dsh-hmp-search',
                    type: 'text',
                    value: query,
                    placeholder: t('edit.search'),
                    'aria-label': t('edit.search'),
                    autoComplete: 'off',
                    spellCheck: false,
                    onChange: (event) => setQuery(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setMode('pick')
                        setQuery('')
                      }
                    },
                  }),
                ),
                h('div', { className: 'dsh-hmp-list' }, editGroups()),
                h(
                  'div',
                  { className: 'dsh-hmp-editFoot' },
                  visible !== null
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-hmp-footBtn',
                          onClick: () => applyVisible(null),
                        },
                        t('edit.reset'),
                      )
                    : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-hmp-footBtn',
                      onClick: () => {
                        setMode('pick')
                        setQuery('')
                        setEffortFor(null)
                      },
                    },
                    t('edit.done'),
                  ),
                ),
              )
            : null,
          ),
          document.body,
        ),
      )

      /**
       * The "Edit models" pane: every model the catalog knows, with a provider
       * master switch and one toggle per model. Turning a provider off records a
       * hide-all sentinel, so its curated defaults never creep back.
       */
      function editGroups() {
        const entries = groups
          .map((group) => ({
            group,
            models: group.models
              .map((model) => {
                const label = model.name || model.id
                let match = substringMatch(label, normalized)
                if (match === null && normalized !== '') {
                  const provider = group.name || group.id
                  if (provider.toLowerCase().includes(normalized)) match = { hits: [], score: 1 }
                }
                return match === null ? null : { group, model, match }
              })
              .filter((entry) => entry !== null)
              .sort((left, right) => left.match.score - right.match.score),
          }))
          .filter((entry) => entry.models.length > 0)
        if (entries.length === 0) return h('div', { className: 'dsh-hmp-empty' }, t('status.empty'))
        return entries.map((entry) => {
          const onCount = entry.group.models.filter((model) => visibleKeys.has(familyKey(entry.group.id, model.id))).length
          const total = entry.group.models.length
          const state = onCount === 0 ? 'false' : onCount === total ? 'true' : 'mixed'
          const collapsedGroup = normalized === '' && collapsed.includes(entry.group.id)
          return h(
            'div',
            { key: `edit:${entry.group.id}` },
            h(
              'div',
              { className: 'dsh-hmp-editProvider' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-hmp-groupHead',
                  style: { marginTop: 0, flex: 1 },
                  'aria-expanded': !collapsedGroup,
                  onClick: () => toggleCollapsed(entry.group.id),
                },
                ChevronIcon({ open: !collapsedGroup }),
                h('span', null, providerName(entry.group)),
                h('span', { className: 'dsh-hmp-count' }, `${onCount}/${total}`),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-hmp-pcheck',
                  role: 'checkbox',
                  'aria-checked': state,
                  'aria-label': t('edit.providerAll', { provider: providerName(entry.group) }),
                  onClick: () =>
                    applyVisible(setProviderVisible(storedVisible, groups, storedKnown, entry.group.id, state !== 'true')),
                },
                state === 'true' ? CheckIcon() : state === 'mixed' ? h('span', { className: 'dsh-hmp-minus' }, '–') : null,
              ),
            ),
            collapsedGroup
              ? null
              : entry.models.map(({ group, model, match }) => {
                  const key = familyKey(group.id, model.id)
                  const on = visibleKeys.has(key)
                  const label = model.name || model.id
                  return h(
                    'div',
                    { className: 'dsh-hmp-editRow', key: `editrow:${key}` },
                    h('span', { className: 'dsh-hmp-editName' }, Highlighted({ hits: match.hits, text: label })),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-hmp-switch' + (on ? ' dsh-hmp-switchOn' : ''),
                        role: 'switch',
                        'aria-checked': on,
                        'aria-label': t('edit.modelToggle', { model: label }),
                        onClick: () => applyVisible(toggleVisible(storedVisible, groups, storedKnown, group.id, model.id)),
                      },
                      h('span', { className: 'dsh-hmp-knob' }),
                    ),
                  )
                }),
          )
        })
      }

      /** One catalog row plus its optional reasoning-level strip. */
      function renderRow(row, favoriteSection) {
        const { group, model, match } = row
        const key = pairKey(group.id, model.id)
        const current = isCurrent(group, model)
        const starred = favorites.includes(key)
        const effortOpen = effortFor === key
        const caption = model.reasoning === undefined
          ? undefined
          : current
            ? effortCaption(model.reasoning, state.current?.reasoningEffort ?? model.reasoning.defaultEffort, t)
            : effortCaption(model.reasoning, model.reasoning.defaultEffort, t)
        const badgeText = model.badge === undefined ? undefined : resolveText(model.badge.text)

        return h(
          'div',
          { key: `${favoriteSection ? 'fav' : 'row'}:${key}` },
          h(
            'div',
            {
              className: 'dsh-hmp-row' + (activeKey === key ? ' dsh-hmp-rowActive' : ''),
              'data-active': activeKey === key ? 'true' : undefined,
              role: 'option',
              'aria-selected': current,
              onMouseEnter: () => setActiveKey(key),
              onClick: () => void choose(group, model),
            },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-hmp-star' + (starred ? ' dsh-hmp-starOn' : ''),
                'aria-label': starred ? t('star.remove') : t('star.add'),
                'aria-pressed': starred,
                onClick: (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  toggleFavorite(group.id, model.id)
                },
              },
              StarIcon({ filled: starred }),
            ),
            h(
              'span',
              { className: 'dsh-hmp-copy' },
              h(
                'span',
                { className: 'dsh-hmp-name' },
                Highlighted({ hits: match.hits, text: model.name || model.id }),
                badgeText === undefined ? null : h('span', { className: 'dsh-hmp-badge' }, badgeText),
              ),
              model.description === undefined || current === false
                ? null
                : h('span', { className: 'dsh-hmp-desc' }, model.description),
            ),
            caption === undefined
              ? null
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-hmp-effortChip',
                    'aria-label': t('effort.choose', { model: model.name || model.id }),
                    onClick: (event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setEffortFor(effortOpen ? null : key)
                    },
                    onKeyDown: (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        setEffortFor(effortOpen ? null : key)
                      }
                    },
                  },
                  caption,
                ),
            pendingKey === key
              ? h('span', { className: 'dsh-hmp-check' }, '…')
              : current
                ? h('span', { className: 'dsh-hmp-check' }, CheckIcon())
                : null,
          ),
          effortOpen
            ? h(
                'div',
                { className: 'dsh-hmp-efforts', role: 'group', 'aria-label': t('effort.group') },
                [undefined, ...(model.reasoning?.efforts || []).map((level) => level.id)].map((level) => {
                  const label =
                    level === undefined
                      ? t('effort.default')
                      : (model.reasoning?.efforts || []).find((entry) => entry.id === level)?.name ?? level
                  const on =
                    level === undefined
                      ? current && (state.current?.reasoningEffort ?? model.reasoning?.defaultEffort) === undefined
                      : current && state.current?.reasoningEffort === level
                  return h(
                    'button',
                    {
                      type: 'button',
                      key: `effort:${level ?? 'default'}`,
                      className: 'dsh-hmp-effortOpt' + (on ? ' dsh-hmp-effortOptOn' : ''),
                      'aria-pressed': on,
                      onClick: () => void choose(group, model, level),
                    },
                    label,
                  )
                }),
              )
            : null,
        )
      }
    }

    const en = {
      'trigger.title': 'Choose model',
      'trigger.none': 'No model',
      'panel.label': 'Models',
      'provider.account': 'DeepSeek Account',
      'search': 'Search models…',
      'search.clear': 'Clear search',
      'section.favorites': 'Favorites',
      'status.loading': 'Loading models…',
      'status.empty': 'No models match.',
      'retry': 'Retry',
      'error.select': 'The model could not be selected.',
      'star.add': 'Add to favorites',
      'star.remove': 'Remove from favorites',
      'effort.default': 'default',
      'effort.choose': 'Reasoning level for {model}',
      'effort.group': 'Reasoning levels',
      'failures': 'Could not load: {providers}',
      'hint.move': 'move',
      'hint.select': 'select',
      'hint.star': 'favorite',
      'edit.open': 'Edit models…',
      'edit.title': 'Edit models',
      'edit.search': 'Filter models…',
      'edit.count': '{shown} of {total} shown',
      'edit.reset': 'Reset to defaults',
      'edit.done': 'Done',
      'edit.providerAll': 'Show all {provider} models',
      'edit.modelToggle': 'Show {model}',
    }

    const zh = {
      'trigger.title': '选择模型',
      'trigger.none': '未选择模型',
      'panel.label': '模型',
      'provider.account': 'DeepSeek 账号',
      'search': '搜索模型…',
      'search.clear': '清除搜索',
      'section.favorites': '收藏',
      'status.loading': '正在加载模型…',
      'status.empty': '没有匹配的模型。',
      'retry': '重试',
      'error.select': '无法切换到该模型。',
      'star.add': '加入收藏',
      'star.remove': '取消收藏',
      'effort.default': '默认',
      'effort.choose': '{model} 的推理等级',
      'effort.group': '推理等级',
      'failures': '加载失败：{providers}',
      'hint.move': '移动',
      'hint.select': '选择',
      'hint.star': '收藏',
      'edit.open': '编辑模型…',
      'edit.title': '编辑模型',
      'edit.search': '筛选模型…',
      'edit.count': '显示 {shown} / {total}',
      'edit.reset': '恢复默认',
      'edit.done': '完成',
      'edit.providerAll': '显示全部 {provider} 模型',
      'edit.modelToggle': '显示 {model}',
    }

    /**
     * Client plugin body: dictionaries, then the composer model seat.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'hermes-model-picker: dictionaries')
      ctx.inject(['slots', 'modelDirectories', 'sessions'], (scope) => {
        const models = scope.modelDirectories
        const sessions = scope.sessions
        scope.slots.inject('conversation.input.model', () =>
          scope.slots.register(
            {
              name: 'conversation.input.model',
              locale: NS,
              // A single slot renders the LOWEST priority, and every occupant
              // must claim a distinct one: -1 shadows the shipped picker
              // instead of colliding with its priority-0 registration.
              priority: -1,
              inject: (sessionId) => {
                const directory = models.directoryFor(sessionId)
                const available = sessions.subagentAddress(sessionId) === undefined
                return {
                  available,
                  directory: directory.store,
                  load: () => {
                    if (available) directory.load().catch(() => {})
                  },
                  resolveText: (text) => ctx.locale.resolveText(text),
                  select: (selection) => (available ? directory.select(selection) : Promise.resolve(undefined)),
                }
              },
            },
            ModelPicker,
          ),
        )
      })
    }

    return { inject: ['slots', 'locale', 'modelDirectories', 'sessions'], apply }
  },
})
