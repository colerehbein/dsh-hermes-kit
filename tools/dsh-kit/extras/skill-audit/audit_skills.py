#!/usr/bin/env python3
"""Inventory the dsh skill library: frontmatter, triggers, dead references, duplicates."""
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(os.path.expanduser("~/.dsh/skills"))
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("skill-audit")

HERMES_TOOLS = [
    "terminal", "execute_code", "delegate_task", "read_file", "write_file",
    "search_files", "web_extract", "skills_list", "skill_view", "skill_manage",
    "cronjob", "browser_exec", "text_to_speech", "image_generate", "clarify",
    "kanban", "session_search", "send_message", "todo", "patch",
]
DSH_TOOLS = [
    "bash", "read", "write", "edit", "glob", "grep", "skill", "subagent",
    "subagent_fork", "workflow", "spawn_teammate", "send_message", "schedule_create",
    "session_search", "session_event_search", "create_worktree", "terminal_open",
    "ralph", "list_agents", "web_search", "web_fetch", "ask_user_question",
    "present", "todo_write", "create_goal", "plugin_manager", "plugin_market",
    "render_ui", "job_output", "working_directory",
]

FM = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.S)


def parse_frontmatter(text):
    m = FM.match(text)
    if not m:
        return None, "no-frontmatter"
    block = m.group(1)
    data = {}
    key = None
    for raw in block.splitlines():
        if not raw.strip():
            continue
        if re.match(r"^[A-Za-z_][\w-]*\s*:", raw) and not raw.startswith((" ", "\t")):
            key, _, val = raw.partition(":")
            key = key.strip()
            data[key] = val.strip()
        elif key and raw.startswith((" ", "\t")):
            data[key] = (data[key] + " " + raw.strip()).strip()
    return data, None


rows = []
for md in sorted(ROOT.rglob("SKILL.md")):
    rel = md.relative_to(ROOT)
    try:
        text = md.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        rows.append({"rel": str(rel), "error": str(exc)})
        continue
    fm, err = parse_frontmatter(text)
    body = text[len(FM.match(text).group(0)):] if FM.match(text) else text
    low = text.lower()
    rows.append({
        "rel": str(rel),
        "depth": len(rel.parts) - 1,
        "top": rel.parts[0],
        "name": (fm or {}).get("name", ""),
        "description": (fm or {}).get("description", ""),
        "fm_error": err,
        "desc_len": len((fm or {}).get("description", "")),
        "body_bytes": len(body),
        "lines": text.count("\n") + 1,
        "hermes_refs": low.count("hermes"),
        "hermes_paths": low.count("~/.hermes") + low.count("$hermes_home"),
        "hermes_tools": sorted({t for t in HERMES_TOOLS if re.search(rf"\b{re.escape(t)}\s*\(", text)}),
        "dsh_tools": sorted({t for t in DSH_TOOLS if re.search(rf"\b{re.escape(t)}\s*\(", text)}),
    })

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "inventory.json").write_text(json.dumps(rows, indent=1))

names = Counter(r.get("name", "") for r in rows if r.get("name"))
dupe_names = {n: c for n, c in names.items() if c > 1}
desc = Counter(r.get("description", "")[:120] for r in rows if r.get("description"))
dupe_desc = {d: c for d, c in desc.items() if c > 1}

print("files", len(rows))
print("no frontmatter", sum(1 for r in rows if r.get("fm_error")))
print("no name", sum(1 for r in rows if not r.get("name")))
print("no desc", sum(1 for r in rows if not r.get("description")))
print("short desc <40", sum(1 for r in rows if r.get("description") and r["desc_len"] < 40))
print("nested (>1 part)", sum(1 for r in rows if r.get("depth", 0) > 1))
print("dupe names", len(dupe_names), "files", sum(dupe_names.values()))
print("dupe desc", len(dupe_desc), "files", sum(dupe_desc.values()))
print("hermes path refs", sum(1 for r in rows if r.get("hermes_paths")))
print("hermes tool refs", sum(1 for r in rows if r.get("hermes_tools")))
print("hermes mentions >=3", sum(1 for r in rows if r.get("hermes_refs", 0) >= 3))
print("big bodies >40KB", sum(1 for r in rows if r.get("body_bytes", 0) > 40000))

(OUT / "dupes.json").write_text(json.dumps(
    {"names": dupe_names, "descriptions": dupe_desc}, indent=1))
print("wrote", OUT / "inventory.json")
