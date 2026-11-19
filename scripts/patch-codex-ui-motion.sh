#!/usr/bin/env bash
# Stop @michengai/dsh-codex-ui from re-scanning the whole document on every DOM
# mutation.
#
# Why this is a patch and not a plugin:
#   The plugin keeps its project headers aligned with the host's row animations.
#   To do that it runs syncHeadersWithHostMotion(), which calls
#   row.getAnimations() once per workspace row. Every one of those calls forces
#   the browser to flush pending style on the WHOLE document first, so the cost
#   is a full style recalculation per row per pass.
#
#   It is driven from a MutationObserver on document.body with
#   {childList, subtree, attributes}. In the default theme the sidebar itself
#   writes 13+ attributes a second (data-dcu-section-member on every group
#   section, data-shimmer-text on streaming rows), and each write schedules
#   another scan that writes more attributes, so the app never returns to idle.
#
#   Measured on a real 48-bundle profile before this patch: the renderer ran
#   104% CPU with 15 long tasks totalling 4,033ms per 5s, and the main process
#   122% CPU serving the requests that never finished. After: long tasks 0,
#   main process ~1% CPU.
#
#   The patch does two things, both inside the shipped bundle:
#     1. One document.getAnimations() per pass, bucketed by effect.target,
#        instead of one forced flush per row.
#     2. requestAnimationFrame coalescing, so a burst of mutations runs the
#        scan once instead of hundreds of times.
#
# Run after any update of @michengai/dsh-codex-ui. Idempotent.
set -euo pipefail

PROFILE="${DSH_PROFILE_DIR:-$HOME/.dsh/profiles/desktop}"
TARGET="$PROFILE/node_modules/@michengai/dsh-codex-ui/lib/client.js"
MARKER="dsh-perf: single document.getAnimations()"

if [[ ! -f "$TARGET" ]]; then
  echo "patch-codex-ui-motion: not installed at $TARGET — nothing to do" >&2
  exit 0
fi

if grep -q "$MARKER" "$TARGET"; then
  echo "patch-codex-ui-motion: already patched"
  exit 0
fi

cp "$TARGET" "$TARGET.bak.$(date +%Y%m%d%H%M%S)"

node - "$TARGET" <<'NODE'
const fs = require('node:fs')
const path = process.argv[2]
let src = fs.readFileSync(path, 'utf8')

// 1. Replace the per-row getAnimations loop with a single document-wide read.
const oldLoop = `				for (const row of Array.from(container.querySelectorAll("[data-row-key^=\\"workspace:\\"]"))) for (const animation of row.getAnimations?.() ?? []) {`
const newLoop = `				const animatedRows = /* dsh-perf: single document.getAnimations() instead of one forced style flush per row */
				(() => {
					const rows = Array.from(container.querySelectorAll("[data-row-key^=\\"workspace:\\"]"));
					if (rows.length === 0) return [];
					const byTarget = new Map();
					for (const animation of document.getAnimations()) {
						const target = animation.effect && animation.effect.target;
						if (!target) continue;
						const bucket = byTarget.get(target);
						if (bucket !== void 0) bucket.push(animation);
						else byTarget.set(target, [animation]);
					}
					const pairs = [];
					for (const row of rows) {
						const list = byTarget.get(row);
						if (list !== void 0) pairs.push([row, list]);
					}
					return pairs;
				})();
				for (const [row, rowAnimations] of animatedRows) for (const animation of rowAnimations) {`
if (!src.includes(oldLoop)) {
  console.error('patch-codex-ui-motion: row-scan anchor not found — plugin changed, patch not applied')
  process.exit(2)
}
src = src.replace(oldLoop, newLoop)

// 2. Coalesce the observer path to at most one scan per animation frame.
const oldCall = `							if (list !== void 0 && relocatingIds.size === 0 && animatingSections.size === 0) syncHeadersWithHostMotion(list);
							scheduleSync();`
const newCall = `							if (list !== void 0 && relocatingIds.size === 0 && animatingSections.size === 0) scheduleHeaderSync(list);
							scheduleSync();`
if (!src.includes(oldCall)) {
  console.error('patch-codex-ui-motion: observer anchor not found — plugin changed, patch not applied')
  process.exit(2)
}
src = src.replace(oldCall, newCall)

const fnAnchor = `			function syncHeadersWithHostMotion(container) {`
const helper = `			let headerSyncPending = void 0;
			/** dsh-perf: the sidebar MutationObserver fires on every attribute write, so a bare call
			* ran the whole header-motion scan dozens of times a second and each getAnimations()
			* forced a full style flush. Coalesce to at most one scan per animation frame. */
			function scheduleHeaderSync(container) {
				if (headerSyncPending !== void 0) return;
				const run = () => {
					headerSyncPending = void 0;
					syncHeadersWithHostMotion(container);
				};
				headerSyncPending = typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : setTimeout(run, 16);
			}
			function syncHeadersWithHostMotion(container) {`
if (!src.includes(fnAnchor)) {
  console.error('patch-codex-ui-motion: function anchor not found — plugin changed, patch not applied')
  process.exit(2)
}
src = src.replace(fnAnchor, helper)

fs.writeFileSync(path, src)
console.log('patch-codex-ui-motion: scan coalesced and single-pass')
NODE

node --check "$TARGET"
echo "patch-codex-ui-motion: done — reload the app window to see it"
