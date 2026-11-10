# @dsh-local/hermes-model-picker

A Hermes-style composer model picker for DeepSeek Harness.

Shadows the stock `conversation.input.model` occupant (single slot, `priority: -1`) and reuses the same per-session `modelDirectories` service, so model switching keeps DSH's durable selection behaviour.

- Search with ordered-subsequence matching and highlighting
- Favorites (star / `Shift+Enter`) pinned above the providers, exempt from the visibility filter
- Collapsible provider groups with counts
- Per-model reasoning levels via the row chip
- **Edit models…** visibility editor: per-model switches, provider master switches with an indeterminate state, `on/total` counters, filter, reset
- Current check, pending indicator, catalog-failure and error strips with retry
- Keyboard: `↑`/`↓` move, `Enter` select, `Shift+Enter` star, `Esc` back/close

State lives in `localStorage` (`dsh.hermes-model-picker.*`). Nothing is written to the Host.

Install: see the kit [README](../../README.md).
