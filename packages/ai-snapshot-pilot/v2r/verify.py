"""Reproduce the frozen baseline, archived conversations and regression receipts offline."""
import json
import os
from pathlib import Path
import subprocess
import sys

from packets import HERE, OLD, OUT, encoded, read, sha, write_once
from replay import replay

ROOT = HERE.parents[2]
BASE = "packages/ai-snapshot-pilot/"
env = {**os.environ, "PYTHONIOENCODING":"utf-8"}
checks = []
def check(argv, reference=None):
    proc = subprocess.run(argv,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    data = proc.stdout.decode("utf-8").replace("\r\n","\n")
    entry = {"command":argv, "exit":proc.returncode}
    if reference:
        frozen = reference.read_text("utf-8").replace("\r\n","\n")
        entry["matchesArchivedOutput"] = data.rstrip("\n")==frozen.rstrip("\n")
        entry["archivedFileSha256"] = sha(reference.read_bytes())
    else:
        entry["output"] = data
    checks.append(entry)
    return proc.returncode==0 and entry.get("matchesArchivedOutput",True)

if __name__=="__main__":
    # Each check runs even if another test fails. Do not overwrite archived dialogue inputs/outputs.
    py = ["python","-B"]
    for mode in ("legacy","new"):
        check(py+[BASE+"v2/run.py",mode],OLD/(mode+".json"))
    first = OLD.parent/"YJ-P04-AI-SNAPSHOT-01/dialogue"
    check(py+[BASE+"dialogue.py",str((first/"raw").relative_to(ROOT)).replace("\\","/")],first/"results.json")
    for name in ("v2/test_recovery.py","test_pilot.py","v2r/test_repair.py"):
        check(py+[BASE+name])
    check(["node","--permission","--allow-fs-read=*","packages/first-play/test/trigger.test.mjs"])
    result = replay()
    snapshot = (json.dumps(result,ensure_ascii=False,sort_keys=True,indent=2)+"\n").encode()
    inventory = {str(p.relative_to(OUT)).replace("\\","/"):sha(p.read_bytes())
                 for folder in ("packets","raw") for p in sorted((OUT/folder).glob("*.json"))}
    if sys.argv[1:]==["--capture"]:
        write_once(OUT/"replay.json",snapshot)
        write_once(OUT/"manifest.json",encoded(inventory))
        write_once(OUT/"checks.json",(json.dumps(checks,ensure_ascii=False,indent=2)+"\n").encode())
    else:
        assert not sys.argv[1:] and read(OUT/"manifest.json")==inventory
        assert (OUT/"replay.json").read_bytes()==snapshot
    for row in checks:
        print(row["exit"]," ".join(row["command"]),"archive comparison:",row.get("matchesArchivedOutput","n/a"))
    sys.exit(int(any(row["exit"] or not row.get("matchesArchivedOutput",True) for row in checks)))
