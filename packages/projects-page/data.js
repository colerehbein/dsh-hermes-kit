/**
 * Read-only project data for the Projects page.
 *
 * Every value comes from the local filesystem on the Host: each project's
 * TODO.md and the shared ~/.dsh/projects/sessions.jsonl session index.
 * Nothing here writes, creates, or deletes a file.
 */
import { promises as fs } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'
import os from 'node:os'
import path from 'node:path'

/**
 * Fallback roster, used only when the registry file cannot be read. Empty in
 * the published package: a project list is personal, so the page reads the
 * local registry instead of shipping anyone's roster.
 */
export const PROJECTS = []

/** The project registry written by `proj import` / `proj adopt`. */
export const REGISTRY_PATH = path.join(os.homedir(), '.dsh', 'projects', 'projects.json')

/**
 * The live roster: the registry when it reads, the embedded fallback otherwise.
 * Read per request, so `proj adopt` shows up on the next refresh with no rebuild.
 */
export async function loadProjects() {
  try {
    const raw = JSON.parse(await fs.readFile(REGISTRY_PATH, 'utf8'))
    const entries = Array.isArray(raw?.projects) ? raw.projects : []
    const mapped = entries
      .filter((entry) => typeof entry?.slug === 'string' && typeof entry?.primary === 'string' && entry.primary !== '')
      .map((entry) => ({
        id: entry.slug,
        name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : entry.slug,
        path: entry.primary,
      }))
    if (mapped.length > 0) return mapped
  } catch {
    /* fall through to the embedded roster */
  }
  return PROJECTS
}

/** The session index the page reads; missing or unreadable is reported, not created. */
export const SESSIONS_PATH = path.join(os.homedir(), '.dsh', 'projects', 'sessions.jsonl')

/** Human-readable form of {@link SESSIONS_PATH}. */
export const SESSIONS_DISPLAY_PATH = '~/.dsh/projects/sessions.jsonl'

/** Refuse to load an oversized TODO.md in full; report the cut instead. */
const TODO_MAX_BYTES = 512 * 1024

/** Stop parsing a huge TODO.md after this many lines and report the cut. */
const TODO_MAX_LINES = 4000

/** Stop listing subfolders after this many entries. */
const FOLDER_MAX = 500

const OPEN_ITEM = /^- \[ \](?:\s+|$)/u
const DONE_ITEM = /^- \[x\](?:\s+|$)/iu
const HEADING = /^(#{1,6})\s+(.*)$/u

/** Error text that never leaks a stack trace into the page. */
function reasonOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Classify TODO.md lines so the page renders the file without re-parsing it.
 * @param text - raw file text.
 * @returns checkbox counts and renderable lines.
 */
function parseTodo(text) {
  const lines = text.replace(/^\uFEFF/u, '').split(/\r?\n/u)
  let open = 0
  let done = 0
  const items = []
  let truncated = false
  for (const line of lines) {
    if (items.length >= TODO_MAX_LINES) {
      truncated = true
      break
    }
    const trimmed = line.trim()
    if (trimmed === '') {
      items.push({ kind: 'blank', text: '' })
      continue
    }
    const heading = HEADING.exec(trimmed)
    if (heading !== null) {
      items.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }
    if (OPEN_ITEM.test(trimmed)) {
      open += 1
      items.push({ kind: 'open', text: trimmed.slice(5).trim() })
      continue
    }
    if (DONE_ITEM.test(trimmed)) {
      done += 1
      items.push({ kind: 'done', text: trimmed.slice(5).trim() })
      continue
    }
    items.push({ kind: 'text', text: line })
  }
  return { open, done, items, truncated }
}

/** Stop stat-ing entries when a project root is enormous. */
const MODIFIED_MAX_ENTRIES = 200

/**
 * Newest mtime among the project folder and the files directly inside it.
 * @param dir - project directory.
 */
async function lastModified(dir) {
  const times = []
  try {
    const entries = (await fs.readdir(dir, { withFileTypes: true })).slice(0, MODIFIED_MAX_ENTRIES)
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name !== 'README.md' && entry.name !== 'TODO.md')
        .map(async (entry) => {
          try {
            const stats = await fs.stat(path.join(dir, entry.name))
            times.push(stats.mtimeMs)
          } catch {
            /* a vanished entry is not a failure for this read */
          }
        }),
    )
  } catch {
    /* unreadable folder: no modification time */
  }
  return times.length > 0 ? new Date(Math.max(...times)).toISOString() : null
}

/**
 * Read one project's TODO.md.
 * @param projectPath - project directory.
 */
