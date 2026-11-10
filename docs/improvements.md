# Improvements by surface

Ten to fifteen concrete next steps for every surface shipped with the kit. Effort: **S** = an afternoon, **M** = a day or two, **L** = needs a new Host surface or schema.

## Model picker

1. **Current section at the top** — pin the selected model above Favorites so it never needs a scroll. (S)
2. **Recents** — last five models per session, above the providers. (S)
3. **Provider-aware search** — match provider names and `provider:` prefixes, not just model names. (S)
4. **Open shortcut** — register a command (`⌘⇧M`) through `commandUi` instead of only clicking the pill. (S)
5. **Fast/priority tiers** — support `-fast` siblings and priority tiers like Hermes families. (M)
6. **Context + price columns** — fetch each route's `/v1/models` on the Host, cache it, show context and price where the provider reports them. (M)
7. **Provider badge in the trigger** — the pill should say which route "flash" belongs to. (S)
8. **Effort from the trigger** — clicking the effort caption opens just the level list. (S)
9. **Copy model id** — a context-menu action on every row. (S)
10. **Reorder favorites** — drag, not insertion order. (S)
11. **Host-side preferences** — favourites and visibility in the profile, so browsers agree. (M)
12. **Selection revert** — on a failed switch, keep the panel open and show what was reverted to. (S)
13. **Real listbox a11y** — `aria-activedescendant` wiring while focus stays in search. (S)
14. **Touch path** — tap opens the effort strip; larger hit targets on coarse pointers. (M)
15. **Catalog-error rows** — a provider that failed to load should say why inline, with a link to Providers. (S)

## Edit models

1. **Undo** — one-step revert of the last toggle, with a toast. (S)
2. **Reset one provider** — alongside show all / hide all. (S)
3. **Bulk select** — select the filtered matches and toggle them together. (S)
4. **Hidden count per provider** — `3 hidden` next to `on/total`. (S)
5. **Guard the current model** — warn before hiding the model in use. (S)
6. **Reorder** — drag providers and models; the picker follows that order. (M)
7. **Import/export** — the visibility set as JSON, for sharing or backup. (S)
8. **Host storage** — same preference across browsers and machines. (M)
9. **Explain the sentinel** — an inline note when a provider is hidden outright. (S)
10. **Keyboard pass** — arrows through switches, space to toggle, no mouse required. (S)
11. **Recently changed** — a short list with per-row revert. (S)

## Projects page

1. **Sort + filter** — status, open items, last activity. (S)
2. **Git state per project** — branch, dirty, ahead/behind. (M)
3. **Last commit** — subject and relative time. (S)
4. **Toggle TODO items** — a checkbox writes back to `TODO.md` behind a confirm. (M)
5. **Open actions** — Finder and the configured editor. (S)
6. **New project** — folder picker plus README/TODO stubs. (M)
7. **Deep-link sessions** — open a session from the project's newest list. (M)
8. **README preview** — first screen below the TODO list. (S)
9. **Pin and reorder** — starred projects first. (S)
10. **Stale detection** — flag projects with no session in 30 days; bulk archive. (S)
11. **Per-project model default** — a project remembers its model. (L)
12. **Cross-project TODO search** — one query over every open item. (M)

## Skills manager

1. **Tools half** — list the tool catalogue next to skills, with its own enable state. (M)
2. **Sorting** — loads, last used, size, name. (S)
3. **Never-fired filter** — the curator's dead-list as a toggle. (S)
4. **Duplicate groups** — `name--hash` copies collapsed into one row with merge/retire actions. (M)
5. **Preview** — open the skill body in the panel without leaving it. (S)
6. **Inline frontmatter edit** — name/description with validation. (M)
7. **Error rate per skill** — join tool errors to the turns a skill loaded in. (M)
8. **Undo** — restore a disabled skill from a toast. (S)
9. **Bulk operations** — multi-select enable/disable. (S)
10. **Reference guard** — warn when disabling a skill AGENTS.md or a plan names. (S)
11. **Virtualize** — 571 rows is fine today; a 2,000-skill library is not. (S)
12. **Budget warnings** — trigger length and description size, from the audit rules. (S)
13. **Test load** — invoke the skill through the RPC and report the result. (M)
14. **Retired export** — dump and restore the retired set. (S)

