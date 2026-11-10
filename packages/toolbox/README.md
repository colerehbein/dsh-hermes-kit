# @dsh-local/toolbox

A Toolbox panel for DeepSeek Harness: skills manager, provider health, and a kanban board — one sidebar row, three tabs.

- **Skills** — every skill in `~/.dsh/skills` plus the retired set in `~/.dsh/skills-retired`, with the curator's load count and last-seen time, a filter, and a switch that moves a skill between the two directories. Disabling is a directory move, because a leading dot does not hide a skill from DSH's catalogue.
- **Providers** — per provider/model totals read from the newest 40 session logs (concatenated zstd JSONL): messages, input/output/cache tokens, error count, last used. Cached for a minute on the Host.
- **Board** — a three-column kanban persisted at `~/.dsh/toolbox/board.json`, with drag-and-drop between columns, add and remove.

Host routes, all under `/api/toolbox/`:

| Route | Method | Purpose |
| --- | --- | --- |
| `/skills` | GET | catalogue + curator stats |
| `/skills/toggle` | POST | move a skill between `skills/` and `skills-retired/` |
| `/providers` | GET | aggregated provider/model activity |
| `/board` | GET/POST | read or replace the board |

Install: see the kit [README](../../README.md).
