/**
 * Host half of the Toolbox panel.
 *
 * Read-mostly routes over local harness state:
 *   GET  /api/toolbox/skills         skill catalogue + curator stats
 *   POST /api/toolbox/skills/toggle  move a skill between skills/ and skills-retired/
 *   GET  /api/toolbox/providers      per provider/model activity from session logs
 *   GET  /api/toolbox/board          kanban board
 *   POST /api/toolbox/board          replace the kanban board
 *
 * Nothing here talks to a model. The session-log read is bounded to the newest
 * sessions and cached briefly, because each file is zstd-compressed JSONL.
 */
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import zlib from 'node:zlib'

const execFileAsync = promisify(execFile)

const HOME = os.homedir()
const SKILLS = path.join(HOME, '.dsh', 'skills')
const RETIRED = path.join(HOME, '.dsh', 'skills-retired')
const STATS = path.join(HOME, '.dsh', 'curator', 'stats.json')
const BOARD = path.join(HOME, '.dsh', 'toolbox', 'board.json')
const SESSIONS = path.join(HOME, '.dsh', 'sessions')
const SESSION_LIMIT = 40
const CACHE_MS = 60_000

/** Required carrier and tool registry. */
export const inject = ['connection', 'tools', 'llm']

/** @type {null | { at: number, value: unknown }} */
let providerCache = null

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function failure(error, status = 500) {
  return json({ error: error instanceof Error ? error.message : String(error) }, status)
}

/** Split the leading `---` YAML block into simple scalar fields. */
function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (match === null) return {}
  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    const hit = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (hit !== null) fields[hit[1]] = hit[2].replace(/^["']|["']$/g, '').trim()
  }
  return fields
}

async function readDir(root, enabled) {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
  const rows = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const file = path.join(root, entry.name, 'SKILL.md')
    let text
    try {
      text = await fs.readFile(file, 'utf8')
    } catch {
      continue
    }
    const fields = frontmatter(text)
    rows.push({
      dir: entry.name,
      name: fields.name || entry.name,
      description: fields.description || '',
      bytes: Buffer.byteLength(text),
      enabled,
    })
  }
  return rows
}

async function skillsPayload() {
  const stats = await fs.readFile(STATS, 'utf8').then(JSON.parse).catch(() => ({ skill_loads: {}, skill_last_seen: {} }))
  const [active, retired] = await Promise.all([readDir(SKILLS, true), readDir(RETIRED, false)])
  const loads = stats.skill_loads || {}
  const lastSeen = stats.skill_last_seen || {}
  const all = [...active, ...retired]
  const byName = new Map()
  for (const row of all) byName.set(row.name, (byName.get(row.name) || 0) + 1)
  const rows = all.map((row) => ({
    ...row,
    loads: loads[row.name] || 0,
    lastSeen: lastSeen[row.name] || null,
    copies: byName.get(row.name) || 1,
  }))
  rows.sort((a, b) => Number(b.enabled) - Number(a.enabled) || b.loads - a.loads || a.name.localeCompare(b.name))
  return {
    skills: rows,
    totals: { all: rows.length, enabled: active.length, retired: retired.length, loads: rows.reduce((n, r) => n + r.loads, 0) },
    statsGenerated: stats.generated || null,
  }
}

async function sessionFiles() {
  const out = []
  const roots = await fs.readdir(SESSIONS, { withFileTypes: true }).catch(() => [])
  for (const root of roots) {
    if (!root.isDirectory()) continue
    const dirs = await fs.readdir(path.join(SESSIONS, root.name), { withFileTypes: true }).catch(() => [])
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue
      const file = path.join(SESSIONS, root.name, dir.name, 'session.v4.jsonl.zstd')
      try {
        const stat = await fs.stat(file)
        out.push({ file, mtime: stat.mtimeMs, size: stat.size })
      } catch {
        /* not a session directory */
      }
    }
  }
  out.sort((a, b) => b.mtime - a.mtime)
  return out.slice(0, SESSION_LIMIT)
}

