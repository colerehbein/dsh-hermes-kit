# dsh-hermes-kit

Hermes desktop's good ideas, rebuilt as native [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugins — plus the small tools the harness itself was missing.

The Hermes desktop app has a genuinely better composer model menu than stock DSH: one searchable panel, favorites above the providers, collapsible provider groups, per-model reasoning levels, and an "Edit models" dialog that decides which models appear at all. This kit ports that surface to DSH's client plugin system, plus the Projects page Hermes users miss.

![Model picker](docs/images/model-picker.png)

## What's in the box

| Path | What it is |
| --- | --- |
| [`packages/model-picker`](packages/model-picker) | The composer model seat: search, favorites, collapsible providers, reasoning levels, and the **Edit models** visibility editor. One plugin, nine behaviours. |
| [`packages/projects-page`](packages/projects-page) | A Projects panel: registry roster, open `TODO.md` items, subfolders, newest sessions, session hover marks. Read-only. |
| [`providers/providers.example.yml`](providers/providers.example.yml) | Paste-ready `llm-pi-ai` routes for Nous Research, Command Code (chat **and** Anthropic Messages), and a local OmniRoute — all 51 models from the setup these plugins were built against. |
| [`tools/dsh-kit`](tools/dsh-kit) | Memory, shadow-git checkpoints, a skill curator, the projects registry, and a skill-library audit. Stdlib Python, installs into `~/.dsh`. |
| [`docs/hermes-parity.md`](docs/hermes-parity.md) | Hermes source file → DSH implementation map, including what was deliberately dropped and why. |

Neither package ships personal data: the Projects roster is read from your own local registry, and the picker keeps its state in `localStorage`.

### Everything the model picker replaces

| Behaviour | Detail |
| --- | --- |
| Search | Ordered-subsequence match over model names, per-character highlight, providers kept in place |
| Favorites | Star any row or `Shift+Enter`; pinned above the providers; exempt from the visibility filter; never listed twice |
| Provider groups | Collapsible with live counts, remembered across reloads |
| Reasoning levels | Row chip opens `default / off / low / medium / high` for that exact model and commits model + effort |
| Edit models | Per-model switches, provider master switch with indeterminate state, `on/total` counters, filter, reset |
| Visibility rules | Hide-all sentinel per provider, new models default visible, favorites exempt, reset clears |
| Active state | Check on the current model, pending indicator while a switch commits |
| Failures | Catalog-failure and selection-error strips with retry |
| Keyboard + a11y | `↑`/`↓`/`Enter`/`Shift+Enter`/`Esc`, focus stays in search, listbox semantics, portaled panel |

## The model picker

![Edit models](docs/images/edit-models.png)

- **One panel, not drilled menus.** Search matches model names by ordered subsequence and highlights the hit; providers stay grouped with live counts.
- **Favorites** sit above the providers, starred with the star on any row (or `Shift+Enter` on the highlighted one). A favorite is exempt from the visibility filter and is not repeated in its provider group.
- **Provider groups collapse** and remember it.
- **Reasoning levels** are one click from the row: the chip opens `default / off / low / medium / high` for that exact model, and picking one selects the model with that effort.
- **Edit models…** opens a visibility editor: every model in the catalog, a switch per model, a provider master switch with an indeterminate state, `on/total` counters, a filter, and *Reset to defaults*.

Visibility semantics follow Hermes rather than a naive checklist:

- Never curated means everything shows.
- Hiding a provider's last model records a hide-all sentinel, so its old defaults do not creep back; re-enabling one model brings back only that model.
- Models that appear after you curate (a new provider, a refreshed catalog) default to **visible**, tracked with a "known keys" snapshot.
- `Reset to defaults` clears both keys and returns to everything-visible.

Keyboard: `↑`/`↓` move the highlight, `Enter` selects, `Shift+Enter` stars, `Esc` leaves the editor (or closes the panel). Focus stays in the search field.

### How it slots in

The composer's model seat is a single slot (`conversation.input.model`). A single slot renders the **lowest priority** occupant and every occupant must claim a distinct one, so the picker registers at `priority: -1` and shadows the shipped menu without a duplicate-registration error. Data and submission ride the same per-session `modelDirectories` service the stock picker uses, so switching models keeps DSH's durable selection behaviour.

## Tooling (`tools/dsh-kit`)

| Tool | What it does |
| --- | --- |
| `mem` | SQLite + FTS5 memory across sessions: `add`, `search`, `brief`, `forget`. `install-brief` injects the brief into `~/.dsh/AGENTS.md`, so every new session starts with it. |
| `ckpt` | Shadow-git snapshots stored outside the workspace — `git reset --hard` can't eat them. |
| `curator` | Reads `~/.dsh/sessions/**/session.v4.jsonl.zstd` and reports which skills load, tool error rates, and which never fire. |
| `proj` | Imports a Hermes `projects.db` into `~/.dsh/projects/projects.json` — the registry the Projects page reads. |
| `extras/skill-audit` | Inventories a skill library, finds duplicate and broken entries, and plans a retirement with a dry run. |

Three skills (`dsh-memory`, `dsh-checkpoints`, `dsh-curator`) ship with them, so the agent knows when to reach for each tool. Full details in [`tools/dsh-kit/README.md`](tools/dsh-kit/README.md).

## Install

```sh
git clone https://github.com/colerehbein/dsh-hermes-kit.git
cd dsh-hermes-kit
```

Install each package into the running profile with DSH's plugin manager, which adds the dependency, appends the bundle, and enables it live:

```text
plugin_manager install_bundle file:$PWD/packages/model-picker
plugin_manager install_bundle file:$PWD/packages/projects-page
```

The same thing by hand: `pnpm add file:…/packages/model-picker` inside `~/.dsh/profiles/<profile>`, add `@dsh-local/hermes-model-picker` to `dsh.profile.bundles` in that profile's `package.json`, then reload. The client bundle is served from disk, so no build step is involved.

The tooling installs separately, because it is a CLI kit rather than a plugin:

```sh
./tools/dsh-kit/install.sh --dry-run
./tools/dsh-kit/install.sh
```

If you already run an older local copy of either plugin, disable it first: two occupants of the model seat at the same priority refuse to register, and two Projects panels both appear in the sidebar.

## Provider recipes

`providers/providers.example.yml` carries paste-ready `llm-pi-ai` routes for Nous Research, Command Code (chat + Anthropic Messages), and a local OmniRoute instance. Keys stay in DSH's credential store; the config only names references like `NOUS_API_KEY`.

## Compatibility

These are client plugins against DSH's internal slot and service APIs (`0.2.x`). They read `ctx.slots`, `ctx.locale`, `ctx.modelDirectories`, and the `conversation.input.model` contract. An upstream slot-contract change can break them; the packages are versioned as a kit and updated together.

## License

MIT — see [LICENSE](LICENSE).