export async function readTodo(projectPath) {
  const file = path.join(projectPath, 'TODO.md')
  let stats
  try {
    stats = await fs.stat(file)
  } catch (error) {
    return { exists: false, error: null, path: file, open: 0, done: 0, items: [], truncated: false, reason: reasonOf(error) }
  }
  try {
    let text
    let truncated = false
    if (stats.size > TODO_MAX_BYTES) {
      const handle = await fs.open(file, 'r')
      try {
        const buffer = Buffer.alloc(TODO_MAX_BYTES)
        const { bytesRead } = await handle.read(buffer, 0, TODO_MAX_BYTES, 0)
        text = buffer.subarray(0, bytesRead).toString('utf8')
        truncated = true
      } finally {
        await handle.close()
      }
    } else {
      text = await fs.readFile(file, 'utf8')
    }
    const parsed = parseTodo(text)
    return {
      exists: true,
      error: null,
      path: file,
      open: parsed.open,
      done: parsed.done,
      items: parsed.items,
      truncated: truncated || parsed.truncated,
      bytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
    }
  } catch (error) {
    return { exists: true, error: reasonOf(error), path: file, open: 0, done: 0, items: [], truncated: false }
  }
}

/**
 * List the project directory's immediate subfolders.
 * @param projectPath - project directory.
 */
export async function listFolders(projectPath) {
  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true })
    const names = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, 'en-US', { numeric: true, sensitivity: 'base' }))
    return { exists: true, error: null, names: names.slice(0, FOLDER_MAX), total: names.length, truncated: names.length > FOLDER_MAX }
  } catch (error) {
    return { exists: false, error: reasonOf(error), names: [], total: 0, truncated: false }
  }
}

/**
 * Read the shared session index. Malformed lines are skipped, not repaired.
 */
export async function readSessions() {
  let text
  try {
    text = await fs.readFile(SESSIONS_PATH, 'utf8')
  } catch (error) {
    return { exists: false, error: reasonOf(error), total: 0, rows: [] }
  }
  const rows = []
  let skipped = 0
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim() === '') continue
    try {
      const raw = JSON.parse(line)
      if (typeof raw?.id !== 'string' || typeof raw?.cwd !== 'string' || typeof raw?.started !== 'string') {
        skipped += 1
        continue
      }
      rows.push({
        id: raw.id,
        cwd: raw.cwd,
        title: typeof raw.title === 'string' ? raw.title : '',
        project: typeof raw.project === 'string' ? raw.project : null,
        source: typeof raw.source === 'string' ? raw.source : null,
        started: raw.started,
        events: typeof raw.events === 'number' ? raw.events : null,
      })
    } catch {
      skipped += 1
    }
  }
  return { exists: true, error: null, total: rows.length, skipped, rows }
}

/** Newest first; ISO timestamps sort lexically. */
function byNewest(left, right) {
  return right.started.localeCompare(left.started)
}

/**
 * Sessions recorded for exactly one project folder.
 * @param sessions - rows from {@link readSessions}.
 * @param projectPath - project directory.
 */
export function sessionsFor(sessions, projectPath) {
  const root = projectPath.endsWith('/') ? projectPath.slice(0, -1) : projectPath
  return sessions.rows
    .filter((row) => row.cwd === root || row.cwd.startsWith(root + '/'))
    .sort(byNewest)
}

/**
 * Build one list row.
 * @param project - fixed project entry.
 * @param sessions - rows from {@link readSessions}.
 */
export async function summarizeProject(project, sessions) {
  const [todo, stat, modifiedAt] = await Promise.all([
    readTodo(project.path),
    fs.stat(project.path).then(() => true, () => false),
    lastModified(project.path),
  ])
  const mine = sessionsFor(sessions, project.path)
  return {
    id: project.id,
    name: project.name,
    path: project.path,
    exists: stat,
    todoExists: todo.exists,
    todoError: todo.error,
    openCount: todo.open,
    doneCount: todo.done,
    modifiedAt,
    latest: mine[0] ?? null,
    sessionCount: mine.length,
  }
}

/** Payload for the page's first read: every project in the registry. */
export async function listPayload() {
  const sessions = await mergedSessions()
  const projects = []
  for (const project of await loadProjects()) {
    projects.push(await summarizeProject(project, sessions))
  }
  return {
    generatedAt: new Date().toISOString(),
    sessionsPath: SESSIONS_DISPLAY_PATH,
    sessions: { exists: sessions.exists, error: sessions.error, total: sessions.total, skipped: sessions.skipped ?? 0 },
    projects,
  }
}

/**
 * Payload for one opened project: folders, full TODO, five newest sessions.
 * @param id - project slug from the registry.
 */
export async function detailPayload(id) {
  const project = (await loadProjects()).find((entry) => entry.id === id)
  if (project === undefined) return { error: 'unknown-project' }
  const sessions = await mergedSessions()
  const [todo, folders, summary] = await Promise.all([
    readTodo(project.path),
    listFolders(project.path),
    summarizeProject(project, sessions),
  ])
  const mine = sessionsFor(sessions, project.path)
  return {
    generatedAt: new Date().toISOString(),
    sessionsPath: SESSIONS_DISPLAY_PATH,
    sessions: { exists: sessions.exists, error: sessions.error, total: sessions.total, skipped: sessions.skipped ?? 0 },
    project: summary,
    folders,
    todo,
    sessionTotal: mine.length,
    sessions: mine.slice(0, 200),
  }
}