/**
 * Decompress one session log. Session files are APPENDED as concatenated zstd
 * frames, and `zlib.zstdDecompressSync` stops after the first frame, so the
 * `zstd` CLI is the primary reader; the single-frame zlib path is a fallback.
 */
async function readSession(file) {
  try {
    const { stdout } = await execFileAsync('zstd', ['-dc', file], { maxBuffer: 64 * 1024 * 1024, timeout: 30_000 })
    return stdout
  } catch {
    try {
      return zlib.zstdDecompressSync(await fs.readFile(file)).toString('utf8')
    } catch {
      return null
    }
  }
}

async function providersPayload() {
  if (providerCache !== null && Date.now() - providerCache.at < CACHE_MS) return providerCache.value
  const rows = new Map()
  const files = await sessionFiles()
  let scanned = 0
  for (const entry of files) {
    if (entry.size > 16 * 1024 * 1024) continue
    const text = await readSession(entry.file)
    if (text === null) continue
    scanned += 1
    let last = null
    for (const line of text.split('\n')) {
      if (line === '') continue
      let event
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }
      if (event.type === 'request/header') {
        const config = event.data?.header?.config
        if (config?.provider && config?.model) last = { provider: config.provider, model: config.model, time: event.time }
      } else if (event.type === 'assistant/message') {
        const source = event.data?.message?.source
        if (source?.kind !== 'model' || !source.provider || !source.model) continue
        const key = `${source.provider}::${source.model}`
        const row = rows.get(key) || {
          provider: source.provider,
          model: source.model,
          messages: 0,
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 0,
          errors: 0,
          lastUsed: 0,
        }
        row.messages += 1
        const usage = event.data?.usage
        if (usage) {
          row.inputTokens += usage.inputTokens || 0
          row.outputTokens += usage.outputTokens || 0
          row.cacheReadTokens += usage.cacheReadTokens || 0
          row.totalTokens += usage.totalTokens || 0
        }
        row.lastUsed = Math.max(row.lastUsed, event.time || 0)
        if (last !== null && last.time !== undefined && event.time !== undefined) {
          const delta = event.time - last.time
          if (delta > 0 && delta < 15 * 60_000) {
            row.latencySum = (row.latencySum || 0) + delta
            row.latencySamples = (row.latencySamples || 0) + 1
            last = { ...last, time: undefined }
          }
        }
        rows.set(key, row)
        last = { provider: source.provider, model: source.model }
      } else if (event.type === 'assistant/attempt') {
        const chunks = event.data?.stream || []
        for (const item of chunks) {
          const chunk = item?.chunk
          if (chunk?.type !== 'finish' || chunk.reason?.kind !== 'error') continue
          if (last === null) continue
          const key = `${last.provider}::${last.model}`
          const row = rows.get(key)
          if (row !== undefined) row.errors += 1
        }
      }
    }
  }
  const value = {
    rows: [...rows.values()]
      .map((row) => ({
        ...row,
        latencyMs: row.latencySamples ? Math.round(row.latencySum / row.latencySamples) : null,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens || b.messages - a.messages),
    scanned,
    at: Date.now(),
  }
  providerCache = { at: Date.now(), value }
  return value
}

/** @type {null | { at: number, value: unknown }} */
let sessionCache = null

/**
 * One row per durable session, read from its log: title, workspace, model,
 * message and token totals, and the file's last write. A session is reported
 * "active" when its log was written within the last two minutes — the files
 * carry no liveness flag, and a page cannot ask the Host for another tab's
 * in-flight state.
 */
async function sessionsPayload() {
  if (sessionCache !== null && Date.now() - sessionCache.at < 30_000) return sessionCache.value
  const rows = []
  const roots = await fs.readdir(SESSIONS, { withFileTypes: true }).catch(() => [])
  for (const root of roots) {
    if (!root.isDirectory()) continue
    const dirs = await fs.readdir(path.join(SESSIONS, root.name), { withFileTypes: true }).catch(() => [])
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue
      const file = path.join(SESSIONS, root.name, dir.name, 'session.v4.jsonl.zstd')
      let stat
      try {
        stat = await fs.stat(file)
      } catch {
        continue
      }
      const text = await readSession(file)
      if (text === null) continue
      let cwd = ''
      let title = null
      let model = ''
      let messages = 0
      let tokens = 0
      for (const line of text.split('\n')) {
        if (line === '') continue
        let event
        try {
          event = JSON.parse(line)
        } catch {
          continue
        }
        if (event.type === 'session') {
          cwd = event.cwd || cwd
        } else if (event.type === 'session/title') {
          title = event.data?.title || title
        } else if (event.type === 'assistant/message') {
          messages += 1
          const source = event.data?.message?.source
          if (source?.provider) model = `${source.provider} / ${source.model}`
          tokens += event.data?.usage?.totalTokens || 0
        }
      }
      rows.push({
        id: dir.name,
        cwd,
        title: title || path.basename(cwd) || dir.name,
        model,
        messages,
        tokens,
        updatedAt: stat.mtimeMs,
        active: Date.now() - stat.mtimeMs < 120_000,
      })
    }
  }
  rows.sort((a, b) => b.updatedAt - a.updatedAt)
  const value = { rows, at: Date.now() }
  sessionCache = { at: Date.now(), value }
  return value
}

