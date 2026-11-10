#!/usr/bin/env python3
"""Move redundant skill paths out of the scan root. Dry-run unless --apply.

  python3 apply.py            # show what would move
  python3 apply.py --apply    # move to ~/.dsh/skills-retired/
  python3 apply.py --undo     # move everything listed in retire.tsv back
"""
import argparse
import os
import shutil
from pathlib import Path

ROOT = Path(os.path.expanduser("~/.dsh/skills"))
RETIRED = Path(os.path.expanduser("~/.dsh/skills-retired"))
HERE = Path(__file__).resolve().parent
TSV = HERE / "retire.tsv"


def entries():
    lines = TSV.read_text().splitlines()[1:]
    for line in lines:
        if line.strip():
            path, reason, canonical = line.split("\t")[:3]
            yield Path(path), reason, canonical


def move(src_root, dst_root, rel, apply):
    src, dst = src_root / rel, dst_root / rel
    if not src.exists():
        return "missing"
    if dst.exists():
        return "exists"
    if apply:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
    return "moved"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--undo", action="store_true")
    args = ap.parse_args()
    src_root, dst_root = (RETIRED, ROOT) if args.undo else (ROOT, RETIRED)
    counts = {"moved": 0, "exists": 0, "missing": 0}
    for rel, reason, _ in entries():
        result = move(src_root, dst_root, rel, args.apply)
        counts[result] += 1
    verb = "restored" if args.undo else "retired"
    print(f"{'APPLIED' if args.apply else 'DRY RUN'}: {counts['moved']} {verb}, "
          f"{counts['exists']} already at destination, {counts['missing']} missing")
    print(f"from {src_root}\nto   {dst_root}")


if __name__ == "__main__":
    main()
