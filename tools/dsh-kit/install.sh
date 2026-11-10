#!/usr/bin/env bash
# Install the dsh kit: three CLIs into $DSH_HOME/bin, three skills into $DSH_HOME/skills.
#   ./install.sh             # install
#   ./install.sh --dry-run   # print what would happen
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dsh_home="${DSH_HOME:-$HOME/.dsh}"
dry=0
[ "${1:-}" = "--dry-run" ] && dry=1

run() {
  if [ "$dry" -eq 1 ]; then
    echo "would: $*"
  else
    "$@"
  fi
}

run mkdir -p "$dsh_home/bin" "$dsh_home/skills" \
              "$dsh_home/memory" "$dsh_home/curator" "$dsh_home/checkpoints"

for f in mem ckpt curator import-memory install-brief proj; do
  run install -m 755 "$here/bin/$f" "$dsh_home/bin/$f"
done

for s in dsh-memory dsh-checkpoints dsh-curator; do
  run mkdir -p "$dsh_home/skills/$s"
  run install -m 644 "$here/skills/$s/SKILL.md" "$dsh_home/skills/$s/SKILL.md"
done

echo
echo "kit installed into $dsh_home"
echo "  bins:   $dsh_home/bin/{mem,ckpt,curator}"
echo "  skills: $dsh_home/skills/{dsh-memory,dsh-checkpoints,dsh-curator}"
echo
echo "Optional, for bare command names:  export PATH=\"$dsh_home/bin:\$PATH\""
echo "Skills are live-watched; a new session picks them up."
