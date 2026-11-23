"""Read-only verification of the published, locked evaluation and its hard failure."""
from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[3]
out = root / "docs/reports/evidence/YJ-P04-H3B2S"

def read(name):
    return json.loads((out / name).read_bytes())

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def verify(ok, message):
    if not ok:
        raise ValueError(message)

verdict = read("acceptance.json")
verify(sha(out/"freeze.json") == verdict["freezeSHA256"], "freeze checksum")
for name, expected in read("freeze.json")["files"].items():
    verify(sha(root/"packages/highlights/test/h3b2s"/name) == expected, name)
for name, expected in read("pre-fix.json")["historicalHashes"].items():
    verify(sha(out.parent/"YJ-P04-H3B2"/name) == expected, name)
for split, stories in read("proposal.json")["stories"].items():
    for story in stories:
        verify(sha(out/story["file"]) == story["sha256"], split+"/"+story["id"])
wusan = read("case-wusan.json")["rows"]
verify(not wusan[2]["current"] and len(wusan[6]["current"])==1, "public Wusan")
prefix = read("prefix-replay.json")
verify(sum(prefix["counts"].values())==1765 and not prefix["problems"] and not prefix["sends"], "prefix validation")
counter = read("post-held.json")
verify(counter["actual"]==len(counter["falseEvidence"]) and counter["actual"]>counter["expectedFacts"], "missing counterexample")
verify(verdict["status"]=="FAIL" and read("scope-audit.json")["held"]["wrongRealityIntervals"]>0, "hard gate")
print("Evidence integrity verified. H3B2S scope safety: FAIL. Reproduced false admissions:",counter["actual"])
sys.exit(1)
