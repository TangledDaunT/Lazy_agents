#!/usr/bin/env python3
"""Generate the committed, deterministic voice-router training corpus."""
import json
from pathlib import Path

OUT = Path(__file__).parent.parent / "voice_training_examples.jsonl"

rows = []
system = [
    ("open {app}", "system_command", "research"),
    ("launch {app} for me", "system_command", "research"),
    ("go to {site}", "system_command", "research"),
    ("open my {workflow} workflow", "system_command", "planner"),
    ("run the {workflow} script", "system_command", "planner"),
    ("close the {app}", "system_command", "research"),
]
apps = ["Calculator", "Calendar", "Notes", "Safari", "Preview", "Music", "Terminal", "Slack"]
sites = ["YouTube", "GitHub", "the weather website", "Google Calendar", "the news"]
workflows = ["morning review", "deploy", "backup", "standup", "focus", "release"]
for template, route, target in system:
    values = apps if "{app}" in template else sites if "{site}" in template else workflows
    for value in values:
        for prefix in ("please", "could you", "quickly", "I need you to"):
            rows.append({"state": f"{prefix} {template.format(app=value, site=value, workflow=value)}", "route": route, "target_agent": target})

claude = [
    "What is the difference between a mutex and a semaphore?",
    "Rewrite this paragraph to sound more concise.",
    "Explain why the sky is blue in simple terms.",
    "Brainstorm three names for a coffee shop.",
    "Summarize the pros and cons of remote work.",
    "Help me understand this concept without using jargon.",
]
chatgpt = [
    "Ask ChatGPT to explain this recipe.",
    "Send this question to ChatGPT and have it draft a reply.",
    "ChatGPT, what are some good books about design?",
    "Use ChatGPT to rewrite this email politely.",
]
for text in claude:
    for prefix in ("", "please ", "I want you to "):
        rows.append({"state": f"{prefix}{text}", "route": "ask_claude", "target_agent": "research"})
for text in chatgpt:
    for prefix in ("", "please ", "I want you to "):
        rows.append({"state": f"{prefix}{text}", "route": "ask_chatgpt", "target_agent": "research"})

specialists = {
    "coding": [
        "debug this Python exception", "implement a retry helper", "review this pull request",
        "write a unit test for the parser", "fix the broken Electron IPC handler",
    ],
    "research": [
        "research the latest battery technology", "look up the best local speech models",
        "investigate why this device is slow", "compare these two APIs", "find papers about wake words",
    ],
    "planner": [
        "break this project into tasks", "plan my launch checklist", "schedule a review for Friday",
        "turn these notes into a roadmap", "organize my priorities for next week",
    ],
    "stocks": [
        "analyze the outlook for semiconductor stocks", "compare these ETFs",
        "what is happening in the bond market", "review my portfolio allocation", "research this company's earnings",
    ],
}
for target, phrases in specialists.items():
    for phrase in phrases:
        for prefix in ("", "please ", "I need help to ", "can you "):
            rows.append({"state": f"{prefix}{phrase}", "route": "hermes_agent", "target_agent": target})

assert len(rows) >= 250, len(rows)
questions = {
    "route": {
            "type": "choice",
            "instructions": "How should this voice command be handled?",
            "criteria": {
                "system_command": "Open or close an app or website, or run a saved workflow/script",
                "ask_claude": "A direct question, writing, or reasoning task for Claude",
                "ask_chatgpt": "A direct question explicitly addressed to ChatGPT",
                "hermes_agent": "A task requiring tools, code, device access, or multi-step research",
            },
    },
    "target_agent": {
            "type": "choice",
            "instructions": "Which specialist fits this command?",
            "criteria": {
                "coding": "Writing, debugging, or running code",
                "research": "Researching or investigating",
                "planner": "Scheduling, breakdowns, or planning",
                "stocks": "Markets or finance",
            },
    },
}
with OUT.open("w", encoding="utf-8") as handle:
    for row in rows:
            record = {
                "state": row["state"],
                "questions": {
                    **{key: {**value, "label": row[key]} for key, value in questions.items()},
                },
            }
            handle.write(json.dumps(record, ensure_ascii=True) + "\n")
print(f"Wrote {len(rows)} examples to {OUT}")
