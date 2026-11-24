import json
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/"v2r"))
from packets import read, encoded, sha, write_once
from scene import locate, require, TAG
from projection import bearing, overlap, object_states
from scene import field_value

ROOT=HERE.parents[2]
OUT=ROOT/"docs/reports/evidence/YJ-P04-STABILITY-01"
PROTOCOL=read(HERE/"protocol.json")
SCOPE=PROTOCOL["scope"]
STORY=read(HERE/"story.json")
def path(kind,r):
    return OUT/kind/(f"{r:02}.json")
def packet(r,prev):
    require(1<=r<=len(STORY) and (prev is None if r==1 else prev["rev"]==r-1 and prev["scope"]==SCOPE),"SEQUENCE")
    return {"scope":SCOPE,"rev":r,"tag":TAG,"instructions":PROTOCOL["instructions"],
            "prefix":STORY[:r],"previous":prev}
def audit_input(r, raw, view):
    return {"scope":SCOPE,"rev":r,"instructions":PROTOCOL["audit"],"prefix":STORY[:r],
            "candidate":raw,"accepted":view,"candidateSha256":sha(encoded(raw))}
if __name__=="__main__":
    write_once(path("packets",1),encoded(packet(1,None)))
    for folder in ("raw","audit-raw"):
        (OUT/folder).mkdir(exist_ok=True)
