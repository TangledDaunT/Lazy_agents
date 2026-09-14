"""
Hermes Bridge - Connects LazyAgents Electron app to Hermes Agent via the Runs API.

This bridge:
1. Exposes a websocket server for Electron to connect to
2. POSTs to create runs on the Hermes gateway API (/v1/runs)
3. Streams SSE events from the runs endpoint
4. Parses events and broadcasts them to websocket clients

Run: pip install fastapi uvicorn httpx websockets
     export HERMES_GATEWAY_URL=http://localhost:8642  # or Tailscale URL
     python hermes_bridge.py
"""
import asyncio
import json
import os
import re
from typing import Dict, List, Optional
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import httpx

# Configuration
HERMES_GATEWAY_URL = os.environ.get("HERMES_GATEWAY_URL", "http://localhost:8642")
HERMES_API_KEY = os.environ.get("HERMES_API_KEY", "")
BRIDGE_PORT = int(os.environ.get("BRIDGE_PORT", "8766"))

HERE = Path(__file__).parent
CONFIG_PATH = HERE.parent / "agents_config.json"
CONTEXT_FILE = HERE.parent / "shared_context.md"
VAULT_DIR = Path(os.environ.get("OBSIDIAN_VAULT_PATH", str(HERE.parent / "vault_placeholder")))

# Load agent config
try:
    with open(CONFIG_PATH) as f:
        AGENTS: Dict[str, dict] = json.load(f)
except FileNotFoundError:
    AGENTS = {}

app = FastAPI()
bus_clients: List[WebSocket] = []


async def broadcast(event: dict):
    """Broadcast an event to all connected websocket clients."""
    dead = []
    for ws in bus_clients:
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for d in dead:
        bus_clients.remove(d)


def parse_sse_line(line: str) -> Optional[Dict]:
    """Parse a single SSE line into event data.
    
    Actual Hermes API format (observed):
        data: {"event": "message.delta", "run_id": "...", "delta": "..."}
        data: {"event": "run.completed", "run_id": "...", "output": "..."}
        <blank line>
    """
    if not line.strip():
        return None
    
    # Handle SSE comments (like ": stream closed")
    if line.startswith(":"):
        return {"type": "comment", "value": line[1:].strip()}
    
    if line.startswith("event:"):
        return {"type": "event_name", "value": line[6:].strip()}
    elif line.startswith("data:"):
        data_str = line[5:].strip()
        try:
            data_obj = json.loads(data_str)
            # Hermes events have "event" field inside the data
            event_type = data_obj.get("event", "unknown")
            return {"type": "data", "value": data_obj, "event_type": event_type}
        except json.JSONDecodeError:
            return {"type": "data_raw", "value": data_str}
    
    return None


