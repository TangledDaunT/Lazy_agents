"""
Hermes backend - the brain. Talks to Nemotron Super, runs handoff logic,
speaks replies via Piper, and pushes UI state events (listening/working/
awaiting-approval/council) to the Electron renderer over the /bus websocket.

Run: pip install fastapi uvicorn websockets openai
     export NEMOTRON_BASE_URL=...  NEMOTRON_API_KEY=...
     python orchestrator.py
"""
import asyncio
import json
import os
import subprocess
from pathlib import Path
from typing import Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from openai import OpenAI

HERE = Path(__file__).parent
CONFIG_PATH = HERE.parent / "agents_config.json"
CONTEXT_FILE = HERE / "shared_context.md"     # the cross-agent sync file
VAULT_DIR = Path(os.environ.get("OBSIDIAN_VAULT_PATH", str(HERE / "vault_placeholder")))
PIPER_BIN = os.environ.get("PIPER_BIN", "piper")
PIPER_VOICES_DIR = Path(os.environ.get("PIPER_VOICES_DIR", str(HERE / "voices")))
MODEL_NAME = os.environ.get("NEMOTRON_MODEL", "nvidia/llama-3.1-nemotron-super-49b-v1")

with open(CONFIG_PATH) as f:
    AGENTS: Dict[str, dict] = json.load(f)

client = OpenAI(
    base_url=os.environ.get("NEMOTRON_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    api_key=os.environ.get("NEMOTRON_API_KEY", "NOT_SET"),
)

histories: Dict[str, List[dict]] = {name: [] for name in AGENTS}
CONTEXT_FILE.touch(exist_ok=True)

app = FastAPI()
bus_clients: List[WebSocket] = []


async def broadcast(event: dict):
    dead = []
    for ws in bus_clients:
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for d in dead:
        bus_clients.remove(d)


def speak(agent_id: str, text: str):
    """Synthesize with Piper using this agent's voice model, then play it."""
    voice_file = PIPER_VOICES_DIR / AGENTS[agent_id]["piperVoice"]
    if not voice_file.exists():
        print(f"[tts] voice model missing for {agent_id}: {voice_file}")
        return
    try:
        # piper writes wav to stdout; pipe straight into afplay (macOS) via a temp file
        wav_path = f"/tmp/hermes_{agent_id}.wav"
        p1 = subprocess.run(
            [PIPER_BIN, "--model", str(voice_file), "--output_file", wav_path],
            input=text.encode("utf-8"),
            capture_output=True,
        )
        subprocess.Popen(["afplay", wav_path])
    except FileNotFoundError:
        print("[tts] piper or afplay not found on PATH")


def read_shared_context() -> str:
    return CONTEXT_FILE.read_text()


def append_shared_context(agent_id: str, note: str):
    with open(CONTEXT_FILE, "a") as f:
        f.write(f"\n### {AGENTS[agent_id]['displayName']}\n{note}\n")


TRANSFER_TOOL = {
    "type": "function",
    "function": {
        "name": "transfer_to_agent",
        "description": "Hand off to a different specialist agent.",
        "parameters": {
            "type": "object",
            "properties": {
                "target": {"type": "string", "enum": list(AGENTS.keys())},
                "message": {"type": "string"},
            },
            "required": ["target", "message"],
        },
    },
}


async def run_agent_turn(agent_id: str, user_text: str, depth: int = 0) -> str:
    if depth > 3:
        return "(handoff loop guard tripped)"

    await broadcast({"type": "agent_working", "agent": agent_id})

    history = histories[agent_id]
    history.append({"role": "user", "content": user_text})

    system = AGENTS[agent_id]["role"] + "\n\nShared context from other agents:\n" + read_shared_context()
    messages = [{"role": "system", "content": system}] + history

    resp = client.chat.completions.create(
        model=MODEL_NAME, messages=messages, tools=[TRANSFER_TOOL], tool_choice="auto",
    )
    msg = resp.choices[0].message

    if msg.tool_calls:
        call = msg.tool_calls[0]
        args = json.loads(call.function.arguments)
        target, handoff_msg = args["target"], args["message"]
        history.append({"role": "assistant", "content": f"[transferred to {target}]"})
        reply = await run_agent_turn(target, handoff_msg, depth + 1)
        speak(target, reply)
        append_shared_context(target, f"Handled (via handoff): {handoff_msg[:200]}")
        await broadcast({"type": "agent_idle", "agent": agent_id})
        return reply

    reply = msg.content or ""
    history.append({"role": "assistant", "content": reply})
    append_shared_context(agent_id, f"User asked: {user_text[:200]}\nReplied: {reply[:200]}")
    speak(agent_id, reply)
    await broadcast({"type": "agent_idle", "agent": agent_id})
    return reply


async def run_council(question: str):
    await broadcast({"type": "council_start"})
    ids = [a for a in AGENTS if AGENTS[a].get("position") != "center"]
    results = dict(zip(ids, await asyncio.gather(*(run_agent_turn(a, question) for a in ids))))

    synth_prompt = "Council answers:\n" + "\n".join(f"- {AGENTS[a]['displayName']}: {r}" for a, r in results.items())
    synth_prompt += "\n\nAs Hermes, synthesize the best combined answer in 3-5 sentences."
    synthesis = await run_agent_turn("hermes", synth_prompt)
    results["__synthesis__"] = synthesis

    await broadcast({"type": "council_end"})
    return results


@app.websocket("/bus")
async def bus(websocket: WebSocket):
    await websocket.accept()
    bus_clients.append(websocket)
    try:
        while True:
            raw = await websocket.receive_json()
            if raw.get("type") == "user_message":
                agent, text = raw["agent"], raw["text"]
                if agent == "__council__":
                    await run_council(text)
                else:
                    await run_agent_turn(agent, text)
            elif raw.get("type") == "wake":
                # forwarded from wakeword_listener.py's own connection, or relayed here
                await broadcast({"type": "wake", "agent": raw["agent"]})
    except WebSocketDisconnect:
        bus_clients.remove(websocket)


@app.get("/vault")
def vault_list():
    if not VAULT_DIR.exists():
        return {"files": [f"(vault path not found: {VAULT_DIR})"]}
    files = [str(p.relative_to(VAULT_DIR)) for p in VAULT_DIR.rglob("*.md")]
    return {"files": files[:200]}


@app.get("/context")
def get_context():
    return {"content": read_shared_context()}


@app.post("/agents_config")
async def update_config(new_config: dict):
    global AGENTS
    AGENTS = new_config
    with open(CONFIG_PATH, "w") as f:
        json.dump(AGENTS, f, indent=2)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
