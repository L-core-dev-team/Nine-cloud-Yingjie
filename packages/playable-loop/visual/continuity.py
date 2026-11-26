"""Inspect the existing visual reader without submitting actions. Keep the cold copy local."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import sqlite3
import sys
from datetime import datetime
from urllib.request import Request, build_opener, ProxyHandler

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from session import BASE, private
instance = BASE / "visual-reader"
assert (instance / "p05-owned").read_text() == "P05/1:visual-reader"
evidence = Path(__file__).resolve().parents[3] / "docs/reports/evidence/YJ-P05-VISUAL-REPAIR-01"
def sha(data):
    return hashlib.sha256(data).hexdigest()
def digest(value):
    return sha(json.dumps(value, ensure_ascii=False, sort_keys=True).encode())
def snapshot():
    with sqlite3.connect((instance / "sidecar.sqlite").as_uri()+"?mode=ro", uri=True) as db:
        assert not db.execute("select count(*) from action where record is null").fetchone()[0]
        kv=dict(db.execute("select k,v from kv"))
        rows=[json.loads(s) for s, in db.execute("select record from action order by expected")]
    cfg=json.loads((instance/"private.json").read_bytes())
    base="http://127.0.0.1:"+str(cfg["httpPort"])
    opener=build_opener(ProxyHandler({}))
    def fetch(path):
        return opener.open(Request(base+path,headers={"Cookie":"p05="+kv["session"]}),timeout=10).read()
    game=json.loads(fetch("/game"))
    assert rows==game["history"] and game["current"]["revision"]==len(rows)
    data=dict(scope=game["scope"],revision=len(rows),originalRows=digest(rows),
              reward=game["current"]["quest"],imagesEnabled=game["visual"]["enabled"],
              bindings=digest(sorted((k,v) for k,v in kv.items() if k.startswith("picture:"))),
              shown=digest(sorted((k,v) for k,v in kv.items() if k.startswith(("shown:","failed:")))),
              nextChoices=len(game["current"]["actions"]))
    return dict(state=data,health=fetch("/health").decode(),hostActive=(instance/"active").exists(),pgActive=(instance/"pgdata/postmaster.pid").exists())
def tree(root):
    result={}
    for p in root.rglob("*"):
        if p.is_symlink() or p.is_junction(): raise ValueError("unexpected linked path")
        if p.is_file():
            with p.open("rb") as f: result[str(p.relative_to(root))]=hashlib.file_digest(f,"sha256").hexdigest()
    return result
mode=sys.argv[1]
if mode=="backup":
    assert not (instance/"active").exists() and not (instance/"pgdata/postmaster.pid").exists()
    root=BASE/("visual-reader-backup-"+datetime.now().strftime("%Y%m%d-%H%M%S"))
    root.mkdir(exist_ok=False);private(root)
    shutil.copytree(instance,root/"visual-reader")
    a=tree(instance);assert a==tree(root/"visual-reader")
    result=dict(backupFolder=root.name,files=len(a),allBytesVerified=True,cold=True)
elif mode in ("before","after"):
    result=snapshot()
    if mode=="after":
        before=json.loads((evidence/"personal-before.json").read_bytes())
        assert result["state"]==before["state"] and result["health"]=="P05-visual/2"
else: raise ValueError("mode")
target=evidence/("personal-"+mode+".json")
with target.open("x",encoding="utf8") as f:json.dump(result,f,ensure_ascii=False,indent=2)
print(json.dumps(result,ensure_ascii=True))