/** A fresh board set: one board, three columns, no cards. */
function emptyBoard() {
  return {
    version: 2,
    activeBoard: 'default',
    boards: [
      {
        id: 'default',
        name: 'Default',
        columns: [
          { id: 'todo', title: 'Todo', cards: [] },
          { id: 'doing', title: 'Doing', cards: [] },
          { id: 'done', title: 'Done', cards: [] },
        ],
      },
    ],
  }
}

/** One card, with every field the panel and the tool read. */
function cleanCard(card) {
  return {
    id: String(card?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    text: String(card?.text || '').slice(0, 500),
    assignee: String(card?.assignee || '').slice(0, 60),
    priority: ['low', 'normal', 'high'].includes(card?.priority) ? card.priority : 'normal',
    archived: card?.archived === true,
    createdAt: Number.isFinite(card?.createdAt) ? card.createdAt : Date.now(),
  }
}

/** One board, with its columns and cards normalized. */
function cleanBoard(board, index) {
  return {
    id: String(board?.id || `board-${index}`),
    name: String(board?.name || `Board ${index + 1}`).slice(0, 60),
    columns: (Array.isArray(board?.columns) ? board.columns : []).slice(0, 12).map((column, position) => ({
      id: String(column?.id || `c${position}`),
      title: String(column?.title || `Column ${position + 1}`).slice(0, 60),
      cards: (Array.isArray(column?.cards) ? column.cards : []).slice(0, 500).map(cleanCard),
    })),
  }
}

/** Read the board file, migrating the single-board v1 shape in place. */
async function readBoard() {
  let parsed
  try {
    parsed = JSON.parse(await fs.readFile(BOARD, 'utf8'))
  } catch {
    return emptyBoard()
  }
  if (Array.isArray(parsed?.boards)) {
    const boards = parsed.boards.map(cleanBoard)
    if (boards.length === 0) return emptyBoard()
    const active = boards.some((board) => board.id === parsed.activeBoard) ? parsed.activeBoard : boards[0].id
    return { version: 2, activeBoard: active, boards }
  }
  if (Array.isArray(parsed?.columns)) {
    // v1: one implicit board. Keep the cards, name the board, and let the next
    // write persist the new shape.
    return {
      version: 2,
      activeBoard: 'default',
      boards: [{ id: 'default', name: 'Default', columns: parsed.columns.map((column, index) => ({
        id: String(column?.id || `c${index}`),
        title: String(column?.title || `Column ${index + 1}`).slice(0, 60),
        cards: (Array.isArray(column?.cards) ? column.cards : []).map(cleanCard),
      })) }],
    }
  }
  return emptyBoard()
}

async function writeBoard(body) {
  if (!Array.isArray(body?.boards)) throw new Error('board.boards must be an array')
  const boards = body.boards.slice(0, 20).map(cleanBoard)
  if (boards.length === 0) throw new Error('at least one board is required')
  const active = boards.some((board) => board.id === body.activeBoard) ? String(body.activeBoard) : boards[0].id
  const clean = { version: 2, activeBoard: active, boards }
  await fs.mkdir(path.dirname(BOARD), { recursive: true })
  const tmp = `${BOARD}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(clean, null, 2)}\n`)
  await fs.rename(tmp, BOARD)
  return clean
}

