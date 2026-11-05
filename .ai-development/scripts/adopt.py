#!/usr/bin/env python3
"""Install/update a pinned local standard. No network, commits, or remote writes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

BEGIN = "<!-- ai-development:begin -->"
END = "<!-- ai-development:end -->"
AGENT_BLOCK = f"""{BEGIN}
## Стандарт разработки
Прочитай `.ai-development/START.md`, затем документ назначенной роли и
`.delivery/PROJECT.md`. Используй закреплённую в репозитории версию стандарта.
Согласованные требования, полномочия и состояние находятся в документах паспорта.
Не считай наличие доступа разрешением на слияние, выпуск или новые расходы.
При конфликте с существующими инструкциями зафиксируй его и разреши до зависимой работы.
{END}"""
CLAUDE_BLOCK = f"""{BEGIN}
@AGENTS.md
{END}"""
CLAUDE_EXISTING_BLOCK = f"""{BEGIN}
AGENTS.md is imported by the existing instructions outside this block.
{END}"""
SKILLS = ("ad-start-product", "ad-manage-task", "ad-review-change")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def safe(root, relative):
    p = Path(relative)
    if p.is_absolute() or not p.parts or any(x in ("..", ".git") for x in p.parts):
        raise ValueError(f"Unsafe path: {relative}")
    current = root
    for part in p.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f"Symlink is not managed: {relative}")
    if current.exists() and not current.is_file():
        raise ValueError(f"Not a file: {relative}")
    return current


def source_files(source):
    names = ["README.md", "START.md", "WORKFLOW.md", "VERSION", "SOURCES.md",
             "CHANGELOG.md", "VALIDATION.md",
             "scripts/adopt.py", "scripts/check.py"]
    for folder in ("roles", "guides", "templates", "skills"):
        names += [str(p.relative_to(source)) for p in (source / folder).rglob("*")
                  if p.is_file()]
    result = {}
    for name in sorted(set(names)):
        p = safe(source, name)
        if not p.is_file():
            raise ValueError(f"Source file missing: {name}")
        if "__pycache__" in p.parts or p.suffix == ".pyc":
            continue
        result[name] = p.read_bytes()
    for skill in SKILLS:
        if f"skills/{skill}/SKILL.md" not in result:
            raise ValueError(f"Skill missing: {skill}")
    return result


def has_agents_import(text):
    """Recognize a standalone import, excluding fenced examples and HTML comments."""
    text = re.sub(r"<!--[\s\S]*?(?:-->|$)", "", text)
    fence = None
    for line in text.splitlines():
        if line.startswith(("    ", "\t")):
            continue
        stripped = line.strip()
        marker = re.match(r"(`{3,}|~{3,})", stripped)
        if marker:
            run = marker.group(1)
            if fence is None:
                fence = run
            elif run[0] == fence[0] and len(run) >= len(fence) and not stripped[len(run):].strip():
                fence = None
            continue
        if fence is None and re.fullmatch(r"@(?:\./)?AGENTS\.md", stripped):
            return True
    return False


def add_block(original, block, name, updating):
    text = original.decode("utf-8") if original is not None else ""
    if BEGIN in text or END in text:
        if text.count(BEGIN) != 1 or text.count(END) != 1:
            raise ValueError(f"Invalid instruction markers: {name}")
        start, end = text.index(BEGIN), text.index(END) + len(END)
        allowed = (block, CLAUDE_EXISTING_BLOCK) if name == "CLAUDE.md" else (block,)
        if start >= end or text[start:end] not in allowed:
            raise ValueError(f"Managed instruction block changed: {name}")
        if name == "CLAUDE.md":
            outside = text[:start] + text[end:]
            desired = CLAUDE_EXISTING_BLOCK if has_agents_import(outside) else block
            return (text[:start] + desired + text[end:]).encode("utf-8")
        return original
    if updating:
        raise ValueError(f"Managed instruction block missing: {name}")
    if name == "CLAUDE.md" and has_agents_import(text):
        block = CLAUDE_EXISTING_BLOCK
    return (text.rstrip() + ("\n\n" if text.strip() else "") + block + "\n").encode()


def plan(source, target, update=False):
    source, target = Path(source).resolve(), Path(target).resolve()
    if source == target or source in target.parents or target in source.parents:
        raise ValueError("Source and target must be separate non-nested repositories")
    for root in (source, target):
        if Path(git(root, "rev-parse", "--show-toplevel")).resolve() != root:
            raise ValueError(f"Use the repository root: {root}")
    if git(source, "status", "--porcelain", "--untracked-files=all"):
        raise ValueError("Source must be committed and clean")
    revision = git(source, "rev-parse", "HEAD")
    version = (source / "VERSION").read_text().strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Invalid standard version")
    manifest_path = safe(target, ".ai-development/manifest.json")
    previous = None
    if manifest_path.exists():
        if not update:
            raise ValueError("Already installed; use --update after reviewing the new version")
        previous = json.loads(manifest_path.read_text())
        if previous.get("format") != 1 or not isinstance(previous.get("files"), dict):
            raise ValueError("Unsupported manifest")
        for name, expected in previous["files"].items():
            if not (name.startswith(".ai-development/") or
                    any(name.startswith(f"{base}/{s}/")
                        for base in (".agents/skills", ".claude/skills") for s in SKILLS)):
                raise ValueError(f"Manifest path outside managed area: {name}")
            p = safe(target, name)
            if not p.exists() or digest(p.read_bytes()) != expected:
                raise ValueError(f"Managed file locally changed/missing: {name}")
    elif update:
        raise ValueError("No installation to update")

    package = source_files(source)
    desired = {f".ai-development/{name}": data for name, data in package.items()}
    for skill in SKILLS:
        for name, data in package.items():
            prefix = f"skills/{skill}/"
            if name.startswith(prefix):
                for base in (".agents/skills", ".claude/skills"):
                    desired[f"{base}/{skill}/{name[len(prefix):]}"] = data

    old_files = previous["files"] if previous else {}
    for name in desired:
        p = safe(target, name)
        if p.exists() and name not in old_files:
            raise ValueError(f"Unmanaged file would be overwritten: {name}")
    package_root = target / ".ai-development"
    if package_root.is_symlink():
        raise ValueError("Package directory is a symlink")
    if package_root.exists():
        for p in package_root.rglob("*"):
            if p.is_symlink():
                raise ValueError(f"Symlink in package: {p}")
            if p.is_file():
                name = str(p.relative_to(target))
                if name not in old_files and name != ".ai-development/manifest.json":
                    raise ValueError(f"Unmanaged file in package: {name}")

    changes = dict(desired)
    for name in set(old_files) - set(desired):
        changes[name] = None
    for name, block in (("AGENTS.md", AGENT_BLOCK), ("CLAUDE.md", CLAUDE_BLOCK)):
        p = safe(target, name)
        changes[name] = add_block(p.read_bytes() if p.exists() else None, block, name, update)
    if not update:
        for name in ("PROJECT", "PRODUCT", "TASKS", "STATE", "RUNBOOK"):
            dest = f".delivery/{name}.md"
            if not safe(target, dest).exists():
                changes[dest] = package[f"templates/{name}.md"]
    manifest = {
        "format": 1, "version": version,
        "source_repository": "https://github.com/sa713/ai-development",
        "source_commit": revision,
        "files": {name: digest(data) for name, data in sorted(desired.items())},
    }
    changes[".ai-development/manifest.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    # Preflight all paths before the first write. Exclude byte-identical files.
    result = {}
    for name, data in changes.items():
        p = safe(target, name)
        old = p.read_bytes() if p.exists() else None
        if old != data:
            result[name] = data
    return target, result, manifest


def atomic_write(path, data):
    if data is None:
        path.unlink(missing_ok=True)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = path.stat().st_mode & 0o777 if path.exists() else 0o644
    fd, temp = tempfile.mkstemp(dir=path.parent, prefix=".ad-write-")
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
        os.chmod(temp, mode)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def apply(target, changes):
    originals = {name: safe(target, name).read_bytes() if safe(target, name).exists() else None
                 for name in changes}
    touched = []
    try:
        for name, data in changes.items():
            touched.append(name)
            atomic_write(safe(target, name), data)
    except Exception:
        for name in reversed(touched):
            atomic_write(safe(target, name), originals[name])
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--update", action="store_true")
    parser.add_argument("--apply", action="store_true", help="Write local files; default is dry run")
    args = parser.parse_args()
    try:
        target, changes, manifest = plan(args.source, args.target, args.update)
        print(f"Standard {manifest['version']} @ {manifest['source_commit']}")
        for name, data in sorted(changes.items()):
            print(("DELETE " if data is None else "WRITE  ") + name)
        if args.apply:
            apply(target, changes)
            print("APPLIED locally. Configure PROJECT.md, review conflicts and commit through your workflow.")
        else:
            print("DRY RUN. No files changed. Use --apply after reviewing this plan.")
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"Cannot adopt standard: {exc}\n")


if __name__ == "__main__":
    main()