## Provider health

1. **Latency** — p50/p95 from request time to first chunk. (M)
2. **Error breakdown** — counts by code with the last message. (S)
3. **Time window** — 24h / 7d / 30d, plus a workspace filter. (S)
4. **Token mix** — input/output/cache as a stacked bar. (S)
5. **Cost** — a price table per route/model; show estimated spend. (M)
6. **Sortable columns** — every numeric header. (S)
7. **Export** — CSV/JSON of the current view. (S)
8. **Ping** — a one-token test per model with the measured latency. (M)
9. **Rollups** — provider totals with expandable models. (S)
10. **Auto-refresh** — a visible "as of" timestamp and a refresh interval. (S)
11. **Never-used models** — configured but absent from every log. (S)
12. **Retries** — count `llm/retry` events per route. (S)
13. **Quota events** — surface 402/401s separately from transport errors. (S)

## Kanban

1. **Insert at drop position** — today a drop appends to the column. (S)
2. **Edit a card** — double-click, with markdown notes. (M)
3. **Metadata** — assignee, label, due date, linked session or task. (M)
4. **Keyboard move** — pick up, arrow, drop. (S)
5. **WIP limits** — per column, with a counter and a soft warning. (S)
6. **Per-workspace boards** — one board per workspace instead of one global file. (M)
7. **Multiple boards** — swimlanes or named boards. (L)
8. **Agent surface** — a tool/command so the agent can add and move cards. (M)
9. **Undo delete** — a toast that restores the card. (S)
10. **Collapse Done** — keep finished work out of the way. (S)
11. **Filter** — by text and label. (S)
12. **Git-backed storage** — a board file in the workspace, versioned with the project. (M)
13. **Save feedback** — a visible failure with retry, not just a silent debounce. (S)
14. **Touch drag** — pointer events, not only HTML5 drag. (M)

## Command Center

1. **Open** — click a row to focus that session. (L — client session-open API)
2. **Stop / steer** — `session/cancel` and queue edits with confirmation. (L)
3. **Live state** — running/awaiting from the client session store, not log mtime. (M)
4. **Pending approvals** — show which sessions are blocked on a question. (M)
5. **Subagent tree** — parent/child lineage instead of a flat list. (M)
6. **Burn sparkline** — tokens per session over time. (M)
7. **Auto-refresh + sort** — every column sortable, refresh interval. (S)
8. **Filter + search** — workspace, status, title/id. (S)
9. **Rename / archive** — from the panel. (M)
10. **Stale badge** — "idle 6d" with a bulk cleanup action. (S)
11. **Reveal logs** — open the session directory. (S)
12. **Live model** — read the active model from state, not the last assistant message. (M)
13. **Error column** — last failure code per session. (S)

## CLI kit

1. **`mem` tag queries** — saved filters, not just free text. (S)
2. **`mem` export/import** — JSONL round trip. (S)
3. **`mem` dedupe** — similarity merge, with a dry run. (M)
4. **`mem` brief budget** — ranked, compressed to a token ceiling. (S)
5. **`mem` project scope** — notes attached to a workspace. (M)
6. **`ckpt` pre-write hook** — the missing automation for snapshots. (L)
7. **`ckpt` retention** — keep N per repo, prune the rest. (S)
8. **`ckpt` diff** — compare two snapshots. (S)
9. **`ckpt` gc** — size accounting and pruning. (S)
10. **`curator` latency** — per tool, plus error grouping. (M)
11. **`curator` weekly report** — scheduled run with a notification. (S)
12. **`curator` skill→session map** — where each skill actually fired. (M)
13. **`proj` validation** — prune missing directories, status transitions. (S)
14. **`skill-audit` in the panel** — duplicates and retirement inside Skills. (M)
15. **`--json` everywhere + tests** — machine-readable output and a test suite for all six CLIs. (M)