/** The board a tool call means: by id or name, else the active one. */
function boardOf(state, wanted) {
  if (wanted === undefined || wanted === '') return state.boards.find((board) => board.id === state.activeBoard) || state.boards[0]
  const low = String(wanted).toLowerCase()
  return state.boards.find((board) => board.id.toLowerCase() === low || board.name.toLowerCase() === low)
}

/** Locate a column by id or case-insensitive title. */
function columnOf(board, wanted) {
  if (wanted === undefined || wanted === '') return board.columns[0]
  const low = String(wanted).toLowerCase()
  return board.columns.find((column) => column.id.toLowerCase() === low || column.title.toLowerCase() === low)
}

/** Locate a card by id or case-insensitive text. */
function cardOf(board, wanted) {
  const low = String(wanted).toLowerCase()
  for (const column of board.columns) {
    const card = column.cards.find((c) => c.id === wanted) || column.cards.find((c) => c.text.toLowerCase() === low)
    if (card !== undefined) return { column, card }
  }
  return undefined
}

/** One-line board summary for the tool result. */
function boardText(state) {
  return state.boards
    .map((board) => {
      const head = `${board.name}${board.id === state.activeBoard ? ' *' : ''}`
      const body = board.columns
        .map((column) => {
          const live = column.cards.filter((card) => !card.archived)
          const tags = live.map((card) => `${card.text}${card.assignee ? ` @${card.assignee}` : ''}${card.priority !== 'normal' ? ` !${card.priority}` : ''}`)
          return `  ${column.title} (${live.length}): ${tags.join(' | ') || '—'}`
        })
        .join('\n')
      return `${head}\n${body}`
    })
    .join('\n')
}

/**
 * One explicit one-token call to a configured route, timed end to end. This is
 * the only place the panel spends money, and only when the reader presses Test.
 */
async function pingRoute(ctx, provider, model) {
  const signal = AbortSignal.timeout(45_000)
  const call = await ctx.llm.prepareCall({ provider, model, maxTokens: 8 }, signal)
  const message = createUserMessage({ content: [{ type: 'text', text: 'Reply with the single word: ok' }], source: { kind: 'dsh-toolbox-ping' } })
  const assembler = new BlockAssembler()
  const started = Date.now()
  let firstChunkMs = null
  for await (const chunk of call.stream({ ...call.config, messages: [message], maxTokens: 8, purpose: 'toolbox-ping', signal })) {
    if (firstChunkMs === null) firstChunkMs = Date.now() - started
    assembler.push(chunk)
  }
  const text = assembler.blocks()
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join(' ')
    .trim()
  return { ok: true, firstChunkMs, totalMs: Date.now() - started, text: text.slice(0, 80) }
}

/** Read one skill body for the preview pane, from the active or retired tree. */
async function skillBody(dir) {
  for (const root of [SKILLS, RETIRED]) {
    try {
      const text = await fs.readFile(path.join(root, dir, 'SKILL.md'), 'utf8')
      return { dir, text: text.length > 24_000 ? `${text.slice(0, 24_000)}\n\n…truncated` : text }
    } catch {
      /* try the other tree */
    }
  }
  return null
}

/** Every session log on disk, newest first — the insights window needs more than the dashboard's 40. */
async function allSessionFiles() {
  const out = []
  const roots = await fs.readdir(SESSIONS, { withFileTypes: true }).catch(() => [])
  for (const root of roots) {
    if (!root.isDirectory()) continue
    const dirs = await fs.readdir(path.join(SESSIONS, root.name), { withFileTypes: true }).catch(() => [])
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue
      const file = path.join(SESSIONS, root.name, dir.name, 'session.v4.jsonl.zstd')
      try {
        const stat = await fs.stat(file)
        out.push({ file, mtime: stat.mtimeMs, size: stat.size })
      } catch {
        /* not a session directory */
      }
    }
  }
  out.sort((a, b) => b.mtime - a.mtime)
  return out
}

