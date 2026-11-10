/**
 * Host half of the Projects page.
 *
 * It exposes exactly two read-only JSON routes on the authenticated `/api`
 * channel — the project list and one opened project — and reads the local
 * TODO.md files plus ~/.dsh/projects/sessions.jsonl for them. Nothing is
 * written back, and no request can name a path: the client sends a project id
 * that must match the fixed list in ./data.js.
 */
import { detailPayload, docsPayload, listPayload, marksPayload } from './data.js'

/** Shared prefix of this plugin's exact Fetch routes. */
const ROUTE_BASE = '/api/projects-page'

/** Required carrier service; without it the page could not reach the Host. */
export const inject = ['connection']

/**
 * One JSON response with caching disabled.
 * @param body - JSON-serializable payload.
 * @param status - HTTP status.
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * Serve one read, converting a failure into a reported error rather than a crash.
 * @param read - payload producer.
 */
async function serve(read) {
  try {
    return json(await read())
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
}

/**
 * Register the page's read routes for this plugin's lifetime.
 * @param ctx - plugin context.
 */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: `${ROUTE_BASE}/projects`,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: () => serve(listPayload),
      }),
    'projects-view: list route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: `${ROUTE_BASE}/docs`,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const slug = new URL(request.url).searchParams.get('slug')
          try {
            const payload = await docsPayload(slug)
            return 'error' in payload ? json(payload, 404) : json(payload)
          } catch (error) {
            return json({ error: error instanceof Error ? error.message : String(error) }, 500)
          }
        },
      }),
    'projects-view: docs route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: `${ROUTE_BASE}/marks`,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: () => serve(marksPayload),
      }),
    'projects-view: marks route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: `${ROUTE_BASE}/project`,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const id = new URL(request.url).searchParams.get('id')
          if (id === null || id === '') return json({ error: 'missing-project' }, 400)
          try {
            const payload = await detailPayload(id)
            return 'error' in payload ? json(payload, 404) : json(payload)
          } catch (error) {
            return json({ error: error instanceof Error ? error.message : String(error) }, 500)
          }
        },
      }),
    'projects-view: detail route',
  )
}
