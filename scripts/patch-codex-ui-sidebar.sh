#!/usr/bin/env bash
# Make the plugin list in the sidebar scroll inside a capped box.
#
# Why this is a patch and not a plugin:
#   @michengai/dsh-codex-ui renders the whole sidebar nav itself, including the
#   "More" accordion that lists every plugin. Its own stylesheet gives the open
#   accordion `overflow: hidden` and no bounded height, so with 19 plugins the
#   list grows to ~850px, the nav grows past the sidebar, and the host frame
#   (overflow: hidden) clips the footer and every session row below the fold.
#   Capping the nav instead does not work: the nav then takes its height from
#   the host session list and the chats area collapses to 0px.
#
#   The fix is one rule on the accordion content. `!important` is required: the
#   plugin's own rule has equal specificity and appears later in the same
#   stylesheet, so it otherwise wins on source order.
#
# Run after any update of @michengai/dsh-codex-ui. Idempotent.
set -euo pipefail

PROFILE="${DSH_PROFILE_DIR:-$HOME/.dsh/profiles/desktop}"
TARGET="$PROFILE/node_modules/@michengai/dsh-codex-ui/lib/client.js"
MARKER="dsh-kit: sidebar plugin-list scroll"

if [[ ! -f "$TARGET" ]]; then
  echo "patch-codex-ui-sidebar: not installed at $TARGET — nothing to do" >&2
  exit 0
fi

if grep -q "$MARKER" "$TARGET"; then
  echo "patch-codex-ui-sidebar: already patched"
  exit 0
fi

cp "$TARGET" "$TARGET.bak.$(date +%Y%m%d%H%M%S)"

node - "$TARGET" <<'NODE'
const fs = require('node:fs')
const path = process.argv[2]
const marker = 'dsh-kit: sidebar plugin-list scroll'
let src = fs.readFileSync(path, 'utf8')

// Anchor on the first rule the plugin emits for its own nav container. Each
// new rule is inserted before it, which is inside SIDEBAR_CSS and therefore
// still in the document the plugin injects.
const anchor = '.dcu-sb-root {'
const at = src.indexOf(anchor)
if (at < 0) {
  console.error('patch-codex-ui-sidebar: anchor ".dcu-sb-root {" not found — plugin layout changed, patch not applied')
  process.exit(2)
}

const rule = `/* ${marker}: the expanded More list is the only part of this nav that can
   outgrow the sidebar. Cap it so it scrolls instead of pushing the host session
   list (kB3qhq_scrollRegion) to zero and clipping the footer. !important is
   required because the rule below for this same selector is equally specific
   and comes later in this stylesheet. */
.dcu-sb-accordion.dcu-sb-accordion-open .dcu-sb-accordion-content {
  max-height: min(26vh, 240px) !important;
  overflow-y: auto !important;
  overscroll-behavior: contain;
}

`

src = src.slice(0, at) + rule + src.slice(at)
fs.writeFileSync(path, src)
console.log('patch-codex-ui-sidebar: rule inserted')
NODE

node --check "$TARGET"
echo "patch-codex-ui-sidebar: done — reload the app window to see it"
