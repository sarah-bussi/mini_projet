#!/usr/bin/env python3
import datetime as dt
import email.utils
import html
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS_FILE = ROOT / "a11y-tools" / "tools-data.js"
SOURCES_FILE = ROOT / "a11y-tools" / "sources.json"
WATCH_FILE = ROOT / "a11y-tools" / "veille-data.json"
LINK_FILE = ROOT / "a11y-tools" / "link-status.json"
USER_AGENT = "a11y-tools-watch/1.0 (+https://github.com/sarah-bussi/mini_projet)"
TIMEOUT = 15
MAX_ITEMS = 500

ssl_context = ssl.create_default_context()


def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def fetch_bytes(url, method="GET"):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ssl_context) as response:
        return response.read(), response.status, response.geturl()


def clean_text(value):
    value = re.sub(r"<[^>]+>", " ", value or "")
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def parse_date(value):
    if not value:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except Exception:
        pass
    value = value.strip().replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except Exception:
        return None


def first_text(node, names):
    for name in names:
        child = node.find(name)
        if child is not None and child.text:
            return child.text.strip()
    return ""


def atom_link(node, ns):
    for link in node.findall(f"{{{ns}}}link"):
        href = link.attrib.get("href", "")
        rel = link.attrib.get("rel", "alternate")
        if href and rel in ("alternate", ""):
            return href
    return ""


def classify(title, summary, fallback):
    text = f"{title} {summary}".lower()
    rules = [
        ("Normes & standards", ["wcag", "aria", "wai-aria", "standard", "guideline", "wcag-em", "pdf/ua"]),
        ("Outils & automatisation", ["axe", "wave", "tool", "scanner", "extension", "automation", "automated", "ai ", "mcp"]),
        ("Lecteurs d’écran & AT", ["screen reader", "nvda", "jaws", "voiceover", "talkback", "assistive technolog"]),
        ("Développement", ["developer", "development", "code", "javascript", "react", "android", "ios", "mobile"]),
        ("Design & UX", ["design", "ux", "user experience", "figma", "colour", "color", "contrast"]),
        ("Réglementation & conformité", ["law", "legal", "eaa", "section 508", "ada", "compliance", "regulation", "act "]),
        ("Recherche & tendances", ["survey", "million", "research", "study", "report", "trend"]),
    ]
    for category, keywords in rules:
        if any(keyword in text for keyword in keywords):
            return category
    return fallback or "Général"


def parse_feed(xml_bytes, source):
    root = ET.fromstring(xml_bytes)
    items = []

    # RSS / RDF-like feeds
    for item in root.findall(".//item"):
        title = first_text(item, ["title"])
        url = first_text(item, ["link"])
        description = first_text(item, ["description", "summary", "content"])
        published = first_text(item, ["pubDate", "date", "published"])
        if title and url:
            items.append({
                "title": clean_text(title),
                "url": url.strip(),
                "source": source["name"],
                "category": classify(title, description, source.get("category")),
                "published": parse_date(published),
                "summary": clean_text(description)[:420],
                "pinned": False,
            })

    if items:
        return items

    # Atom
    match = re.match(r"\{([^}]+)\}", root.tag)
    ns = match.group(1) if match else "http://www.w3.org/2005/Atom"
    for entry in root.findall(f".//{{{ns}}}entry"):
        title = first_text(entry, [f"{{{ns}}}title"])
        url = atom_link(entry, ns)
        summary = first_text(entry, [f"{{{ns}}}summary", f"{{{ns}}}content"])
        published = first_text(entry, [f"{{{ns}}}published", f"{{{ns}}}updated"])
        if title and url:
            items.append({
                "title": clean_text(title),
                "url": url.strip(),
                "source": source["name"],
                "category": classify(title, summary, source.get("category")),
                "published": parse_date(published),
                "summary": clean_text(summary)[:420],
                "pinned": False,
            })
    return items


def collect_watch():
    source_data = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    existing = json.loads(WATCH_FILE.read_text(encoding="utf-8")) if WATCH_FILE.exists() else {"items": []}
    by_url = {item.get("url"): item for item in existing.get("items", []) if item.get("url")}
    errors = []

    for source in source_data.get("sources", []):
        feed = source.get("feed")
        if not feed:
            continue
        try:
            body, _, _ = fetch_bytes(feed)
            for item in parse_feed(body, source):
                old = by_url.get(item["url"])
                if old and old.get("pinned"):
                    item["pinned"] = True
                by_url[item["url"]] = {**old, **item} if old else item
        except Exception as exc:
            errors.append({"source": source.get("name"), "feed": feed, "error": str(exc)[:180]})

    def sort_key(item):
        return item.get("published") or "0000-00-00T00:00:00Z"

    items = sorted(by_url.values(), key=sort_key, reverse=True)[:MAX_ITEMS]
    payload = {"updatedAt": now_iso(), "errors": errors, "items": items}
    WATCH_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def extract_tool_urls():
    text = TOOLS_FILE.read_text(encoding="utf-8")
    urls = re.findall(r"url\s*:\s*['\"](https?://[^'\"]+)['\"]", text)
    return sorted(set(urls))


def check_url(url):
    try:
        _, code, final_url = fetch_bytes(url, method="HEAD")
    except urllib.error.HTTPError as exc:
        code = exc.code
        final_url = exc.geturl() or url
        if code in (403, 405, 429):
            try:
                _, code, final_url = fetch_bytes(url, method="GET")
            except urllib.error.HTTPError as get_exc:
                if get_exc.code in (401, 403, 405, 429):
                    return {"state": "blocked", "code": get_exc.code, "finalUrl": get_exc.geturl() or url}
                return {"state": "broken", "code": get_exc.code, "finalUrl": get_exc.geturl() or url}
        else:
            return {"state": "broken", "code": code, "finalUrl": final_url}
    except Exception as exc:
        return {"state": "broken", "code": None, "finalUrl": url, "error": str(exc)[:160]}

    original = urllib.parse.urlsplit(url)
    final = urllib.parse.urlsplit(final_url)
    redirected = (original.scheme, original.netloc, original.path.rstrip('/')) != (final.scheme, final.netloc, final.path.rstrip('/'))
    return {"state": "redirected" if redirected else "ok", "code": code, "finalUrl": final_url}


def check_links():
    results = {}
    for url in extract_tool_urls():
        results[url] = check_url(url)
    LINK_FILE.write_text(json.dumps({"checkedAt": now_iso(), "links": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    collect_watch()
    check_links()
