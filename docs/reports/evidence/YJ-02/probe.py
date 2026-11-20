"""One-stage replay for the Codex image tool. All local commands use Python's standard library."""
import argparse
import hashlib
import json
import shutil
import struct
import uuid
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = json.loads((HERE / "fixture-v1.json").read_bytes())
PARENT = {"I0": None, "I1": "I0", "I2": "I1"}
ERRORS = ("no_service", "failed", "refused", "cancelled", "timeout", "unknown")
REUSE = {"S1": "S0", "S3A": "S2"}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


def save_new(path, value):
    with path.open("x", encoding="utf8") as out:
        json.dump(value, out, ensure_ascii=False, indent=2)
        out.write("\n")


def plan(stage, reference=None):
    args = {"prompt": FIXTURE["prompts"][stage], "transparent_background": False}
    if PARENT[stage]:
        if reference is None or not reference.is_file():
            raise ValueError("Supply the visually accepted reference PNG")
        args["referenced_image_paths"] = [str(reference.resolve())]
    elif reference is not None:
        raise ValueError("I0 has no reference")
    return args


def prepare(args):
    options = plan(args.stage, args.reference)
    attempt = args.run / str(uuid.uuid4())
    attempt.mkdir(parents=True)
    save_new(attempt / "request.json", {
        "stage": args.stage, "preparedAt": now(), "arguments": options,
        "referenceSha256": digest(args.reference) if args.reference else None,
        "fixtureSha256": digest(HERE / "fixture-v1.json")
    })
    return {"attempt": str(attempt.resolve()), "arguments": options}


def finish(args):
    request = json.loads((args.attempt / "request.json").read_bytes())
    if (args.attempt / "result.json").exists():
        raise ValueError("This attempt already has a recorded outcome")
    result = {"stage": request["stage"], "recordedAt": now(), "status": args.status}
    if args.status == "returned_image":
        if not args.image or args.image.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError("A returned original PNG is required")
        target = args.attempt / "original.png"
        with args.image.open("rb") as src, target.open("xb") as dest:
            shutil.copyfileobj(src, dest)
        result.update(file=target.name, sha256=digest(target), review="pending")
    elif args.image:
        raise ValueError("Use returned_image for a delivered image, even if visual review fails")
    result["resolution"] = {
        "timeout": "outcome_unknown_no_automatic_retry",
        "unknown": "outcome_unknown_no_automatic_retry",
        "no_service": "blocked_before_call",
    }.get(args.status, "terminal")
    save_new(args.attempt / "result.json", result)
    return result


def reuse(stage):
    accepted = json.loads((HERE / "accepted.json").read_bytes())
    assert accepted["fixture"] == FIXTURE["id"]
    asset = accepted["accepted"][REUSE[stage]]
    assert digest(HERE / asset["file"]) == asset["sha256"]
    return {"stage": stage, **asset, "modelCalls": 0}


def verify():
    evidence = json.loads((HERE.parent / "YJ-02-image-runs.json").read_bytes())
    hashes = {}
    for item in evidence["calls"]:
        stage = item["id"]
        parent = PARENT[stage]
        path = HERE.parent / item["output"]["file"]
        data = path.read_bytes()
        assert digest(path) == item["output"]["sha256"] and len(data) == item["output"]["bytes"]
        assert data[:8] == b"\x89PNG\r\n\x1a\n" and list(struct.unpack(">II", data[16:24])) == item["output"]["pixels"]
        assert item["referenceSha256"] == (hashes[parent] if parent else None)
        assert item["input"]["prompt"] == FIXTURE["prompts"][stage]
        refs = item["input"].get("referenced_image_paths", [])
        assert refs == ([f"YJ-02/{parent}.png"] if parent else [])
        hashes[stage] = digest(path)
    assert list(hashes) == ["I0", "I1", "I2"]
    for expected in evidence["reuse"]:
        row = reuse(expected["stage"])
        assert row["sha256"] == expected["sha256"] and row["file"] == Path(expected["file"]).name
    return {"files": len(hashes), "referenceEdits": 2, "reuseStages": list(REUSE), "status": "PASS"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    p = commands.add_parser("prepare")
    p.add_argument("stage", choices=PARENT)
    p.add_argument("--run", type=Path, required=True)
    p.add_argument("--reference", type=Path)
    p = commands.add_parser("finish")
    p.add_argument("attempt", type=Path)
    p.add_argument("status", choices=("returned_image", *ERRORS))
    p.add_argument("--image", type=Path)
    p = commands.add_parser("reuse")
    p.add_argument("stage", choices=REUSE)
    commands.add_parser("verify")
    args = parser.parse_args()
    if args.command == "prepare":
        result = prepare(args)
    elif args.command == "finish":
        result = finish(args)
    elif args.command == "reuse":
        result = reuse(args.stage)
    else:
        result = verify()
    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
