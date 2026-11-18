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

## Automatic retention

`mem-consolidate` mines finished session transcripts for standing rules the user stated and
writes the ones that pass a precision gate, then republishes the brief:

    ~/.dsh/bin/mem-consolidate --days 3 --dry-run   # show candidates, write nothing
    ~/.dsh/bin/mem-consolidate --days 7             # apply

It only reads `user/message` events whose `source.kind` is `user` — every other message in a
transcript is injected context (system reminders, skill catalogues, time context) and is not
human speech. It skips questions, imperatives, reactions, profanity and anything scoped to
"right now", because a bad note poisons every future session's brief. State lives in
`~/.dsh/memory/consolidate-state.json`, so a session is consolidated once per mtime.

It is a catch-net, not a replacement for writing a note when you notice one: the rules are
high-precision and low-recall by design.

## Rules

- One note is one standalone sentence. It has to make sense with no conversation around it.
- Search before adding. Upsert matches exact text only, so a paraphrase creates a second note.
- Pin sparingly — the pinned list is the standing brief, not a second inbox.
- The brief IS injected. `install-brief` writes a managed block into `~/.dsh/AGENTS.md`; the
  `dsh-agent-instructions` plugin loads it as the user-global instruction chain on the first request of
  every session, in every workspace, with no restart. After changing memory:
  `~/.dsh/bin/mem brief && ~/.dsh/bin/install-brief`. The block is delimited by
  `<!-- dsh-kit:memory:start -->` … `<!-- dsh-kit:memory:end -->`, so the rest of AGENTS.md is yours.
