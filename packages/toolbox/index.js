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

function emptyBoard() {
  return {
    version: 1,
    columns: [
      { id: 'todo', title: 'Todo', cards: [] },
      { id: 'doing', title: 'Doing', cards: [] },
      { id: 'done', title: 'Done', cards: [] },
    ],
  }
}

async function readBoard() {
  try {
    const parsed = JSON.parse(await fs.readFile(BOARD, 'utf8'))
    if (Array.isArray(parsed?.columns)) return parsed
  } catch {
    /* first run */
  }
  return emptyBoard()
}

async function writeBoard(body) {
  if (!Array.isArray(body?.columns)) throw new Error('board.columns must be an array')
  const clean = {
    version: 1,
    columns: body.columns.map((column, index) => ({
      id: String(column?.id || `c${index}`),
      title: String(column?.title || `Column ${index + 1}`).slice(0, 60),
      cards: (Array.isArray(column?.cards) ? column.cards : []).slice(0, 200).map((card) => ({
        id: String(card?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        text: String(card?.text || '').slice(0, 500),
      })),
    })),
  }
  await fs.mkdir(path.dirname(BOARD), { recursive: true })
  const tmp = `${BOARD}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(clean, null, 2)}\n`)
  await fs.rename(tmp, BOARD)
  return clean
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
function boardText(board) {
  return board.columns.map((column) => `${column.title} (${column.cards.length}): ${column.cards.map((card) => card.text).join(' | ') || '—'}`).join('\n')
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

/** Register the panel's routes for this plugin's lifetime. */
export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: 'kanban',
      description:
        'Read or change the shared kanban board shown in the Harness Kanban panel. Actions: list, add, move, remove. Cards are identified by their exact text or id; columns by id or title (Todo/Doing/Done).',
      parameters: {
        action: { type: 'string', description: 'One of: list, add, move, remove.', required: true },
        column: { type: 'string', description: 'Target column id or title (Todo, Doing, Done). Defaults to Todo for add.' },
        text: { type: 'string', description: 'Card text for add.' },
        card: { type: 'string', description: 'Card text or id for move/remove.' },
        position: { type: 'number', description: 'Zero-based position inside the target column for move; omit to append.' },
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
        const board = await readBoard()
        const action = String(args.action || 'list').toLowerCase()
        let message = 'Board read.'
        if (action === 'add') {
          const text = String(args.text || '').trim()
          if (text === '') throw new Error('kanban add requires text')
          const column = columnOf(board, args.column)
          if (column === undefined) throw new Error(`unknown column: ${args.column}`)
          column.cards.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: text.slice(0, 500) })
          message = `Added "${text}" to ${column.title}.`
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
        } else if (action !== 'list') {
          throw new Error(`unknown action: ${args.action}`)
        }
        if (action !== 'list') await writeBoard(board)
        return { ok: true, message, board: boardText(board) }
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