async def stream_run_events(
    run_id: str,
    session_id: Optional[str] = None,
    headers: Dict[str, str] = None
) -> None:
    """Stream SSE events from a Hermes run and broadcast to websocket clients.
    
    Args:
        run_id: The run ID to stream events from
        session_id: Optional session ID for session-scoped runs
        headers: Optional additional headers for the request
    """
    stream_url = f"{HERMES_GATEWAY_URL}/v1/runs/{run_id}/events"
    
    request_headers = {
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache",
    }
    if HERMES_API_KEY:
        request_headers["Authorization"] = f"Bearer {HERMES_API_KEY}"
    if session_id:
        request_headers["X-Hermes-Session-Id"] = session_id
    if headers:
        request_headers.update(headers)
    
    current_event = None
    event_buffer = []
    
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("GET", stream_url, headers=request_headers) as response:
                if response.status_code != 200:
                    await broadcast({
                        "type": "run_error",
                        "run_id": run_id,
                        "error": f"Failed to stream run: HTTP {response.status_code}",
                        "details": await response.aread()
                    })
                    return
                
                async for line in response.aiter_lines():
                    parsed = parse_sse_line(line)
                    
                    if parsed is None:
                        # Blank line signals end of event
                        if current_event and event_buffer:
                            # Combine all data chunks
                            data_obj = {}
                            for item in event_buffer:
                                if isinstance(item, dict):
                                    data_obj.update(item)
                                elif isinstance(item, str):
                                    data_obj["_raw"] = item
                            
                            # Broadcast the event with proper type translation
                            event_type = data_obj.get("event", current_event)
                            await broadcast({
                                "type": "run_event",
                                "run_id": run_id,
                                "event": event_type,
                                "data": data_obj
                            })
                            
                            # Map Hermes events to UI events
                            if "message.delta" in event_type:
                                await broadcast({
                                    "type": "agent_working",
                                    "agent": "hermes",
                                    "delta": data_obj.get("delta", "")
                                })
                            elif "run.completed" in event_type:
                                await broadcast({
                                    "type": "run_completed",
                                    "run_id": run_id,
                                    "output": data_obj.get("output", ""),
                                    "agent": "hermes"
                                })
                                await broadcast({
                                    "type": "agent_idle",
                                    "agent": "hermes"
                                })
                        elif event_buffer:
                            # No event type but have data - broadcast directly
                            for item in event_buffer:
                                if isinstance(item, dict) and "event" in item:
                                    event_type = item.get("event", "unknown")
                                    await broadcast({
                                        "type": "run_event",
                                        "run_id": run_id,
                                        "event": event_type,
                                        "data": item
                                    })
                                    if "message.delta" in event_type:
                                        await broadcast({
                                            "type": "agent_working",
                                            "agent": "hermes",
                                            "delta": item.get("delta", "")
                                        })
                                    elif "run.completed" in event_type:
                                        await broadcast({
                                            "type": "run_completed",
                                            "run_id": run_id,
                                            "output": item.get("output", ""),
                                            "agent": "hermes"
                                        })
                                        await broadcast({
                                            "type": "agent_idle",
                                            "agent": "hermes"
                                        })
                        
                        current_event = None
                        event_buffer = []
                        continue
                    
                    if parsed["type"] == "event_name":
                        current_event = parsed["value"]
                    elif parsed["type"] == "data":
                        event_buffer.append(parsed["value"])
                    elif parsed["type"] == "data_raw":
                        event_buffer.append(parsed["value"])
                    elif parsed["type"] == "comment":
                        # Stream closed notification
                        if "stream closed" in parsed["value"]:
                            await broadcast({
                                "type": "stream_closed",
                                "run_id": run_id
                            })
                        
    except httpx.RequestError as e:
        await broadcast({
            "type": "run_error",
            "run_id": run_id,
            "error": f"Connection error: {str(e)}"
        })
    except Exception as e:
        await broadcast({
            "type": "run_error",
            "run_id": run_id,
            "error": f"Unexpected error: {str(e)}"
        })


async def create_run(
    prompt: str,
    agent_id: Optional[str] = None,
    session_id: Optional[str] = None,
    model: Optional[str] = None,
    skills: Optional[List[str]] = None,
    stream: bool = True
) -> Dict:
    """Create a run on the Hermes gateway API.

    Args:
        prompt: The user prompt/message
        agent_id: Optional agent ID for agent-specific runs
        session_id: Optional session ID for conversation continuity
        model: Optional model override
        skills: Optional list of skills to load
        stream: Whether to stream events (default: True)

    Returns:
        Dict with run_id and status
    """
    create_url = f"{HERMES_GATEWAY_URL}/v1/runs"

    headers = {
        "Content-Type": "application/json",
    }
    if HERMES_API_KEY:
        headers["Authorization"] = f"Bearer {HERMES_API_KEY}"
    if session_id:
        headers["X-Hermes-Session-Id"] = session_id

    payload = {
        "input": prompt,
        "stream": stream,
    }

    if agent_id:
        # Get agent config if available
        if agent_id in AGENTS:
            agent_config = AGENTS[agent_id]
            # Use the hermesProfile for routing
            if "hermesProfile" in agent_config:
                payload["profile"] = agent_config["hermesProfile"]
                print(f"[DEBUG] Routing agent {agent_id} to profile {agent_config['hermesProfile']}", flush=True)
            # Some agents may have specific model/skill settings
            if "model" in agent_config:
                payload["model"] = agent_config["model"]
        payload["agent_id"] = agent_id

    if model:
        payload["model"] = model
    if skills:
        payload["skills"] = skills

    print(f"[DEBUG] Creating run with payload: {payload}", flush=True)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(create_url, headers=headers, json=payload)
            print(f"[DEBUG] Hermes response status: {response.status_code}", flush=True)
            if response.status_code not in (200, 201, 202):
                error_text = await response.aread()
                print(f"[DEBUG] Hermes error response: {error_text}", flush=True)
                return {
                    "error": f"Failed to create run: HTTP {response.status_code}",
                    "details": error_text.decode() if isinstance(error_text, bytes) else str(error_text)
                }

            result = response.json()
            run_id = result.get("run_id") or result.get("id")

            if stream and run_id:
                # Start streaming events in background
                asyncio.create_task(stream_run_events(run_id, session_id, headers))

            return {
                "run_id": run_id,
                "status": result.get("status", "created"),
                "session_id": session_id
            }

    except httpx.RequestError as e:
        return {"error": f"Connection error: {str(e)}"}


