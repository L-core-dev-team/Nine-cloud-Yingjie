"""Replay captured Codex dialogue replies locally. No transport, model or ledger."""
import argparse
import hashlib
import json
from pathlib import Path

from pilot import SLOTS, project, request
from score import evaluate


def unique(pairs):
    value = dict(pairs)
    if len(value) != len(pairs):
        raise ValueError("DUPLICATE_KEY")
    return value


def packet(group, revision):
    body = json.loads(request(group, revision))
    return {"instructions": body["instructions"], "schema": body["text"]["format"]["schema"],
            "input": json.loads(body["input"])}


def render_packet(group, revision):
    return json.dumps(packet(group, revision), ensure_ascii=False, separators=(",", ":")).encode()


def measure(directory):
    frames = []
    previous = None
    for group, revision in SLOTS:
        if revision == 1:
            previous = None
        slot = group + str(revision)
        raw = (directory / (slot + ".json")).read_bytes()
        frame = {"slot": slot, "packetSha256": hashlib.sha256(render_packet(group, revision)).hexdigest(),
                 "replySha256": hashlib.sha256(raw).hexdigest(), "projected": None, "error": None, "score": None}
        try:
            answer = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=unique)
        except (UnicodeError, ValueError) as error:
            frame["error"] = str(error)
        else:
            try:
                frame["projected"] = project(group, revision, answer, previous)
            except (TypeError, KeyError, ValueError) as error:
                frame["error"] = str(error)
            try:
                frame["score"] = evaluate(group, revision, answer, frame["projected"])
            except (TypeError, KeyError, IndexError) as error:
                frame["scoreError"] = type(error).__name__
        previous = frame["projected"]
        frames.append(frame)
    return {"source": "Codex independent model dialogues", "lunaAPI": "LIVE_BLOCKED",
            "apiPost": 0, "apiModelGet": 0, "imageCalls": 0, "frames": frames}


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("reply_directory", type=Path)
    args = cli.parse_args()
    print(json.dumps(measure(args.reply_directory), indent=2, ensure_ascii=True))
