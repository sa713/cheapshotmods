#!/usr/bin/env python3
"""Check package structure and local Markdown links; never asserts product quality."""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def validate(root):
    errors = []
    required = ["README.md", "START.md", "WORKFLOW.md", "VERSION", "SOURCES.md",
                "CHANGELOG.md", "VALIDATION.md",
                "roles/product.md", "roles/management.md", "roles/developer.md",
                "roles/reviewer.md", "guides/ADOPTION.md", "guides/INTEGRATIONS.md",
                "guides/REVIEW_CHAT.md", "guides/ENVIRONMENTS.md", "templates/CI.yml",
                "guides/QUALITY.md", "guides/RELEASE.md", "templates/PROJECT.md",
                "templates/TASK.md", "templates/REVIEW.md", "scripts/adopt.py"]
    for name in required:
        if not (root / name).is_file():
            errors.append(f"Missing: {name}")
    if (root / "VERSION").exists() and not re.fullmatch(r"\d+\.\d+\.\d+", (root / "VERSION").read_text().strip()):
        errors.append("Invalid VERSION")
    for path in root.rglob("*.md"):
        if ".git" in path.parts:
            continue
        content = path.read_text()
        for dest in re.findall(r"(?<!!)\[[^\]]+\]\(([^)]+)\)", content):
            if dest.startswith(("https://", "http://", "#", "mailto:")):
                continue
            target = dest.split("#", 1)[0]
            if target and not (path.parent / target).exists():
                errors.append(f"Broken link: {path.relative_to(root)} -> {dest}")
    names = set()
    for skill in (root / "skills").glob("*/SKILL.md"):
        body = skill.read_text()
        match = re.match(r"^---\nname: ([a-z0-9-]+)\ndescription: (.+)\n---\n", body)
        if not match:
            errors.append(f"Invalid skill header: {skill.relative_to(root)}")
        elif match[1] != skill.parent.name or match[1] in names:
            errors.append(f"Invalid/duplicate skill name: {skill.parent.name}")
        else:
            names.add(match[1])
    if names != {"ad-start-product", "ad-manage-task", "ad-review-change"}:
        errors.append("Expected exactly the three standard skills")
    return errors


if __name__ == "__main__":
    problems = validate(ROOT)
    for problem in problems:
        print(problem)
    print(json.dumps({"structural_check": "failed" if problems else "passed", "errors": len(problems)}))
    sys.exit(bool(problems))
