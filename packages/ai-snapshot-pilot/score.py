"""Frozen mechanical comparison. This module is never imported by request construction."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIELDS = ("place", "people", "count", "features", "timeOfDay", "lighting", "viewpoint", "perspective")

def expected(group, revision):
    if group == "A":
        rows = json.loads((HERE.parent / "first-play/test/scene-snapshot/gold.json").read_bytes())
        row = dict(rows[revision - 1])
        row.update(changed=[None, ["people"], []][revision - 1],
                   excluded=["past"] if revision == 3 else [], partialPeople=[])
        return row
    return json.loads((HERE / "gold.json").read_bytes())[group][revision - 1]

def norm(value):
    return sorted(value) if isinstance(value, list) else value

def compare(values, reference):
    scores = {}
    for field in FIELDS:
        got, wanted = values.get(field), reference[field]
        if norm(got) == norm(wanted):
            scores[field] = "correct-unknown" if got is None else "correct"
        elif got is None:
            scores[field] = "omitted"
        else:
            scores[field] = "invented" if wanted is None else "wrong"
    return scores

def evaluate(group, revision, proposal, projected):
    if proposal is None:
        return {"status":"NOT_RUN", "raw":None, "projected":None, "human":"HUMAN_REVIEW_NOT_RUN"}
    reference = expected(group, revision)
    raw = {}
    partial = []
    for claim in proposal["claims"]:
        field, values = claim["field"], claim["values"]
        if claim["status"] != "complete" or values is None:
            if field == "people" and claim["status"] == "partial":
                partial = values
            continue
        raw[field] = values if field in ("people","features") else (values or [None])[0]
    if isinstance(raw.get("people"), list):
        raw["count"] = len(raw["people"])
    layers = sorted({item["layer"] for item in proposal["exclusions"]})
    return {"status":"MEASURED", "raw":compare(raw, reference),
            "projected":None if projected is None else compare(projected["values"], reference),
            "projectionRejected":projected is None,
            "changesMatch":projected is not None and norm(projected["changed"]) == norm(reference["changed"]),
            "partialRosterMatch":norm(partial) == norm(reference["partialPeople"]),
            "excludedLayersMatch":layers == sorted(reference["excluded"]),
            "human":"HUMAN_REVIEW_NOT_RUN"}
