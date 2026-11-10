#!/usr/bin/env bash
# Install dsh-hermes-kit into a DeepSeek Harness profile.
#
#   ./install.sh                  # most recently used profile
#   ./install.sh --profile web    # a named profile
#   ./install.sh --dry-run        # print every change, touch nothing
#   ./install.sh --no-tools       # plugins only, skip the CLIs
#
# The plugins are copied into <profile>/created-plugins, added to the profile's
# dependency list and bundle list, and linked into node_modules. The CLI kit
# installs into $DSH_HOME/bin + $DSH_HOME/skills.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dsh_home="${DSH_HOME:-$HOME/.dsh}"
profile=""
profile_dir=""
dry=0
tools=1

usage() {
  sed -n '3,10p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --profile) profile="${2:-}"; shift 2 ;;
    --profile-dir) profile_dir="${2:-}"; shift 2 ;;
    --dry-run) dry=1; shift ;;
    --no-tools) tools=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -z "$profile_dir" ]; then
  if [ -n "$profile" ]; then
    profile_dir="$dsh_home/profiles/$profile"
  else
    profile_dir="$(ls -dt "$dsh_home"/profiles/*/ 2>/dev/null | head -1 || true)"
    profile_dir="${profile_dir%/}"
  fi
fi

if [ -z "$profile_dir" ] || [ ! -f "$profile_dir/package.json" ]; then
  echo "not a DSH profile: ${profile_dir:-<none found>}" >&2
  echo "pass --profile <name> or --profile-dir <path>" >&2
  exit 1
fi

say() { printf '%s\n' "$*"; }
run() {
  if [ "$dry" -eq 1 ]; then say "would: $*"; else "$@"; fi
}

say "profile: $profile_dir"
[ "$dry" -eq 1 ] && say "dry run — nothing will change"

for pkg in model-picker projects-page toolbox; do
  src="$here/packages/$pkg"
  dest="$profile_dir/created-plugins/$pkg"
  name="$(python3 -c "import json;print(json.load(open('$src/package.json'))['name'])")"
  [ -d "$src" ] || { echo "missing $src" >&2; exit 1; }

  # Replace any existing copy so an upgrade is one command.
  run mkdir -p "$profile_dir/created-plugins"
  if [ "$dry" -eq 1 ]; then
    say "would: copy $pkg -> $dest"
  else
    rm -rf "$dest"
    cp -R "$src" "$dest"
  fi
  run python3 "$here/scripts/register.py" "$profile_dir" "created-plugins/$pkg"
  say "  $name"
done

if compgen -G "$profile_dir/created-plugins/view-*" >/dev/null; then
  say ""
  say "note: an older Projects plugin (created-plugins/view-*) is present."
  say "      disable it in Settings → Plugins, or you will see two Projects panels."
fi

if [ "$tools" -eq 1 ]; then
  say ""
  if [ "$dry" -eq 1 ]; then
    bash "$here/tools/dsh-kit/install.sh" --dry-run
  else
    bash "$here/tools/dsh-kit/install.sh"
  fi
fi

say ""
if [ "$dry" -eq 1 ]; then
  say "dry run complete."
else
  say "installed. Quit and reopen DeepSeek Harness so the Host loads the new bundles."
fi
