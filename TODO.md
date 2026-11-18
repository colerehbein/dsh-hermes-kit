# TODO — dsh-hermes-kit

## Next

- [ ] Session import from ChatGPT / Claude exports — **blocked, not shipped.** A hand-written log passes the persistence validators (two zstd frames with the header alone in the first, `turn/start`+`step/start` around each message, `surfaceOp` at the event root, `request/header` with a `reason`, `stream: []` on assistant messages, a `system/message` as the protected first surface node) and the workspace can attach it, but the client's projection pass still throws `Cannot read properties of undefined (reading 'kind')`. `readSession`, `readTitle`, `readSurface` and `listEvents` all succeed on the same file, so the failing projection only runs in the `session/projections` path. Creating the session through `ctx.sessions.create` with a seed is refused by the store's inherited-cut rule and never persists. Needs a Host-side import API, not a file writer.
- [ ] Dojo: proposals the agent can act on without a human reading a markdown file (needs a review surface)
- [x] Command Center: Open, Stop, Message (steer/queue)
- [ ] Command Center actions: open, steer, stop (needs the live session projection API, not just log files)

## Later

- [ ] Screenshot refresh after the next UI change
- [ ] Publish the plugin packages to npm (optional; `file:` install works today)

## Done

- [x] `mem-consolidate` — automatic memory retention over finished transcripts
- [x] `dojo` — self-improvement loop: tool errors, churn, frustration turns
- [x] `dsh-dojo` skill; consolidation documented in `dsh-memory`

- [x] Model picker with favorites, collapsible providers, reasoning levels, Edit models
- [x] Projects page
- [x] Toolbox: skills manager, provider health, kanban board
- [x] Command Center dashboard (read-only)
- [x] Kanban insert at drop position + double-click card editing
- [x] Skills sort, never-fired filter, duplicate-name badges
- [x] Provider mean response time
- [x] Command Center Stop (session/cancel)
- [x] Command Center Open (uiWorkspace.openSession)
- [x] Command Center Message (session/prompt steer/queue)
- [x] `kanban` agent tool (list/add/move/remove)
- [x] Provider Test button (one-token ping)
- [x] Skill body preview in the Skills panel
- [x] One-command installer and CLI kit (memory, checkpoints, curator, registry, skill audit)
