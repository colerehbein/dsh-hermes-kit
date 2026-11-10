# Hermes → DSH parity notes

What was ported, from which Hermes file, and what was deliberately left out.

## Model picker

Source: `apps/desktop/src/app/shell/model-catalog-menu.tsx` (Hermes desktop, ~1,500 lines), plus `model-menu-panel.tsx`, `use-model-menu-controller.ts`, and `store/model-visibility.ts`.

| Hermes behaviour | DSH port |
| --- | --- |
| One searchable panel anchored to the model pill; focus stays in search | Same. `↑`/`↓` wrap a highlight, `Enter` selects, `Shift+Enter` stars, `Esc` backs out. |
| Ordered-subsequence matching with highlights | Same ranking: exact → prefix → word-start → subsequence. |
| Favorites section above providers, star per row | Same, persisted in `localStorage`, excluded from provider groups so nothing lists twice. |
| Provider groups collapse, count shown | Same, persisted. |
| Row commits; hover submenu edits reasoning / fast without selecting | Reasoning levels are an inline strip toggled by the row chip; picking a level commits model + effort. |
| Current model check, pending spinner, limited-model reset badges | Check and pending carried over. Reset badges need provider limit metadata DSH's catalog does not expose. |
| Pricing, context window, provenance, usage tags, MoA presets, local downloads, custom-slug entry | Omitted: `ModelCatalogModel` in DSH carries only `id`, `name`, `description`, `reasoning`, `badge`. |

## Edit models

Source: `apps/desktop/src/components/model-visibility-dialog.tsx` + `store/model-visibility.ts`.

- `visible` (explicit allowlist) and `known` (keys judged at the last save) are two `localStorage` keys.
- Empty provider → `provider::` sentinel, so curated defaults never return on their own.
- A model absent from `known` arrived after curation and defaults to visible.
- Favorites ignore the shortlist.
- `Reset to defaults` clears both keys.

Omitted: `-fast` family collapsing and `featured_models` defaults, which depend on Hermes' catalog shape.

## Projects page

Source: Hermes desktop's project/workspace views.

- Reads `~/.dsh/projects/projects.json`, each project's `TODO.md`, top-level folders, and the `~/.dsh/projects/sessions.jsonl` index.
- Registers `sidebar.panellist`, `sidebar.session.row.hover`, and `main` slots; Host half exposes three read-only `/api/projects-page/*` routes.
- The published package ships an empty fallback roster — a project list is personal, so it comes from your registry.

## Slot mechanics worth knowing

`conversation.input.model` is a **single** slot. Registration is ordered by `priority` ascending and the lowest-priority entry renders; two entries at the same priority throw. The picker uses `priority: -1` to shadow the shipped `ModelSelect` while leaving its `modelDirectories` service in place.
