#!/usr/bin/env python3
"""Train and evaluate the local kev voice router checkpoint.

The command delegates model-specific details to the vendored kev CLI while
keeping the dataset and output location stable for Electron.
"""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / "voice_training_examples.jsonl"
OUT = ROOT / "runs" / "kev-router"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=OUT)
    parser.add_argument("--smoke", action="store_true")
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    command = ["uv", "run", "python", "-m", "kev.train", "--out", str(args.out)]
    if args.smoke:
        command += ["--n_per_source", "40", "--accum", "4"]
    else:
        command += ["--epochs", "2"]
    command += ["--data", str(DATA)]
    subprocess.run(command, cwd=ROOT / "kev", check=True)
    evaluate = ["uv", "run", "python", "-m", "kev.evaluate", "--run", str(args.out), "--data", str(DATA)]
    result = subprocess.run(evaluate, cwd=ROOT / "kev", check=True, capture_output=True, text=True)
    metrics = {"raw_output": result.stdout}
    (args.out / "voice_router_metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(result.stdout)


if __name__ == "__main__":
    main()
