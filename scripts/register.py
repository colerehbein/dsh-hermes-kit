#!/usr/bin/env python3
"""Register one created plugin in a DSH profile.

Adds the dependency plus the bundle entry and links the package into the
profile's node_modules, so the loader resolves it the same way a
`plugin_manager` install would. Idempotent.
"""
import json
import os
import shutil
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: register.py <profile-dir> <created-plugins/subdir>", file=sys.stderr)
        return 2
    profile, rel = os.path.abspath(sys.argv[1]), sys.argv[2]
    src = os.path.join(profile, rel)
    manifest = os.path.join(src, "package.json")
    if not os.path.isfile(manifest):
        print(f"no package.json under {src}", file=sys.stderr)
        return 1
    name = json.load(open(manifest))["name"]

    path = os.path.join(profile, "package.json")
    doc = json.load(open(path))
    doc.setdefault("dependencies", {})[name] = "file:" + rel
    bundles = doc.setdefault("dsh", {}).setdefault("profile", {}).setdefault("bundles", [])
    if name not in bundles:
        bundles.append(name)
    with open(path, "w") as handle:
        json.dump(doc, handle, indent=2)
        handle.write("\n")

    link = os.path.join(profile, "node_modules", *name.split("/"))
    os.makedirs(os.path.dirname(link), exist_ok=True)
    if os.path.islink(link) or os.path.isfile(link):
        os.remove(link)
    elif os.path.isdir(link):
        shutil.rmtree(link)
    os.symlink(os.path.relpath(src, os.path.dirname(link)), link)
    print(f"registered {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
