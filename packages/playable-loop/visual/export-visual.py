"""Export only display/binding rows from the dedicated formal save (read-only)."""
import json
import os
import sqlite3
from pathlib import Path
base = Path(os.environ["LOCALAPPDATA"]) / "NineCloud-P05" / "visual-demo"
evidence = Path(__file__).resolve().parents[3] / "docs/reports/evidence/YJ-P05-VISUAL-LOOP-01"
with sqlite3.connect((base / "sidecar.sqlite").as_uri() + "?mode=ro", uri=True) as db:
    def values(prefix):
        return [json.loads(v) for (v,) in db.execute("SELECT v FROM kv WHERE k LIKE ? ORDER BY k", (prefix + ":%",))]
    rows = values("picture")
    assert len(rows) == 8
    presentations = values("shown") + values("failed")
    current = {x["revision"]:x["state"] for x in presentations if x["mode"]=="current" and x["state"]!="load-failed"}
    assert current == {1:"first-display",3:"first-display",4:"retained",5:"first-display",8:"reused"}, current
    assert any(x["revision"]==5 and x["state"]=="load-failed" for x in presentations)
    assert {x["revision"] for x in presentations if x["mode"]=="history"} == {1,3,4,5,8}
    assert rows[4]["scope"] == rows[7]["scope"] and rows[4]["sha"] == rows[7]["sha"]
    assert not db.execute("SELECT count(*) FROM slot").fetchone()[0]
    out = dict(bindings=rows, presentations=sorted(presentations,key=lambda x:x["at"]), researchSlots=0)
(evidence / "presentations.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("verified",len(rows),"bindings and",len(presentations),"distinct presentations/outcomes")
