# @dsh-local/toolbox

A Toolbox package for DeepSeek Harness that registers four separate sidebar panels: Skills, Providers, Kanban, and Command Center.

- **Skills** — every skill in `~/.dsh/skills` plus the retired set in `~/.dsh/skills-retired`, with the curator's load count and last-seen time, sortable by loads/recent/name, a "never fired" filter, duplicate-name badges, and a switch that moves a skill between the two directories. Disabling is a directory move, because a leading dot does not hide a skill from DSH's catalogue.
- **Providers** — per provider/model totals read from the newest 40 session logs (concatenated zstd JSONL): messages, input/output/cache tokens, mean response time, error count, last used. Cached for a minute on the Host.
- **Kanban** — a three-column board persisted at `~/.dsh/toolbox/board.json`: drag to any position, double-click to edit a card, add and remove.
- **Command Center** — every durable session with status, model, message count, token total and last write, read from the session logs. Read-only: opening a session stays with the sidebar.

Host routes, all under `/api/toolbox/`:

| Route | Method | Purpose |
| --- | --- | --- |
| `/skills` | GET | catalogue + curator stats |
| `/skills/toggle` | POST | move a skill between `skills/` and `skills-retired/` |
| `/providers` | GET | aggregated provider/model activity |
| `/board` | GET/POST | read or replace the board |
| `/sessions` | GET | session dashboard rows |

Install: see the kit [README](../../README.md).
