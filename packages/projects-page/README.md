# @dsh-local/projects-page

A Projects panel for DeepSeek Harness: every project in `~/.dsh/projects/projects.json`, its open `TODO.md` items, top-level folders, and newest sessions.

Read-only. The Host half exposes three `/api/projects-page/*` routes; the client half registers `sidebar.panellist`, `sidebar.session.row.hover`, and `main` slots.

Project data is read per request, so `proj adopt` shows up on the next refresh with no rebuild. The published fallback roster is empty on purpose — a project list is personal and comes from your own registry.

Install: see the kit [README](../../README.md).
