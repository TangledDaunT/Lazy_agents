#!/usr/bin/env python3
"""Classify and dispatch one voice transcript.

The process is intentionally stateless at the request level. Commands are
stored in SQLite so the catalog survives app restarts and can be managed
without changing the Electron bundle.
"""
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

DB_PATH = Path(os.environ.get("VOICE_COMMAND_DB", str(Path.home() / ".lazyagents" / "commands.db")))
KEV_URL = os.environ.get("KEV_URL", "http://127.0.0.1:8009/v1/systemone")
AGENT_CONFIG = Path(os.environ.get("VOICE_AGENT_CONFIG", str(Path(__file__).parent.parent / "agents_config.json")))

QUESTIONS = {
    "route": {
        "type": "choice",
        "instructions": "How should this voice command be handled?",
        "criteria": {
            "system_command": "Open or close an app or website, or run a saved workflow/script",
            "ask_claude": "A question, research, writing, or reasoning task needing only a direct answer",
            "ask_chatgpt": "A question explicitly addressed to ChatGPT needing only a direct answer",
            "hermes_agent": "A task requiring tools, code execution, file/device access, or active multi-step research",
        },
    },
    "target_agent": {
        "type": "choice",
        "instructions": "If this needs a Hermes specialist, which one fits best?",
        "criteria": {
            "coding": "Writing, debugging, or running code",
            "research": "Researching devices, looking things up, or investigation",
            "planner": "Scheduling, task breakdown, or planning",
            "stocks": "Market or finance related",
        },
    },
}


