---
name: dsh-checkpoints
description: Use before a destructive or bulk edit in a workspace, and when you need to list, diff or restore an earlier snapshot of files.
---

# dsh-checkpoints

Shadow git snapshots kept outside the project, at
`~/.dsh/checkpoints/<workspace-slug>/repo.git`. CLI: `~/.dsh/bin/ckpt`.

## Use it before

- `rm`, `mv`, bulk rewrites, codemods, migrations, `git reset --hard`, dependency surgery.
- Any edit whose revert is not a single undo.

## Commands

    ~/.dsh/bin/ckpt --path <workspace> snap -m "before <what>"
    ~/.dsh/bin/ckpt --path <workspace> list
    ~/.dsh/bin/ckpt --path <workspace> status
    ~/.dsh/bin/ckpt --path <workspace> diff
    ~/.dsh/bin/ckpt --path <workspace> restore <rev>          # dry run
    ~/.dsh/bin/ckpt --path <workspace> restore <rev> --apply

## Rules

- Snap before, not after. A snapshot taken after the damage restores the damage.
- `--path` is a global flag: it comes before the subcommand.
- Restore writes tracked paths back; files created after the snapshot stay behind. Remove them yourself if they are yours.
- Excluded by default: `.git`, `node_modules`, `.venv`, `dist`, `build`, `target`, caches, logs.
- Snapshots are local and git-deduped. `ckpt gc` collects loose objects.
