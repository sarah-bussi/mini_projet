#!/usr/bin/env python3
"""Build an SQL import for the workspace A11Y corpus without modifying the thesis repo.

Expected local layout (default):
  ../a11y-copilot/backend/knowledge/normative/RGAA/structured/rgaa_sections.json
  ../a11y-copilot/backend/knowledge/normative/RAAM/structured/raam_criteres.json

The thesis repository is read-only from this script. Output is written only in mini_projet.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT.parent / "a11y-copilot"
DEFAULT_OUTPUT = ROOT / "supabase" / "workspace-a11y-corpus.generated.sql"


def sql(value):
    if value is None:
        return "null"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def compact(text: str) -> str:
    return " ".join((text or "").split())


def clean_rgaa_content(text: str) -> str:
    """Remove PDF extraction artefacts without changing normative meaning."""
    value = text or ""
    # Repeated PDF page footer, e.g. "RGAA 4.1.2 – 17/131".
    value = re.sub(r"\bRGAA\s+4\.1\.2\s*[–-]\s*\d+\s*/\s*\d+\b", " ", value, flags=re.IGNORECASE)
    value = compact(value)
    # Stray bullets frequently left alone at chunk boundaries by PDF extraction.
    value = re.sub(r"(?:\s*[•◦]\s*)+$", "", value).strip()
    return value


def rgaa_title(reference: str, ref_type: str, content: str) -> str:
    """Create a short label that cannot be confused with WCAG mappings in the body."""
    label = "Critère" if str(ref_type).lower() in {"critère", "criterion", "critere"} else "Test"
    # The first sentence/question is generally the normative heading.
    match = re.search(r"^(.+?[?])(?:\s|$)", content)
    heading = match.group(1).strip() if match else content[:260].strip()
    if not heading.lower().startswith(("critère ", "critere ", "test ")):
        heading = f"{label} RGAA {reference} — {heading}"
    return heading[:320]


def rgaa_rows(source: Path):
    path = source / "backend" / "knowledge" / "normative" / "RGAA" / "structured" / "rgaa_sections.json"
    if not path.exists():
        print(f"RGAA absent: {path}")
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for item in payload:
        content = clean_rgaa_content(item.get("content", ""))
        reference = str(item.get("reference", "")).strip()
        if not reference or not content:
            continue
        ref_type = item.get("type") or "reference"
        title = rgaa_title(reference, ref_type, content)
        rows.append({
            "standard": "RGAA",
            "version": item.get("version") or "4.1.2",
            "reference": reference,
            "reference_type": ref_type,
            "title": title,
            "content": content,
            "document": item.get("document") or "RGAA 4.1.2",
            "page": item.get("page"),
            # Explicitly label the reference as RGAA so a WCAG number mentioned in
            # content cannot become the candidate identity.
            "keywords": f"référence RGAA {reference} {ref_type} {title}",
        })
    return rows


def flatten(value):
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        out = []
        for item in value:
            out.extend(flatten(item))
        return out
    if isinstance(value, dict):
        out = []
        for item in value.values():
            out.extend(flatten(item))
        return out
    return [str(value)]


def raam_rows(source: Path):
    path = source / "backend" / "knowledge" / "normative" / "RAAM" / "structured" / "raam_criteres.json"
    if not path.exists():
        print(f"RAAM absent: {path}")
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for topic in payload.get("topics", []):
        topic_number = topic.get("number")
        topic_title = compact(topic.get("topic", ""))
        for wrapper in topic.get("criteria", []):
            criterion = wrapper.get("criterium", {})
            criterion_number = criterion.get("number")
            if topic_number is None or criterion_number is None:
                continue
            reference = f"{topic_number}.{criterion_number}"
            criterion_title = compact(criterion.get("title", ""))
            tests = compact(" ".join(flatten(criterion.get("tests"))))
            cases = compact(" ".join(flatten(criterion.get("particularCases"))))
            content = " ".join(part for part in [
                f"Thématique : {topic_title}" if topic_title else "",
                f"Critère RAAM {reference} : {criterion_title}" if criterion_title else f"Critère RAAM {reference}",
                f"Tests : {tests}" if tests else "",
                f"Cas particuliers : {cases}" if cases else "",
            ] if part)
            rows.append({
                "standard": "RAAM",
                "version": "1.1",
                "reference": reference,
                "reference_type": "criterion",
                "title": criterion_title or f"Critère RAAM {reference}",
                "content": content,
                "document": "RAAM 1.1 — critères et tests",
                "page": None,
                "keywords": f"référence RAAM {reference} {topic_title} {criterion_title}",
            })
    return rows


def write_sql(rows, output: Path):
    output.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "-- Generated workspace corpus import. Do not edit by hand.",
        "-- Source repo is read only; this file belongs to mini_projet.",
        "begin;",
        "delete from public.workspace_a11y_corpus;",
    ]
    for row in rows:
        lines.append(
            "insert into public.workspace_a11y_corpus "
            "(standard, version, reference, reference_type, title, content, document, page, keywords) values ("
            + ", ".join(sql(row[key]) for key in [
                "standard", "version", "reference", "reference_type", "title", "content", "document", "page", "keywords"
            ])
            + ") on conflict do nothing;"
        )
    lines += ["commit;", ""]
    output.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Path to local a11y-copilot repository")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    source = args.source.resolve()
    rows = rgaa_rows(source) + raam_rows(source)
    if not rows:
        raise SystemExit("No corpus rows found. Check --source.")
    write_sql(rows, args.output)
    counts = {"RGAA": sum(r["standard"] == "RGAA" for r in rows), "RAAM": sum(r["standard"] == "RAAM" for r in rows)}
    print(f"Generated {args.output} with {len(rows)} rows: {counts}")


if __name__ == "__main__":
    main()