/** A tool result that reports a failure, by the same signatures the dojo uses. */
const ERRORISH = /(Traceback \(most recent call last\)|exit code: [1-9]|No such file or directory|Permission denied|command not found|Error:)/

/** Local calendar day for a millisecond timestamp, as YYYY-MM-DD. */
function dayOf(ms) {
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Usage analytics over the session logs: tokens, messages, tool calls and
 * errors per day, per model and per tool. Tokens are what the provider
 * reported; there is no price table here, so no cost is invented.
 */
async function insightsPayload(days) {
  const window = Math.max(1, Math.min(365, Number(days) || 30))
  const cutoff = Date.now() - window * 86_400_000
  const files = (await allSessionFiles()).filter((entry) => entry.mtime >= cutoff)
  const daily = new Map()
  const models = new Map()
  const tools = new Map()
  const totals = { sessions: 0, messages: 0, userMessages: 0, input: 0, output: 0, cache: 0, tools: 0, errors: 0 }
  const bucket = (map, key, seed) => {
    if (!map.has(key)) map.set(key, seed())
    return map.get(key)
  }
  for (const entry of files) {
    const text = await readSession(entry.file)
    if (text === null) continue
    totals.sessions += 1
    const callNames = new Map()
    let activeModel = null
    for (const line of text.split('\n')) {
      if (line === '') continue
      let event
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }
      const data = event.data || {}
      const at = typeof event.time === 'number' ? event.time : entry.mtime
      const day = dayOf(at)
      if (event.type === 'assistant/message') {
        const usage = data.usage || {}
        const source = data.message?.source || {}
        const input = Number(usage.inputTokens) || 0
        const output = Number(usage.outputTokens) || 0
        const cache = Number(usage.cacheReadTokens) || 0
        totals.messages += 1
        totals.input += input
        totals.output += output
        totals.cache += cache
        const d = bucket(daily, day, () => ({ date: day, messages: 0, input: 0, output: 0, cache: 0, tools: 0, errors: 0 }))
        d.messages += 1
        d.input += input
        d.output += output
        d.cache += cache
        if (source.provider && source.model) {
          const key = `${source.provider}\u0000${source.model}`
          activeModel = key
          const m = bucket(models, key, () => ({ provider: source.provider, model: source.model, messages: 0, input: 0, output: 0, cache: 0, errors: 0 }))
          m.messages += 1
          m.input += input
          m.output += output
          m.cache += cache
        }
      } else if (event.type === 'user/message') {
        if (data.source?.kind === 'user') totals.userMessages += 1
      } else if (event.type === 'tool/call') {
        const name = data.name || '?'
        totals.tools += 1
        if (data.callId) callNames.set(data.callId, name)
        const t = bucket(tools, name, () => ({ name, calls: 0, errors: 0 }))
        t.calls += 1
        bucket(daily, day, () => ({ date: day, messages: 0, input: 0, output: 0, cache: 0, tools: 0, errors: 0 })).tools += 1
      } else if (event.type === 'tool/result') {
        const message = data.message || {}
        const body = (message.content || []).filter((part) => part?.type === 'text').map((part) => part.text || '').join('\n')
        if (!ERRORISH.test(body)) continue
        const callId = data.toolCallId || message.toolCallId || message.source?.callId
        const name = callNames.get(callId || '')
        if (name === undefined) continue
        totals.errors += 1
        bucket(tools, name, () => ({ name, calls: 0, errors: 0 })).errors += 1
        bucket(daily, day, () => ({ date: day, messages: 0, input: 0, output: 0, cache: 0, tools: 0, errors: 0 })).errors += 1
        // A tool result carries no model; attribute it to the model that was
        // active when the call was made, which is the one that chose the call.
        if (activeModel !== null) {
          const m = models.get(activeModel)
          if (m !== undefined) m.errors += 1
        }
      }
    }
  }
  const days_ = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date))
  return {
    window,
    scanned: files.length,
    totals,
    daily: days_,
    models: [...models.values()].sort((a, b) => b.input + b.output - (a.input + a.output)),
    tools: [...tools.values()].sort((a, b) => b.calls - a.calls),
  }
}