def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS commands (
          id INTEGER PRIMARY KEY,
          phrase TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('app', 'website', 'workflow', 'script')),
          target TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS commands_fts USING fts5(
          phrase, content='commands', content_rowid='id'
        );
        CREATE TRIGGER IF NOT EXISTS commands_ai AFTER INSERT ON commands BEGIN
          INSERT INTO commands_fts(rowid, phrase) VALUES (new.id, new.phrase);
        END;
        """
    )
    conn.executemany(
        "INSERT INTO commands (phrase, type, target) SELECT ?, ?, ? WHERE NOT EXISTS "
        "(SELECT 1 FROM commands WHERE phrase = ?)",
        [
            ("open calculator", "app", "Calculator", "open calculator"),
            ("open youtube", "website", "https://youtube.com", "open youtube"),
        ],
    )
    return conn


def heuristic(text: str) -> dict[str, str]:
    lower = text.lower()
    if re.search(r"\bask\s+(?:claude|chatgpt)\b", lower):
        route = "ask_claude" if "claude" in lower else "ask_chatgpt"
    elif re.search(r"\b(open|launch|start|close|quit|run|execute|go to|navigate)\b", lower):
        route = "system_command"
    elif re.search(r"\b(write|debug|code|file|device|research|look up|investigate|schedule)\b", lower):
        route = "hermes_agent"
    else:
        route = "ask_claude"
    if re.search(r"\b(stock|stocks|market|finance|shares|portfolio)\b", lower):
        target = "stocks"
    elif re.search(r"\b(plan|schedule|calendar|break down)\b", lower):
        target = "planner"
    elif re.search(r"\b(code|debug|bug|implement|program)\b", lower):
        target = "coding"
    else:
        target = "research"
    return {"route": route, "target_agent": target}


def explicit_agent_classification(text: str) -> dict[str, Any] | None:
    lower = text.lower()
    aliases = {
        "sage": ("sage", "research"),
        "researcher": ("sage", "research"),
        "byte": ("byte", "coding"),
        "coder": ("byte", "coding"),
        "coding": ("byte", "coding"),
        "compass": ("compass", "planner"),
        "planner": ("compass", "planner"),
        "ledger": ("ledger", "stocks"),
        "hermes": ("hermes", "research"),
    }
    for name, (agent_id, target_agent) in aliases.items():
        if re.search(rf"\b(?:ask|tell|send|route|give).{{0,40}}\b{name}\b", lower):
            return {
                "route": "hermes_agent",
                "target_agent": target_agent,
                "agent_id": agent_id,
                "route_confidence": 1.0,
            }
    if re.search(r"\b(?:local device|use tools|tool calls?|run commands?|access files?)\b", lower):
        return {"route": "hermes_agent", "target_agent": "research", "agent_id": "hermes", "route_confidence": 1.0}
    if re.search(r"\b(?:code|coding|debug|implement|program|repository|repo)\b", lower) and re.search(
        r"\b(?:tool|run|edit|write|file|code)\b", lower
    ):
        return {"route": "hermes_agent", "target_agent": "coding", "agent_id": "byte", "route_confidence": 1.0}
    if re.search(r"\b(?:research|look up|fact.?check|papers?)\b", lower):
        return {"route": "hermes_agent", "target_agent": "research", "agent_id": "sage", "route_confidence": 1.0}
    return None


def kev_classify(text: str) -> dict[str, str]:
    payload = json.dumps({"state": text, "model": "kev-latest", "questions": QUESTIONS}).encode()
    request = urllib.request.Request(KEV_URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=10) as response:
        data = json.loads(response.read())
    result = data.get("answers", data.get("results", data))
    answer: dict[str, str] = {}
    confidence: dict[str, float] = {}
    for name in QUESTIONS:
        value = result.get(name) if isinstance(result, dict) else None
        if isinstance(value, str):
            answer[name] = value
        elif isinstance(value, dict):
            if isinstance(value.get("confidence"), (int, float)):
                confidence[name] = float(value["confidence"])
            answer[name] = (
                value.get("choice")
                or value.get("answer")
                or value.get("label")
                or max(value.get("probabilities", value), key=value.get("probabilities", value).get)
            )
    if answer.get("route") in QUESTIONS["route"]["criteria"] and answer.get("target_agent") in QUESTIONS["target_agent"]["criteria"]:
        return {**answer, **{f"{name}_confidence": value for name, value in confidence.items()}}
    raise ValueError("kev returned an incomplete classification")


def resolve_command(conn: sqlite3.Connection, text: str) -> tuple[str, str, str] | None:
    terms = " ".join(re.findall(r"[A-Za-z0-9]+", text))
    if not terms:
        return None
    row = conn.execute(
        "SELECT c.type, c.target, c.phrase FROM commands_fts f JOIN commands c ON c.id = f.rowid "
        "WHERE commands_fts MATCH ? ORDER BY bm25(commands_fts) LIMIT 1",
        (" OR ".join(terms.split()),),
    ).fetchone()
    return row if row else None


def normalize_app_target(target: str) -> str:
    """Turn spoken app names into launchable macOS application names."""
    cleaned = re.sub(
        r"(?:\s+(?:for me|please|now|thanks|thank you))+",
        "",
        re.sub(r"\s+", " ", target.strip().strip(" .,!?")),
        flags=re.I,
    ).strip()
    normalized = cleaned.lower()
    if "google chrome" in normalized or normalized == "chrome":
        return "Google Chrome"
    if normalized.startswith("youtube"):
        return "YouTube"
    aliases = {
        "chrome": "Google Chrome",
        "google chrome": "Google Chrome",
        "safari": "Safari",
        "finder": "Finder",
        "calculator": "Calculator",
    }
    return aliases.get(normalized, cleaned)


def normalize_website_target(target: str) -> str:
    normalized = re.sub(r"[\s.]+$", "", target.strip().lower())
    normalized = re.sub(r"\s+", "", normalized)
    if normalized in {"youtube", "youtub"} or normalized in {"youtubecom", "youtube.com"}:
        return "https://youtube.com"
    if re.match(r"^https?://", normalized):
        return normalized
    return f"https://{normalized}" if "." in normalized else f"https://www.{normalized}.com"


def launch_application(target: str) -> None:
    command = ["open", "-a", target]
    print(f"[voice][dispatch] {' '.join(command)}", file=sys.stderr, flush=True)
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    print(f"[voice][timing] t5 process-launched={time.time():.6f} pid={process.pid}", file=sys.stderr, flush=True)
    try:
        _, stderr = process.communicate(timeout=1.0)
    except subprocess.TimeoutExpired:
        return
    if process.returncode != 0:
        detail = stderr.strip() or f"open exited with code {process.returncode}"
        raise OSError(detail)


def launch_url(url: str) -> None:
    command = ["open", url]
    print(f"[voice][dispatch] {' '.join(command)}", file=sys.stderr, flush=True)
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    print(f"[voice][timing] t5 process-launched={time.time():.6f} pid={process.pid}", file=sys.stderr, flush=True)
    _, stderr = process.communicate(timeout=1.0)
    if process.returncode != 0:
        raise OSError(stderr.strip() or f"open exited with code {process.returncode}")


def launch_website(url: str) -> None:
    command = ["open", "-a", "Google Chrome", url]
    print(f"[voice][dispatch] {' '.join(command)}", file=sys.stderr, flush=True)
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    print(f"[voice][timing] t5 process-launched={time.time():.6f} pid={process.pid}", file=sys.stderr, flush=True)
    _, stderr = process.communicate(timeout=1.0)
    if process.returncode != 0:
        raise OSError(stderr.strip() or f"open exited with code {process.returncode}")


def launch_app_or_website(target: str) -> tuple[str, str]:
    try:
        launch_application(target)
        return "app", target
    except OSError as error:
        slug = re.sub(r"[^a-z0-9]+", "-", target.lower()).strip("-")
        url = target if re.match(r"^https?://", target, re.I) else (
            f"https://{target.lower()}" if "." in target else f"https://www.{slug}.com"
        )
        print(
            f"[voice][dispatch] app unavailable ({error}); opening website {url}",
            file=sys.stderr,
            flush=True,
        )
        launch_url(url)
        return "website", url


def dispatch_system(conn: sqlite3.Connection, text: str) -> dict[str, Any]:
    direct = re.search(r"^\s*(open|launch|start|close|quit|exit)\s+(.+?)\s*$", text, re.I)
    if direct:
        target = direct.group(2).strip()
        target_words = re.sub(r"[^a-z0-9]+", " ", target.lower()).split()
        if "youtube" in target_words or "youtub" in target_words:
            kind = "website"
            target = "https://youtube.com"
        else:
            kind = "app"
        phrase = target
    else:
        command = resolve_command(conn, text)
        if not command:
            raise ValueError("No saved command matched this request")
        kind, target, phrase = command
    if kind == "app":
        target = normalize_app_target(target)
    accessibility = subprocess.run(
        ["osascript", "-e", 'tell application "System Events" to get name of first UI element of front window of first process'],
        capture_output=True, text=True
    )
    print(
        f"[voice][accessibility] System Events access: "
        f"{'granted' if accessibility.returncode == 0 else 'denied'}"
        f"{f' ({accessibility.stderr.strip()})' if accessibility.returncode else ''}",
        file=sys.stderr, flush=True
    )
    if kind == "app":
        if re.search(r"\b(close|quit|exit)\b", text, re.I):
            command = ["osascript", "-e", f'''
              tell application "System Events"
                set appName to "{target}"
                if exists process appName then tell process appName to quit
              end tell
            ''']
            print(f"[voice][dispatch] {' '.join(command)}", file=sys.stderr, flush=True)
            subprocess.run(command, check=True)
        else:
            kind, target = launch_app_or_website(target)
    elif kind == "website":
        if re.search(r"\b(close|quit)\b", text, re.I):
            close_chrome_tab(target)
        else:
            launch_website(target)
    elif kind in ("workflow", "script"):
        command = [target]
        print(f"[voice][dispatch] {' '.join(command)}", file=sys.stderr, flush=True)
        subprocess.Popen(command)
    return {"ok": True, "phrase": phrase, "target": target, "type": kind}


def close_chrome_tab(url_fragment: str) -> None:
    script = f'''
      tell application "Google Chrome"
        repeat with w in windows
          repeat with t in tabs of w
            if (URL of t) contains "{url_fragment}" then
              close t
              return
            end if
          end repeat
        end repeat
      end tell
    '''
    subprocess.run(["osascript", "-e", script], check=True)


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"ok": False, "error": "expected one transcript"}))
        return 2
    text = sys.argv[1].strip()
    print(f"[voice][transcript] {text}", file=sys.stderr, flush=True)
    conn = db()
    deterministic = re.match(r"^\s*(open|launch|start|close|quit|exit)\s+.+$", text, re.I)
    explicit_agent = explicit_agent_classification(text)
    if deterministic:
        classification = {**heuristic(text), "route": "system_command", "route_confidence": 1.0, "resolved_target": deterministic.group(0)}
        print("[voice][classification] deterministic system command; Kev skipped", file=sys.stderr, flush=True)
    elif explicit_agent:
        classification = explicit_agent
        print(
            f"[voice][classification] explicit agent={classification['agent_id']}; Kev skipped",
            file=sys.stderr,
            flush=True,
        )
    else:
        print(f"[voice][timing] t3 kev-request-sent={time.time():.6f}", file=sys.stderr, flush=True)
        try:
            classification = kev_classify(text)
            print(f"[voice][timing] t4 kev-response-received={time.time():.6f}", file=sys.stderr, flush=True)
        except (OSError, ValueError, TimeoutError, json.JSONDecodeError) as error:
            classification = {**heuristic(text), "route_confidence": 0.0}
            print(f"[voice][classification] Kev unavailable ({error}); using heuristic fallback", file=sys.stderr, flush=True)
    print(
        f"[voice][classification] category={classification.get('route')} "
        f"confidence={classification.get('route_confidence', 'unknown')} "
        f"target={classification.get('resolved_target', classification.get('target_agent', 'none'))}",
        file=sys.stderr, flush=True
    )
    try:
        if classification["route"] == "system_command":
            result = dispatch_system(conn, text)
        else:
            result = {
                "ok": True,
                "route": classification["route"],
                "target_agent": classification["target_agent"],
                "agent_id": classification.get("agent_id"),
                "text": text,
            }
        result["classification"] = classification
        print(f"[voice][timing] t6 router-done={time.time():.6f}", file=sys.stderr, flush=True)
        print(json.dumps(result))
        return 0
    except (OSError, sqlite3.Error, ValueError) as error:
        print(json.dumps({"ok": False, "error": str(error), "classification": classification}))
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