/** Index rows plus every DSH session on disk, so a brand-new Session shows up too. */
async function mergedSessions() {
  const indexed = await readSessions()
  const rows = indexed.rows.map((row) => ({ ...row }))
  const seen = new Set(rows.map((row) => row.id))
  for (const [id, meta] of await liveDshSessions()) {
    if (seen.has(id)) continue
    seen.add(id)
    rows.push({
      id,
      cwd: meta.cwd,
      title: meta.title,
      project: null,
      source: 'dsh',
      started: meta.started,
      events: meta.events,
    })
  }
  rows.sort(byNewest)
  return { ...indexed, rows, total: rows.length }
}

const SESSIONS_ROOT = path.join(os.homedir(), '.dsh', 'sessions')

/** Only scan session files touched in this window; the sidebar shows recent work. */
const LIVE_SCAN_DAYS = 30

/**
 * Session id → cwd for DSH sessions on disk, including ones the index has not seen.
 */
async function liveDshSessions() {
  const out = new Map()
  let roots
  try {
    roots = await fs.readdir(SESSIONS_ROOT, { withFileTypes: true })
  } catch {
    return out
  }
  const cutoff = Date.now() - LIVE_SCAN_DAYS * 86400000
  await Promise.all(
    roots.filter((entry) => entry.isDirectory()).map(async (root) => {
      let dirs
      try {
        dirs = await fs.readdir(path.join(SESSIONS_ROOT, root.name), { withFileTypes: true })
      } catch {
        return
      }
      await Promise.all(
        dirs.filter((entry) => entry.isDirectory()).map(async (dir) => {
          const file = path.join(SESSIONS_ROOT, root.name, dir.name, 'session.v4.jsonl.zstd')
          try {
            const stats = await fs.stat(file)
            if (stats.mtimeMs < cutoff) return
            const text = zstdDecompressSync(await fs.readFile(file)).toString('utf8')
            const lines = text.split('\n')
            let meta = null
            let title = ''
            let events = 0
            for (const line of lines) {
              if (line.trim() === '') continue
              events += 1
              if (meta === null) {
                try {
                  meta = JSON.parse(line)
                } catch {
                  meta = {}
                }
                continue
              }
              if (line.includes('"session/title"')) {
                try {
                  const event = JSON.parse(line)
                  if (typeof event?.data?.title === 'string') title = event.data.title
                } catch {
                  /* a partial title line is not worth failing the scan */
                }
              }
            }
            if (typeof meta?.id === 'string' && typeof meta?.cwd === 'string') {
              out.set(meta.id, {
                cwd: meta.cwd,
                title,
                started: typeof meta.createdAt === 'number' ? new Date(meta.createdAt).toISOString() : '',
                events,
              })
            }
          } catch {
            /* unreadable or not a session header: skip */
          }
        }),
      )
    }),
  )
  return out
}

/**
 * Session id → project name, for the sidebar hover card.
 * Longest folder prefix wins, so nested projects beat their parents.
 */
export async function marksPayload() {
  const projects = await loadProjects()
  const sessions = await readSessions()
  const cwds = new Map(sessions.rows.map((row) => [row.id, row.cwd]))
  for (const [id, meta] of await liveDshSessions()) cwds.set(id, meta.cwd)
  const marks = {}
  for (const [id, cwd] of cwds) {
    let best = null
    for (const project of projects) {
      const root = project.path.endsWith('/') ? project.path.slice(0, -1) : project.path
      if (cwd === root || cwd.startsWith(root + '/')) {
        if (best === null || root.length > best.root.length) best = { root, name: project.name }
      }
    }
    if (best !== null) marks[id] = best.name
  }
  return { marks }
}

/** Files the project panel will show, in order. Nothing outside this list is read. */
const DOC_FILES = ['README.md', 'TODO.md', 'AGENTS.md', 'CLAUDE.md', 'IDEA.md']

/** One document is capped so a huge README cannot stall the panel. */
const DOC_MAX_BYTES = 256 * 1024

/**
 * The documents of one project, read from its primary folder.
 * @param slug - project slug from the registry.
 */
export async function docsPayload(slug) {
  if (typeof slug !== 'string' || slug === '') return { error: 'missing-project' }
  const project = (await loadProjects()).find((entry) => entry.id === slug)
  if (project === undefined) return { error: 'unknown-project' }
  const docs = []
  for (const name of DOC_FILES) {
    const file = path.join(project.path, name)
    try {
      const stats = await fs.stat(file)
      const text = await fs.readFile(file, 'utf8')
      docs.push({
        name,
        exists: true,
        text: text.length > DOC_MAX_BYTES ? text.slice(0, DOC_MAX_BYTES) : text,
        bytes: stats.size,
        truncated: stats.size > DOC_MAX_BYTES,
        updatedAt: stats.mtime.toISOString(),
      })
    } catch {
      docs.push({ name, exists: false })
    }
  }
  return { project: { id: project.id, name: project.name, path: project.path }, docs }
}