/** Log files this panel may read, by index — never an arbitrary path from the client. */
async function logFiles() {
  const roots = [
    path.join(HOME, '.dsh', 'profiles'),
    path.join(HOME, '.dsh', 'curator'),
    path.join(HOME, '.dsh', 'memory'),
    path.join(HOME, 'Library', 'Logs', 'DeepSeek Harness'),
  ]
  const out = []
  for (const root of roots) {
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(root, entry.name)
      if (entry.isDirectory()) {
        const inner = await fs.readdir(full, { withFileTypes: true }).catch(() => [])
        for (const child of inner) {
          if (!child.isFile() || !child.name.endsWith('.log')) continue
          const file = path.join(full, child.name)
          const stat = await fs.stat(file).catch(() => null)
          if (stat !== null) out.push({ file, label: `${entry.name}/${child.name}`, size: stat.size, mtime: stat.mtimeMs })
        }
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.log')) continue
      const stat = await fs.stat(full).catch(() => null)
      if (stat !== null) out.push({ file: full, label: `${path.basename(root)}/${entry.name}`, size: stat.size, mtime: stat.mtimeMs })
    }
  }
  out.sort((a, b) => b.mtime - a.mtime)
  return out
}

/** One log file's tail, with a severity filter over JSONL and plain-text lines. */
async function logsPayload(index, tail, level) {
  const files = await logFiles()
  const entry = files[Number(index)]
  if (entry === undefined) return { files: files.map(({ file, ...rest }) => rest), lines: [], label: null }
  const text = await fs.readFile(entry.file, 'utf8').catch(() => '')
  const all = text.split('\n').filter((line) => line !== '')
  const wanted = String(level || 'all').toLowerCase()
  const rows = []
  for (const line of all) {
    let severity = 'info'
    let message = line
    if (line.startsWith('{')) {
      try {
        const parsed = JSON.parse(line)
        severity = String(parsed.level || 'info').toLowerCase()
        message = parsed.message || line
        if (parsed.at) message = `${new Date(parsed.at).toLocaleTimeString()} ${message}`
      } catch {
        /* plain text that happens to start with a brace */
      }
    } else if (/\b(error|fatal|fail)\b/i.test(line)) severity = 'error'
    else if (/\bwarn(ing)?\b/i.test(line)) severity = 'warn'
    if (wanted !== 'all' && severity !== wanted) continue
    rows.push({ severity, text: message })
  }
  const limit = Math.max(1, Math.min(2000, Number(tail) || 200))
  return {
    files: files.map(({ file, ...rest }) => rest),
    label: entry.label,
    total: rows.length,
    lines: rows.slice(-limit),
  }
}

/** The last assistant text in one session, for read-aloud. */
async function lastMessagePayload(sessionId) {
  const wanted = String(sessionId || '')
  if (wanted === '') return { text: '' }
  const files = await allSessionFiles()
  const entry = files.find((file) => path.basename(path.dirname(file.file)) === wanted)
  if (entry === undefined) return { text: '' }
  const text = await readSession(entry.file)
  if (text === null) return { text: '' }
  let last = ''
  for (const line of text.split('\n')) {
    if (line === '') continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (event.type !== 'assistant/message') continue
    const parts = (event.data?.message?.content || []).filter((part) => part?.type === 'text').map((part) => part.text || '')
    const joined = parts.join('\n').trim()
    if (joined !== '') last = joined
  }
  return { text: last.slice(0, 20_000) }
}

