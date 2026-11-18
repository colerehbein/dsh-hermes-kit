# @dsh-local/toolbox

A Toolbox package for DeepSeek Harness that registers four separate sidebar panels: Skills, Providers, Kanban, and Command Center.

- **Skills** — every skill in `~/.dsh/skills` plus the retired set in `~/.dsh/skills-retired`, with the curator's load count and last-seen time, sortable by loads/recent/name, a "never fired" filter, duplicate-name badges, an inline preview of the skill body (`GET /skill?dir=`), and a switch that moves a skill between the two directories. Disabling is a directory move, because a leading dot does not hide a skill from DSH's catalogue.
- **Providers** — per provider/model totals read from the newest 40 session logs (concatenated zstd JSONL): messages, input/output/cache tokens, mean response time, error count, last used. Cached for a minute on the Host. A **Test** button makes one timed one-token call through `ctx.llm` to that route and reports first-chunk and total time.
- **Kanban** — multiple boards persisted at `~/.dsh/toolbox/board.json` (v1 files migrate on read). Drag to any position, double-click to edit text/assignee/priority, bulk move/archive/delete, archived toggle. A Host `kanban` tool (`list` / `add` / `move` / `remove` / `archive` / `assign` / `priority`) lets the agent read and change the same boards.
- **Insights** — tokens, messages, tool calls and errors per day, per model and per tool over 7/30/90 days.
- **Logs** — severity-filtered tail over the log files that exist, with wrap and auto-refresh.
- **Memory** — browse, search, add, pin and forget notes in the `mem` SQLite store.
- **Header actions** — read the last answer aloud (Web Speech API) and notify when a turn finishes in the background.
- **Command Center** — every durable session with status, model, message count, token total and last write, read from the session logs. **Open** calls `uiWorkspace.openSession`, **Message** sends `session/prompt` (`steer` for a running session, `queue` for an idle one), and active rows carry a **Stop** wired to `session/cancel`.

Host routes, all under `/api/toolbox/`:

| Route | Method | Purpose |
| --- | --- | --- |
| `/skills` | GET | catalogue + curator stats |
| `/skills/toggle` | POST | move a skill between `skills/` and `skills-retired/` |
| `/providers` | GET | aggregated provider/model activity |
| `/board` | GET/POST | read or replace the board |
| `/sessions` | GET | session dashboard rows |
| `/insights` | GET | usage analytics over the session logs |
| `/logs` | GET | one log file's tail, filtered by severity |
| `/memory` | GET/POST | notes: list, add, forget, pin |
| `/last-message` | GET | the last assistant text in a session |
| `/skill` | GET | one skill's SKILL.md body |
| `/ping` | POST | one timed one-token call to a route |

Install: see the kit [README](../../README.md).
