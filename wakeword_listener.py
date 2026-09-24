"""Local MLX Whisper push-to-talk listener.

Audio is captured continuously at 16 kHz mono. A push-to-talk session starts
on the native key-down event and retains a short tail after key-up so the last
word is not clipped before Whisper receives the clip.
"""
import asyncio
import json
import os
import tempfile
import threading
import time
import wave
from pathlib import Path

import websockets

HERE = Path(__file__).parent
BUS_URL = os.environ.get("BRIDGE_URL", "ws://localhost:8766/bus")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "mlx-community/whisper-tiny.en-mlx")
SAMPLE_RATE = 16000
TAIL_SECONDS = 0.2
hotkey_started = threading.Event()
hotkey_stopped = threading.Event()
hotkey_lock = threading.Lock()
session_timestamp = None


def write_wav(path: str, frames: list[bytes]) -> None:
    with wave.open(path, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(b"".join(frames))


def transcribe(path: str) -> str:
    import mlx_whisper

    started = time.perf_counter()
    result = mlx_whisper.transcribe(
        path,
        path_or_hf_repo=WHISPER_MODEL,
        language="en",
        task="transcribe",
        temperature=0,
        condition_on_previous_text=False,
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    text = result.get("text", "").strip()
    print(
        f"[wakeword][whisper] model={WHISPER_MODEL} "
        f"audio_end_to_transcript_ms={elapsed_ms:.1f} text={text!r}",
        flush=True,
    )
    return text


def listen() -> tuple[str, bool] | None:
    import pyaudio

    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=1024,
    )
    frames: list[bytes] = []
    capturing = False
    stopped_at = 0.0
    try:
        while True:
            data = stream.read(1024, exception_on_overflow=False)
            now = time.monotonic()
            if hotkey_started.is_set():
                hotkey_started.clear()
                hotkey_stopped.clear()
                frames = []
                capturing = True
                print(f"[wakeword][audio] capture-start monotonic={now:.6f}", flush=True)
            if capturing:
                frames.append(data)
                if hotkey_stopped.is_set():
                    if not stopped_at:
                        stopped_at = now
                    if now - stopped_at >= TAIL_SECONDS:
                        capturing = False
                        hotkey_stopped.clear()
                        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as sample:
                            sample_path = sample.name
                        try:
                            write_wav(sample_path, frames)
                            text = transcribe(sample_path)
                        finally:
                            Path(sample_path).unlink(missing_ok=True)
                        return text, True
    finally:
        stream.stop_stream()
        stream.close()
        audio.terminate()


async def main():
    global session_timestamp
    try:
        async with websockets.connect(BUS_URL) as ws:
            async def receive_hotkeys():
                global session_timestamp
                async for raw in ws:
                    try:
                        event = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    if event.get("type") == "voice_hotkey_down":
                        session_timestamp = event.get("timestamp")
                        print(f"[wakeword][voice] received voice_hotkey_down at {time.time():.6f}", flush=True)
                        hotkey_started.set()
                    elif event.get("type") == "voice_hotkey_up":
                        print(
                            f"[wakeword][voice] received voice_hotkey_up at {time.time():.6f} "
                            f"t0={event.get('timestamp')}",
                            flush=True,
                        )
                        hotkey_stopped.set()

            receiver = asyncio.create_task(receive_hotkeys())
            while True:
                loop = asyncio.get_running_loop()
                try:
                    result = await loop.run_in_executor(None, listen)
                except Exception as error:
                    print(f"[wakeword] capture/transcription error: {error}", flush=True)
                    await asyncio.sleep(0.2)
                    continue
                if result:
                    command, is_final = result
                    print(
                        f"[wakeword][voice] Whisper final at {time.time():.6f}: {command!r}",
                        flush=True,
                    )
                    await ws.send(json.dumps({"type": "wake", "agent": "query"}))
                    if command:
                        await ws.send(json.dumps({
                            "type": "voice_transcript" if is_final else "partial_transcript",
                            "text": command,
                        }))
            receiver.cancel()
    except (OSError, websockets.WebSocketException, ImportError) as error:
        print(f"[wakeword] listener stopped: {error}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
