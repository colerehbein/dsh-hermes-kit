# dsh-kit

Three things the DeepSeek Harness was missing: **memory that survives a session**, **snapshots you can restore**, and **evidence about which skills actually fire** — plus a small registry helper and a skill-library audit.

Pure Python 3, standard library only. Installs into `$DSH_HOME` (`~/.dsh` by default).

| Tool | Command | Store |
| --- | --- | --- |
| Memory | `~/.dsh/bin/mem` | `~/.dsh/memory/memory.db` (SQLite + FTS5) |
| Checkpoints | `~/.dsh/bin/ckpt` | `~/.dsh/checkpoints/<slug>/repo.git` (shadow git) |
| Curator | `~/.dsh/bin/curator` | `~/.dsh/curator/{stats.json,report.md}` |
| Projects | `~/.dsh/bin/proj` | `~/.dsh/projects/projects.json` |

The three skills (`dsh-memory`, `dsh-checkpoints`, `dsh-curator`) are installed into the skill catalogue and load on demand, so the agent knows when to reach for each tool without being told every session.

## Memory

```sh
mem add "prefers the number first" --kind pref --tags style --pin
mem search "terse"          # FTS5, falls back to LIKE on syntax errors
mem list --kind decision
mem brief                   # pinned + recent; also writes memory/BRIEF.md
mem forget 4 7
mem stats
```

Kinds: `fact`, `pref`, `decision`, `person`, `project`, `lesson`. Exact-text duplicates update the existing note instead of adding a second one.

**Injection.** `install-brief` writes a managed block into `~/.dsh/AGENTS.md`, the user-global instruction file loaded at the first request of every session — every workspace, no restart. After `mem brief`, run `install-brief`; the next session carries it. `install-brief --remove` takes it back out and leaves the rest of the file untouched.

**Importing.** `import-memory --dir ~/hermes-export` reads `MEMORY.md` / `USER.md` blocks separated by a lone `§`, classifies each block, and pins the hard rules.

## Checkpoints

```sh
ckpt --path ~/projects/thing snap -m "before the codemod"
ckpt --path ~/projects/thing status
ckpt --path ~/projects/thing restore <rev> --apply
```

Snapshots live outside the workspace, so `git reset --hard` in the project cannot destroy them. Excluded by default: `.git`, `node_modules`, `.venv`, `dist`, `build`, `target`, caches, logs.

**Limit:** manual — there is no pre-write hook, so the agent has to snap before it starts.

## Curator

```sh
curator scan [--since 30]
curator report --write
curator never -n 40
```

Reads `~/.dsh/sessions/**/session.v4.jsonl.zstd` and reports skill loads, tool error rates, and skills that never loaded. Read-only.

**Limit:** only sessions recorded after install carry data, and "never loaded" is not "useless" — narrow triggers often look dead in a short window.

## Projects registry

```sh
proj import --db ~/.hermes/projects.db   # read-only on the source
proj list
proj show <slug>
proj sessions <slug>
```

Writes `~/.dsh/projects/projects.json`, the registry the Projects page in this kit reads. Adopt an existing folder with `proj adopt <path>`.

## Skill-library audit (extras)

`extras/skill-audit/audit_skills.py` inventories a `~/.dsh/skills` tree — frontmatter, trigger length, body size, stale tool references, duplicate content, dead `references/**/SKILL.md` — and writes `inventory.json`. `apply.py` moves the redundant paths it identifies to `~/.dsh/skills-retired/`, dry-run by default, with `--undo`.

This is the evidence half of skill maintenance: the curator says what fires, the audit says what is duplicated or broken.

## Layout

```text
dsh-kit/
  bin/{mem,ckpt,curator,proj,import-memory,install-brief}
  skills/dsh-{memory,checkpoints,curator}/SKILL.md
  extras/skill-audit/{audit_skills.py,apply.py}
  install.sh                 # --dry-run supported
```

## Install

```sh
git clone https://github.com/colerehbein/dsh-hermes-kit.git
cd dsh-hermes-kit/tools/dsh-kit
./install.sh --dry-run     # see what would happen
./install.sh
```

`DSH_HOME` overrides the install root. Restart is not needed: the skills are picked up from the catalogue and the CLIs are plain files.

## Uninstall

```sh
rm ~/.dsh/bin/{mem,ckpt,curator,proj,import-memory,install-brief}
rm -rf ~/.dsh/skills/{dsh-memory,dsh-checkpoints,dsh-curator}
```

Data stays under `~/.dsh/{memory,curator,checkpoints,projects}` — remove by hand if you want it gone.

## License

MIT — see [LICENSE](LICENSE).