async def cancel_run(run_id: str, session_id: Optional[str] = None) -> Dict:
    """Cancel a running Hermes run.
    
    Args:
        run_id: The run ID to cancel
        session_id: Optional session ID
    
    Returns:
        Dict with cancellation status
    """
    cancel_url = f"{HERMES_GATEWAY_URL}/v1/runs/{run_id}/cancel"
    
    headers = {}
    if HERMES_API_KEY:
        headers["Authorization"] = f"Bearer {HERMES_API_KEY}"
    if session_id:
        headers["X-Hermes-Session-Id"] = session_id
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(cancel_url, headers=headers)
            
            if response.status_code not in (200, 202):
                return {
                    "error": f"Failed to cancel run: HTTP {response.status_code}",
                    "details": response.text
                }
            
            return {"run_id": run_id, "status": "cancelled"}
            
    except httpx.RequestError as e:
        return {"error": f"Connection error: {str(e)}"}


async def get_run_status(run_id: str) -> Dict:
    """Get the status of a Hermes run.
    
    Args:
        run_id: The run ID to check
    
    Returns:
        Dict with run status information
    """
    status_url = f"{HERMES_GATEWAY_URL}/v1/runs/{run_id}"
    
    headers = {}
    if HERMES_API_KEY:
        headers["Authorization"] = f"Bearer {HERMES_API_KEY}"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(status_url, headers=headers)
            
            if response.status_code != 200:
                return {
                    "error": f"Failed to get status: HTTP {response.status_code}",
                    "details": response.text
                }
            
            return response.json()
            
    except httpx.RequestError as e:
        return {"error": f"Connection error: {str(e)}"}


@app.websocket("/bus")
async def bus(websocket: WebSocket):
    """Main websocket endpoint for Electron app connection.
    
    Receives commands from Electron and broadcasts Hermes run events back.
    
    Message types:
        - create_run: Create a new Hermes run
        - cancel_run: Cancel a running run
        - get_status: Get run status
        - ping: Health check
    """
    await websocket.accept()
    bus_clients.append(websocket)
    
    try:
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get("type")
            
            if msg_type == "create_run":
                # Create a new run
                result = await create_run(
                    prompt=raw.get("prompt", ""),
                    agent_id=raw.get("agent"),
                    session_id=raw.get("session_id"),
                    model=raw.get("model"),
                    skills=raw.get("skills"),
                    stream=raw.get("stream", True)
                )
                await websocket.send_json({
                    "type": "run_created",
                    **result
                })
                
            elif msg_type == "cancel_run":
                # Cancel a run
                result = await cancel_run(
                    run_id=raw.get("run_id"),
                    session_id=raw.get("session_id")
                )
                await websocket.send_json({
                    "type": "run_cancelled",
                    **result
                })
                
            elif msg_type == "get_status":
                # Get run status
                result = await get_run_status(raw.get("run_id"))
                await websocket.send_json({
                    "type": "run_status",
                    **result
                })
                
            elif msg_type == "ping":
                # Health check
                await websocket.send_json({"type": "pong"})

            elif msg_type == "wake":
                # Relay wake-word detections from the microphone listener to Electron.
                await broadcast({"type": "wake", "agent": raw.get("agent")})
                
            elif msg_type == "user_message":
                # Legacy compatibility: treat as create_run
                # This matches the orchestrator.py interface
                result = await create_run(
                    prompt=raw.get("text", ""),
                    agent_id=raw.get("agent"),
                    stream=True
                )
                await websocket.send_json({
                    "type": "run_created",
                    **result
                })
                
    except WebSocketDisconnect:
        bus_clients.remove(websocket)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "gateway_url": HERMES_GATEWAY_URL,
        "clients_connected": len(bus_clients)
    }