/** Notes from the memory store, newest first, with an optional substring filter. */
async function memoryPayload(query) {
  const db = path.join(HOME, '.dsh', 'memory', 'memory.db')
  const q = String(query || '').trim()
  const where = q === '' ? '' : `where text like '%${q.replace(/'/g, "''")}%' or tags like '%${q.replace(/'/g, "''")}%'`
  const sql = `select id, created, updated, kind, tags, text, pinned from note ${where} order by pinned desc, id desc limit 500`
  try {
    const { stdout } = await execFileAsync('sqlite3', ['-json', db, sql], { maxBuffer: 16 * 1024 * 1024, timeout: 15_000 })
    const rows = stdout.trim() === '' ? [] : JSON.parse(stdout)
    return { notes: rows, total: rows.length }
  } catch (error) {
    return { notes: [], total: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Register the panel's routes for this plugin's lifetime. */
export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: 'kanban',
      description:
        'Read or change the shared kanban boards shown in the Harness Kanban panel. Actions: list, add, move, remove, archive, assign, priority. Cards are identified by their exact text or id; columns by id or title (Todo/Doing/Done); boards by id or name (defaults to the active board).',
      parameters: {
        action: { type: 'string', description: 'One of: list, add, move, remove, archive, assign, priority.', required: true },
        board: { type: 'string', description: 'Board id or name. Defaults to the active board.' },
        column: { type: 'string', description: 'Target column id or title (Todo, Doing, Done). Defaults to Todo for add.' },
        text: { type: 'string', description: 'Card text for add.' },
        card: { type: 'string', description: 'Card text or id for move/remove/archive/assign/priority.' },
        position: { type: 'number', description: 'Zero-based position inside the target column for move; omit to append.' },
        assignee: { type: 'string', description: 'Assignee for add/assign; an empty string clears it.' },
        priority: { type: 'string', description: 'low, normal or high, for add/priority.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            message: { type: 'string', required: true },
            board: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: `${value.message}\n\n${value.board}` }],
      },
      async execute(args) {
        const state = await readBoard()
        const board = boardOf(state, args.board)
        if (board === undefined) throw new Error(`unknown board: ${args.board}`)
        const action = String(args.action || 'list').toLowerCase()
        let message = 'Board read.'
        if (action === 'add') {
          const text = String(args.text || '').trim()
          if (text === '') throw new Error('kanban add requires text')
          const column = columnOf(board, args.column)
          if (column === undefined) throw new Error(`unknown column: ${args.column}`)
          column.cards.push(cleanCard({ text, assignee: args.assignee, priority: args.priority }))
          message = `Added "${text}" to ${board.name} / ${column.title}.`
        } else if (action === 'move') {
          const found = cardOf(board, args.card)
          if (found === undefined) throw new Error(`card not found: ${args.card}`)
          const target = columnOf(board, args.column)
          if (target === undefined) throw new Error(`unknown column: ${args.column}`)
          found.column.cards = found.column.cards.filter((card) => card.id !== found.card.id)
          const at = args.position === undefined ? target.cards.length : Math.max(0, Math.min(Number(args.position), target.cards.length))
          target.cards.splice(at, 0, found.card)
          message = `Moved "${found.card.text}" to ${target.title} at ${at}.`
        } else if (action === 'remove') {
          const found = cardOf(board, args.card)
          if (found === undefined) throw new Error(`card not found: ${args.card}`)
          found.column.cards = found.column.cards.filter((card) => card.id !== found.card.id)
          message = `Removed "${found.card.text}".`
        } else if (action === 'archive') {
          const found = cardOf(board, args.card)
          if (found === undefined) throw new Error(`card not found: ${args.card}`)
          found.card.archived = true
          message = `Archived "${found.card.text}".`
        } else if (action === 'assign') {
          const found = cardOf(board, args.card)
          if (found === undefined) throw new Error(`card not found: ${args.card}`)
          found.card.assignee = String(args.assignee || '').slice(0, 60)
          message = found.card.assignee === '' ? `Cleared the assignee on "${found.card.text}".` : `Assigned "${found.card.text}" to ${found.card.assignee}.`
        } else if (action === 'priority') {
          const found = cardOf(board, args.card)
          if (found === undefined) throw new Error(`card not found: ${args.card}`)
          const level = String(args.priority || '').toLowerCase()
          if (!['low', 'normal', 'high'].includes(level)) throw new Error('priority must be low, normal or high')
          found.card.priority = level
          message = `Set "${found.card.text}" to ${level} priority.`
        } else if (action !== 'list') {
          throw new Error(`unknown action: ${args.action}`)
        }
        if (action !== 'list') await writeBoard(state)
        return { ok: true, message, board: boardText(state) }
      },
    }),
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/skills',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => {
          try {
            return json(await skillsPayload())
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'toolbox: skills route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/skills/toggle',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const body = await request.json()
            const dir = String(body?.dir || '')
            if (dir === '' || dir.includes('/') || dir.includes('..')) return json({ error: 'bad dir' }, 400)
            const enable = body?.enable === true
            const from = enable ? RETIRED : SKILLS
            const to = enable ? SKILLS : RETIRED
            await fs.mkdir(to, { recursive: true })
            await fs.rename(path.join(from, dir), path.join(to, dir))
            providerCache = null
            return json({ ok: true, dir, enabled: enable })
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'toolbox: skill toggle route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/skill',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const dir = new URL(request.url).searchParams.get('dir') || ''
            if (dir === '' || dir.includes('/') || dir.includes('..')) return json({ error: 'bad dir' }, 400)
            const body = await skillBody(dir)
            return body === null ? json({ error: 'skill not found' }, 404) : json(body)
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'toolbox: skill body route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/providers',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => {
          try {
            return json(await providersPayload())
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'toolbox: providers route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/ping',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const body = await request.json()
            const provider = String(body?.provider || '')
            const model = String(body?.model || '')
            if (provider === '' || model === '') return json({ error: 'provider and model are required' }, 400)
            const result = await pingRoute(ctx, provider, model)
            providerCache = null
            sessionCache = null
            return json(result)
          } catch (error) {
            return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 200)
          }
        },
      }),
    'toolbox: ping route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/sessions',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => {
          try {
            return json(await sessionsPayload())
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'toolbox: sessions route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/insights',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const days = new URL(request.url).searchParams.get('days') || '30'
            return json(await insightsPayload(days))
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'toolbox: insights route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/logs',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const params = new URL(request.url).searchParams
            return json(await logsPayload(params.get('index') || '0', params.get('tail') || '200', params.get('level') || 'all'))
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'toolbox: logs route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/last-message',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            return json(await lastMessagePayload(new URL(request.url).searchParams.get('sessionId') || ''))
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'toolbox: last-message route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/memory',
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            if (request.method === 'GET') {
              return json(await memoryPayload(new URL(request.url).searchParams.get('q') || ''))
            }
            const body = await request.json()
            const action = String(body?.action || '')
            const mem = path.join(HOME, '.dsh', 'bin', 'mem')
            if (action === 'add') {
              const text = String(body.text || '').trim()
              if (text === '') return json({ error: 'text is required' }, 400)
              const args = ['add', text, '--kind', String(body.kind || 'fact')]
              if (body.tags) args.push('--tags', String(body.tags))
              if (body.pin === true) args.push('--pin')
              const { stdout } = await execFileAsync(mem, args, { timeout: 20_000 })
              return json({ ok: true, message: stdout.trim() })
            }
            if (action === 'forget') {
              const ids = (Array.isArray(body.ids) ? body.ids : []).map((id) => Number(id)).filter((id) => Number.isInteger(id))
              if (ids.length === 0) return json({ error: 'ids are required' }, 400)
              const { stdout } = await execFileAsync(mem, ['forget', ...ids.map(String)], { timeout: 20_000 })
              return json({ ok: true, message: stdout.trim() })
            }
            if (action === 'pin') {
              const id = Number(body.id)
              if (!Number.isInteger(id)) return json({ error: 'id is required' }, 400)
              const db = path.join(HOME, '.dsh', 'memory', 'memory.db')
              await execFileAsync('sqlite3', [db, `update note set pinned = ${body.pinned === true ? 1 : 0} where id = ${id}`], { timeout: 15_000 })
              return json({ ok: true })
            }
            return json({ error: `unknown action: ${action}` }, 400)
          } catch (error) {
            return failure(error, 400)
          }
        },
      }),
    'toolbox: memory route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/toolbox/board',
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            if (request.method === 'GET') return json(await readBoard())
            return json(await writeBoard(await request.json()))
          } catch (error) {
            return failure(error, 400)
          }
        },
      }),
    'toolbox: board route',
  )
}
