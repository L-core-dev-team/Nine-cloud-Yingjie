"""Overlay scoped source annotations on immutable timing/1 packets during replay."""
import copy
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import pilot

VERSION = "timing-grounding/1"
ANNOTATIONS = HERE / "annotations.json"
APPROVED_ANNOTATIONS = "6652f11549b5a41d5994fae950710d08bde3c6f66bff5a37faafebd06a020847"
OUTPUT = pilot.EV.parent / "YJ-P04-TIMING-01R"


def read_notes():
    data = ANNOTATIONS.read_bytes()
    pilot.req(pilot.sha(data) == APPROVED_ANNOTATIONS, "annotation revision requires review")
    return json.loads(data)["entries"]


def source_view(packet):
    revision = packet["revision"]
    scene = packet["sceneCandidate"]
    pilot.req((scene["scope"], scene["revision"]) == (packet["scope"], revision), "source scope")
    def span(q):
        return pilot.locate(packet, {"rev": revision, "quote": q})
    annotation = next((a for a in read_notes() if (a["scope"], a["revision"]) ==
                       (packet["scope"], revision)), None)
    original_targets = {}
    if scene["sourceType"] == "author-supplied-source-fixture":
        fixture = pilot.read(pilot.HERE / "fixture.json")[revision - 1]
        pilot.req(fixture["text"] == packet["prefix"][-1]["text"], "fixture mismatch")
        original_targets = {quote: target for target, quote in fixture["unknown"]}
    overrides = {}
    positive = []
    alignment = []
    missing = []
    if annotation:
        pilot.req(annotation["packetSha256"] == pilot.sha(pilot.enc(packet)) and
                  annotation["textSha256"] == pilot.sha(packet["prefix"][-1]["text"].encode()), "annotation binding")
        overrides = {v["quote"]: v for v in annotation["limits"]}
        pilot.req(overrides.keys() <= {v["quote"] for v in scene["limits"] if v["rev"] == revision},
                  "annotation lacks source restriction")
        positive = [{**x, "span": span(x["quote"])} for x in annotation["positive"]]
        alignment = annotation["alignment"]
        missing = annotation["unestablished"]
    restrictions = []
    for item in scene["limits"]:
        q = item["quote"]
        detail = overrides.get(q, {}) if item["rev"] == revision else {}
        if q in original_targets and detail:
            pilot.req(detail["target"] == original_targets[q], "changed original unknown target")
        restrictions.append({"span": pilot.locate(packet, item), "layer": item["layer"],
                             "target": detail.get("target", original_targets.get(q)),
                             "state": detail.get("state", "unclassified-restrictive"),
                             "basis": detail.get("basis", "original restriction; no positive exception inferred")})
    forbidden = {r["target"] for r in restrictions} | set(missing)
    pilot.req(not any(x["target"] in forbidden for x in positive), "support conflicts with unknown target")
    return {"scope": packet["scope"], "rev": revision, "packetSha256": pilot.sha(pilot.enc(packet)),
            "annotationHash": pilot.sha(pilot.enc(annotation)), "positive": positive, "alignments": alignment,
            "limitations": restrictions, "unestablished": missing,
            "nonCurrent": [{**x, "span": pilot.locate(packet, x)} for x in scene["excluded"]]}


def overlaps(a, b):
    return a["rev"] == b["rev"] and a["start"] < b["end"] and b["start"] < a["end"]


def check_focus(answer, result, view):
    focused = [e for e in result["evidence"] if e["use"] == "focus"]
    matched = set()
    for e in focused:
        hits = [r for r in view["limitations"] if overlaps(e, r["span"])]
        if not hits:
            continue
        pilot.req(all(r["target"] and r["state"] in ("observed-limit", "missing-current-evidence")
                      for r in hits), "unresolved restriction")
        targets = {s["target"] for s in view["positive"] if s["span"]["rev"] == e["rev"] and s["quote"] == e["quote"]}
        pilot.req(targets, "no scoped positive support")
        matched.update(targets)
    if matched or view["alignments"]:
        # A quote that contains a positive and a limitation only supports its annotated claim.
        # Unrecognised paraphrases cannot inherit that exception.
        claims = {c["focus"]: set(c["targets"]) for c in view["alignments"]}
        selected = set()
        cited = {s["target"] for s in view["positive"] for e in focused
                 if s["span"]["rev"] == e["rev"] and s["quote"] == e["quote"]}
        for focus in answer["focus"]:
            targets = claims.get(focus)
            pilot.req(targets and targets <= cited, "focus target not grounded")
            selected.update(targets)
        pilot.req(matched <= selected, "unused positive support")


def validate(packet, raw, view):
    # The legacy pass still enforces its schema, unique JSON keys, all source spans,
    # current-only focus, exclusions, intent and both conditional branches.
    working = copy.deepcopy(packet)
    working["sceneCandidate"]["limits"] = []
    result = pilot.validate(working, raw)
    if result["valid"]:
        try:
            pilot.req(view == source_view(packet), "wrong evidence view")
            check_focus(json.loads(raw.decode("utf-8-sig")), result, view)
        except (TypeError, KeyError, ValueError) as exc:
            result = {**result, "valid": False, "reason": str(exc)}
    return result