@app.get("/agents")
async def list_agents():
    """List available agents from config."""
    return {"agents": list(AGENTS.keys())}


@app.get("/agents_config")
async def get_agents_config():
    return AGENTS


@app.get("/context")
async def get_context():
    context_data = ""
    if CONTEXT_FILE.exists():
        context_data = CONTEXT_FILE.read_text()
    return {"content": context_data, "file": str(CONTEXT_FILE)}


@app.post("/agents_config")
async def update_config(new_config: dict):
    global AGENTS
    AGENTS = new_config
    CONFIG_PATH.write_text(json.dumps(AGENTS, indent=2) + "\n")
    await broadcast({"type": "config_updated", "agents": AGENTS})
    return {"ok": True}


@app.post("/create_run")
async def http_create_run(request: dict):
    """HTTP endpoint to create a run (for testing)."""
    result = await create_run(
        prompt=request.get("prompt", ""),
        agent_id=request.get("agent"),
        session_id=request.get("session_id"),
        model=request.get("model"),
        skills=request.get("skills"),
        stream=request.get("stream", True)
    )
    return result


@app.get("/")
async def root():
    """Root endpoint with basic info."""
    return {
        "name": "Hermes Bridge",
        "version": "1.0.0",
        "gateway_url": HERMES_GATEWAY_URL,
        "websocket_endpoint": "/bus",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    print(f"[hermes_bridge] Starting on port {BRIDGE_PORT}")
    print(f"[hermes_bridge] Connecting to Hermes gateway at {HERMES_GATEWAY_URL}")
    uvicorn.run(app, host="0.0.0.0", port=BRIDGE_PORT)


@app.post("/restart")
async def restart_bridge():
    """Signal to restart the bridge."""
    await broadcast({"type": "bridge_restarting"})
    return {"status": "restarting"}


@app.get("/vault/settings")
async def get_vault_settings():
    """Get current vault path setting."""
    return {"vault_path": str(VAULT_DIR), "exists": VAULT_DIR.exists()}


@app.get("/vault")
async def list_vault_files():
    """List markdown files in the vault."""
    if not VAULT_DIR.exists():
        return {"files": ["Vault not found - configure path in Settings"]}
    
    files = []
    for f in VAULT_DIR.rglob("*.md"):
        rel_path = f.relative_to(VAULT_DIR)
        files.append(str(rel_path))
    
    return {"files": sorted(files)[:100], "vault_path": str(VAULT_DIR)}


@app.get("/vault/{file_path:path}")
async def read_vault_file(file_path: str):
    """Read a specific vault file."""
    full_path = VAULT_DIR / file_path
    if not full_path.exists() or not full_path.is_file():
        return {"error": "File not found"}
    
    try:
        content = full_path.read_text(encoding="utf-8")
        return content
    except Exception as e:
        return {"error": str(e)}


@app.post("/vault/settings")
async def set_vault_settings(settings: dict):
    """Update vault path."""
    global VAULT_DIR
    new_path = settings.get("vault_path")
    if new_path:
        VAULT_DIR = Path(new_path)
        return {"ok": True, "vault_path": str(VAULT_DIR)}
    return {"error": "No path provided"}


@app.on_event("startup")
async def load_hermes_profiles():
    """Preload profile information from Hermes."""
    global PROFILES
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{HERMES_GATEWAY_URL}/v1/profiles", 
                headers={"Authorization": f"Bearer {HERMES_API_KEY}"})
            if resp.status_code == 200:
                PROFILES = resp.json()
    except Exception as e:
        print(f"[hermes_bridge] Could not load profiles: {e}")
        PROFILES = {}


@app.get("/profiles")
async def list_profiles():
    """List available Hermes profiles."""
    return {"profiles": list(PROFILES.keys()) if PROFILES else ["default", "byte", "ledger", "sage", "compass"]}
