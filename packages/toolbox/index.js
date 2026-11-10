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

/** Required carrier service for the authenticated route registry. */
export const inject = ['connection']

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
  const rows = [...active, ...retired].map((row) => ({
    ...row,
    loads: loads[row.name] || 0,
    lastSeen: lastSeen[row.name] || null,
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
        if (config?.provider && config?.model) last = config
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
    rows: [...rows.values()].sort((a, b) => b.totalTokens - a.totalTokens || b.messages - a.messages),
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

/** Register the panel's routes for this plugin's lifetime. */
export function apply(ctx) {
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
