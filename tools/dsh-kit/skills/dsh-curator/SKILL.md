---
name: dsh-curator
description: Use when auditing which skills actually fire, pruning a bloated skill catalogue, or deciding what to retire. Mines the local session transcripts for skill loads and tool failures.
---

# dsh-curator

Evidence for skill decisions. Reads `~/.dsh/sessions/**/session.v4.jsonl.zstd` read-only and
compares what loaded against what is installed under `~/.dsh/skills`.

## Commands

    ~/.dsh/bin/curator scan [--since DAYS] [--json PATH]
    ~/.dsh/bin/curator report [--write] [-n 15]
    ~/.dsh/bin/curator never [-n 40]

## Reading it

- **Never loaded is not useless.** Seasonal, reference-only and brand-new skills all show zero.
- **Errors by tool are the actionable half.** A tool failing repeatedly is a workflow signal, not a skill to delete.
- Loads count calls to the `skill` tool. A skill injected by a provider without that call will not appear.

## The loop

1. `curator scan`
2. `curator report --write` — read the never-loaded list against the report's failures.
3. Skills that load often and end in poor outcomes: patch the `SKILL.md`, then rescan next week.
4. Skills never loaded after about six weeks of real use: propose retirement to the user. Never delete unilaterally.

## Limits

- Sessions from before the tool existed carry no data.
- Transcripts are zstd-compressed; a corrupt file is skipped, not fatal.
