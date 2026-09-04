#!/usr/bin/env python3
import datetime as dt
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WATCH_FILE = ROOT / "a11y-tools" / "veille-data.json"
DETECTED_FILE = ROOT / "a11y-tools" / "detected-tools.json"
BRIEF_FILE = ROOT / "a11y-tools" / "weekly-brief.json"
MODEL = os.environ.get("OPENAI_BRIEF_MODEL", "gpt-5-mini")
API_URL = "https://api.openai.com/v1/responses"
TIMEOUT = 90


def now_utc():
    return dt.datetime.now(dt.timezone.utc)


def now_iso():
    return now_utc().replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(value):
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc)
    except Exception:
        return None


def load_json(path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def recent_watch_items(days=7, limit=80):
    payload = load_json(WATCH_FILE, {"items": []})
    threshold = now_utc() - dt.timedelta(days=days)
    items = []
    for item in payload.get("items", []):
        published = parse_iso(item.get("published"))
        if published and published < threshold:
            continue
        if not item.get("url") or not item.get("title"):
            continue
        items.append({
            "title": item.get("title"),
            "url": item.get("url"),
            "source": item.get("source"),
            "category": item.get("category"),
            "published": item.get("published"),
            "summary": item.get("summary", "")[:600],
        })
    return items[:limit]


def recent_detected_tools(days=30, limit=40):
    payload = load_json(DETECTED_FILE, {"items": []})
    threshold = now_utc() - dt.timedelta(days=days)
    items = []
    for item in payload.get("items", []):
        activity = parse_iso(item.get("updatedAt"))
        if activity and activity < threshold:
            continue
        if not item.get("url") or not item.get("name"):
            continue
        items.append({
            "name": item.get("name"),
            "fullName": item.get("fullName"),
            "url": item.get("url"),
            "description": item.get("description", "")[:500],
            "language": item.get("language"),
            "stars": item.get("stars", 0),
            "updatedAt": item.get("updatedAt"),
            "source": item.get("source", "GitHub"),
        })
    return items[:limit]


def schema():
    source_item = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "whyItMatters": {"type": "string"},
            "importance": {"type": "string", "enum": ["Important", "À surveiller", "Mineur"]},
            "audiences": {
                "type": "array",
                "items": {"type": "string", "enum": ["Accessibilité", "QA", "Design", "Développement", "Produit", "Mobile", "Gaming", "Médias"]},
            },
            "sourceUrls": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["title", "whyItMatters", "importance", "audiences", "sourceUrls"],
        "additionalProperties": False,
    }
    tool_item = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "reason": {"type": "string"},
            "action": {"type": "string", "enum": ["Tester", "Surveiller", "Ignorer pour l'instant"]},
            "url": {"type": "string"},
        },
        "required": ["name", "reason", "action", "url"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "headline": {"type": "string"},
            "executiveSummary": {"type": "string"},
            "topStories": {"type": "array", "items": source_item, "maxItems": 8},
            "toolsToWatch": {"type": "array", "items": tool_item, "maxItems": 6},
            "weekActions": {"type": "array", "items": {"type": "string"}, "maxItems": 6},
        },
        "required": ["headline", "executiveSummary", "topStories", "toolsToWatch", "weekActions"],
        "additionalProperties": False,
    }


def extract_output_text(response):
    for output in response.get("output", []):
        if output.get("type") != "message":
            continue
        for content in output.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                return content["text"]
    raise RuntimeError("Aucun texte exploitable dans la réponse OpenAI")


def generate_brief(api_key, watch_items, detected_tools):
    supplied_urls = sorted({item["url"] for item in watch_items} | {item["url"] for item in detected_tools})
    input_payload = {
        "period": {
            "from": (now_utc() - dt.timedelta(days=7)).date().isoformat(),
            "to": now_utc().date().isoformat(),
        },
        "editorialWatch": watch_items,
        "newToolCandidates": detected_tools,
    }
    instructions = (
        "Tu produis un brief hebdomadaire professionnel en français sur l'accessibilité numérique. "
        "Travaille UNIQUEMENT à partir des données JSON fournies : n'ajoute aucun fait, date, version, "
        "niveau de conformité, recommandation ou réputation non présent dans ces données. "
        "Priorise les changements de standards, réglementation, navigateurs/AT, mobile, responsive, design, "
        "développement, jeux vidéo, médias et outils. Évite le marketing. "
        "Pour les outils GitHub détectés, une détection n'est pas une recommandation : juge seulement s'ils méritent "
        "un test ou une surveillance d'après les métadonnées fournies. "
        "Toutes les URL de sortie doivent être choisies exactement parmi les URL fournies. "
        "Si les données sont faibles, produis moins d'éléments plutôt que d'inventer."
    )
    request_body = {
        "model": MODEL,
        "instructions": instructions,
        "input": json.dumps(input_payload, ensure_ascii=False),
        "store": False,
        "text": {
            "verbosity": "low",
            "format": {
                "type": "json_schema",
                "name": "accessibility_weekly_brief",
                "strict": True,
                "schema": schema(),
            },
        },
    }
    data = json.dumps(request_body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")[:1200]
        raise RuntimeError(f"OpenAI API HTTP {exc.code}: {details}") from exc

    generated = json.loads(extract_output_text(payload))
    allowed = set(supplied_urls)
    for story in generated.get("topStories", []):
        story["sourceUrls"] = [url for url in story.get("sourceUrls", []) if url in allowed]
    for tool in generated.get("toolsToWatch", []):
        if tool.get("url") not in allowed:
            tool["url"] = ""
    return generated


def main():
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("OPENAI_API_KEY absent : le brief IA hebdomadaire est ignoré sans modifier le dernier brief.")
        return

    watch_items = recent_watch_items()
    detected_tools = recent_detected_tools()
    if not watch_items and not detected_tools:
        print("Aucune donnée récente : aucun brief IA généré.")
        return

    brief = generate_brief(api_key, watch_items, detected_tools)
    payload = {
        "generatedAt": now_iso(),
        "periodStart": (now_utc() - dt.timedelta(days=7)).date().isoformat(),
        "periodEnd": now_utc().date().isoformat(),
        "model": MODEL,
        "inputCounts": {"articles": len(watch_items), "detectedTools": len(detected_tools)},
        "brief": brief,
    }
    BRIEF_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Brief hebdomadaire généré avec {MODEL}.")


if __name__ == "__main__":
    main()
