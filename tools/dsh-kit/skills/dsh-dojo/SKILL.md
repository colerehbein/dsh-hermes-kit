---
name: dsh-dojo
description: Use when the agent keeps failing the same way, when a session went badly and the cause should outlive it, or when asked what the agent has learned. Mines real session transcripts for tool errors, repeated identical calls, and frustration turns, then writes a report and reviewable proposals.
---

# dsh-dojo

Self-improvement over real transcripts, not over intentions. CLI: `~/.dsh/bin/dojo`.

It reads `~/.dsh/sessions/**/session.v4.jsonl.zstd` and looks for three kinds of friction:

1. **Tool errors** — the same tool failing repeatedly, grouped by a signature line.
2. **Churn** — the same tool call with identical arguments three or more times in one session.
   That is the shape of re-deriving a fact the agent already had.
3. **Frustration turns** — a user message carrying strong negative feedback, with the three
   tool calls that preceded it.

## Commands

    ~/.dsh/bin/dojo                  # last 7 days
    ~/.dsh/bin/dojo --days 14
    ~/.dsh/bin/dojo --report-only    # write the report, apply no lessons

## Output

    ~/.dsh/curator/dojo-report.md      # the findings
    ~/.dsh/curator/dojo-proposals.md   # what to change, for a human to review
    ~/.dsh/curator/dojo.log            # one line per run

## Rules

- **It never edits skills or instruction files on its own.** It writes proposals. A loop that
  silently rewrites its own instructions is how an agent gets worse, not better.
- The one thing it applies automatically is a memory lesson for a tool that failed repeatedly —
  specific, checkable, and reversible with `mem forget`.
- Only `user/message` events with `source.kind == "user"` count as human speech. Everything else
  in a transcript is injected context and must be ignored, or the frustration detector fires on
  system reminders.
- A tool result is attributed to a tool through `data.message.toolCallId`; a failure that cannot
  be attributed is dropped rather than guessed at.
- Run it after a bad session, not on a schedule you never read. The report is only useful if
  someone acts on the proposals.
