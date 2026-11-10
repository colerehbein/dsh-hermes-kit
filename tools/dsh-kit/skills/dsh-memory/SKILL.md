---
name: dsh-memory
description: Use when a durable fact, preference, decision or lesson should outlive this session, or when you need what was remembered before. Stores notes in SQLite with full-text search and renders a brief.
---

# dsh-memory

Persistent notes across sessions. Store: `~/.dsh/memory/memory.db`. CLI: `~/.dsh/bin/mem`.

## When to write

- A preference the user states once — terse answers, never run brew without asking.
- A decision and its reason — "kept Hindsight as the system of record, not a second store".
- A person or project fact that will matter next week.

Never store secrets, tokens, one-off task state, or anything the user asked to forget.

## When to read

- Start of a task that depends on the user's standing preferences.
- Before answering "what did we decide about X".
- `mem brief` prints pinned + recent and rewrites `~/.dsh/memory/BRIEF.md`.

## Commands

    ~/.dsh/bin/mem add "text" --kind pref|fact|decision|person|project|lesson --tags a,b [--pin]
    ~/.dsh/bin/mem search "query" -n 10
    ~/.dsh/bin/mem list --kind pref
    ~/.dsh/bin/mem brief
    ~/.dsh/bin/mem forget <id>...
    ~/.dsh/bin/mem stats

## Rules

- One note is one standalone sentence. It has to make sense with no conversation around it.
- Search before adding. Upsert matches exact text only, so a paraphrase creates a second note.
- Pin sparingly — the pinned list is the standing brief, not a second inbox.
- The brief IS injected. `install-brief` writes a managed block into `~/.dsh/AGENTS.md`; the
  `dsh-agent-instructions` plugin loads it as the user-global instruction chain on the first request of
  every session, in every workspace, with no restart. After changing memory:
  `~/.dsh/bin/mem brief && ~/.dsh/bin/install-brief`. The block is delimited by
  `<!-- dsh-kit:memory:start -->` … `<!-- dsh-kit:memory:end -->`, so the rest of AGENTS.md is yours.
