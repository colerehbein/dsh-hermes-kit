#!/usr/bin/env python3
"""sync-models — rewrite one provider's `models:` list from its live listing.

DSH decides what a route serves from `cordis.patch.yml`, so a hand-maintained
model list drifts the moment a provider renames or retires a model. This reads
the provider's own listing endpoint and regenerates that provider's block,
keeping every other line of the file untouched.

  sync-models.py --config ~/.dsh/profiles/desktop/cordis.patch.yml \\
      --provider nous --url https://inference-api.nousresearch.com/v1/models \\
      --key-env NOUS_API_KEY

The key is read from the environment first, then `~/.dsh/.credentials.yaml`.
Use --dry-run to print the block without writing.
"""
import argparse
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

CREDENTIALS = Path(os.environ.get("DSH_HOME", "~/.dsh")).expanduser() / ".credentials.yaml"
# DSH's pi-ai profile accepts exactly these effort names; anything else (a
# provider's "none", "auto", …) would invalidate the whole provider config.
LEVELS = ("minimal", "low", "medium", "high", "xhigh", "max")
INDENT = "          "  # 10 spaces: the `- id:` line inside a provider block
FIELD = "            "  # 12 spaces: a field of one model entry


def credential(name):
    try:
        text = CREDENTIALS.read_text()
    except OSError:
        return ""
    match = re.search(rf"^{re.escape(name)}:\s*(\S+)\s*$", text, re.M)
    return match.group(1) if match else ""


def fetch(url, token):
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def model_entries(payload):
    data = payload.get("data") if isinstance(payload, dict) else None
    if data is None and isinstance(payload, dict):
        data = payload.get("models")
    if isinstance(data, dict):
        data = list(data.values())
    if not isinstance(data, list):
        raise SystemExit("listing has no data[]/models[] array")
    return [entry for entry in data if isinstance(entry, dict) and entry.get("id")]


def display_name(entry):
    name = entry.get("name") or entry.get("id")
    if ": " in name:
        prefix, rest = name.split(": ", 1)
        if rest.strip() and re.fullmatch(r"[A-Za-z0-9 .&+'-]+", prefix):
            name = rest
    return name.strip()


def context_window(entry):
    for candidate in (
        entry.get("context_length"),
        (entry.get("top_provider") or {}).get("context_length"),
        entry.get("context_window"),
    ):
        if isinstance(candidate, int) and candidate > 0:
            return candidate
    return 128_000


def inputs(entry):
    modalities = (entry.get("architecture") or {}).get("input_modalities") or []
    keep = [m for m in ("text", "image") if m in modalities]
    return keep or ["text"]


def efforts(entry):
    reasoning = entry.get("reasoning") or {}
    supported = [level for level in (reasoning.get("supported_efforts") or []) if level in LEVELS]
    if not supported:
        return None
    lines = []
    if not reasoning.get("mandatory"):
        lines.append(f"{FIELD}  off: null")
    for effort in supported:
        lines.append(f"{FIELD}  {effort}: {effort}")
    return lines


def render(entry):
    lines = [
        f"{INDENT}- id: {entry['id']}",
        f"{FIELD}name: {display_name(entry)}",
        f"{FIELD}contextWindow: {context_window(entry)}",
        f"{FIELD}input:",
    ]
    lines.extend(f"{FIELD}  - {modality}" for modality in inputs(entry))
    extra = efforts(entry)
    if extra:
        lines.append(f"{FIELD}reasoningEfforts:")
        lines.extend(extra)
    return lines


def rewrite(text, provider, block):
    """Replace one provider's `models:` block, leaving every other line alone."""
    lines = text.splitlines()
    start = None
    for index, line in enumerate(lines):
        if line == f"      {provider}:":
            start = index
            break
    if start is None:
        raise SystemExit(f"provider '{provider}' not found in the config")
    models_at = None
    for index in range(start + 1, len(lines)):
        if lines[index].startswith("      ") and not lines[index].startswith("       "):
            break
        if lines[index].strip() == "models:":
            models_at = index
            break
    if models_at is None:
        raise SystemExit(f"provider '{provider}' has no models: block")
    end = models_at + 1
    while end < len(lines) and (lines[end].startswith("          ") or lines[end].strip() == ""):
        end += 1
    return "\n".join(lines[: models_at + 1] + block + lines[end:]) + "\n"


def main():
    parser = argparse.ArgumentParser(description="rewrite a provider model list from its live listing")
    parser.add_argument("--config", required=True, help="cordis.patch.yml to edit")
    parser.add_argument("--provider", required=True, help="provider key inside llm-pi-ai providers")
    parser.add_argument("--url", help="model listing URL (…/v1/models); not needed with --json")
    parser.add_argument("--key-env", help="credential name for the bearer token")
    parser.add_argument("--dry-run", action="store_true", help="print the block, write nothing")
    parser.add_argument("--json", help="read the listing from this file instead of the network")
    args = parser.parse_args()

    if args.json:
        payload = json.loads(Path(args.json).read_text())
    else:
        if not args.url:
            raise SystemExit("--url is required unless --json is given")
        token = (os.environ.get(args.key_env or "") or credential(args.key_env or "")).strip()
        if not token:
            raise SystemExit(f"no credential for {args.key_env}")
        payload = fetch(args.url, token)

    entries = model_entries(payload)
    block = [line for entry in entries for line in render(entry)]
    if args.dry_run:
        print("\n".join(block))
        print(f"\n# {len(entries)} models", file=sys.stderr)
        return

    path = Path(args.config).expanduser()
    updated = rewrite(path.read_text(), args.provider, block)
    path.write_text(updated)
    print(f"{args.provider}: {len(entries)} models written to {path}")


if __name__ == "__main__":
    main()
