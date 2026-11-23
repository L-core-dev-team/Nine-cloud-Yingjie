"""Read-only legacy replay. All newly written artifacts go to a separate evidence directory."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tempfile
import time

root=Path(__file__).resolve().parents[3]
out=Path(sys.argv[1]).resolve()
out.mkdir(parents=True,exist_ok=True)
def save(name,value):
    (out/name).write_bytes((json.dumps(value,ensure_ascii=False,separators=(",",":"))+"\n").encode())
def run(args,expected,record):
    start=time.perf_counter()
    result=subprocess.run(args,cwd=root,capture_output=True)
    commands.append(dict(command=[("python" if i==0 and v==sys.executable else v) for i,v in enumerate(args)],
                         exit=result.returncode,expected=expected,elapsedMs=round((time.perf_counter()-start)*1000,1),
                         stdoutSHA256=hashlib.sha256(result.stdout).hexdigest()))
    if result.returncode!=expected:problems.append(dict(cmd=args,stderr=result.stderr.decode(errors="replace")[-600:]))
    if record=="text":return result.stdout.decode().strip()
    if record=="json":return json.loads(result.stdout)
def read(p):return json.loads(p.read_bytes())
commands=[];problems=[]
node=["node","--permission","--allow-fs-read=*"]
with tempfile.TemporaryDirectory() as tmp:
    run([sys.executable,"-B","packages/highlights/h3b2s/compat.py",tmp],0,None)
    commands[-1]["command"][-1]="<temporary-output>"
    directory=Path(tmp);compat=read(directory/"regression.json")
    save("compatibility.json",compat)
    for path in directory.glob("compat-*.json"):(out/path.name).write_bytes(path.read_bytes())

prefix=run(node+["packages/highlights/h3b2s/prefix.mjs"],0,"json")
safety=run(node+["packages/highlights/h3b2s/safety.mjs"],0,"json")
public=run(node+["packages/highlights/h3b2/measure.mjs","--split=reserve"],0,"json")
diag=run(node+["packages/highlights/h3b2s/diagnostic.mjs"],1,"json")
message=run([sys.executable,"-B","packages/highlights/h3b2s/verify.py"],1,"text")
counts=sum(prefix["counts"].values())
if (counts!=1765 or prefix["problems"] or prefix["changed"] or prefix["sends"] or
        any(not t["pass"] for t in safety["checks"]) or diag["actual"]!=1 or public["totals"]["local"]["fact"]!=[6,1,1] or
        len(prefix["targeted"])!=64 or not all(t["sameRanks"] for t in prefix["targeted"]) or
        compat["historicalH3B2Gate"]["exit"]!=1 or not compat["historicalH3B2Gate"]["identical"] or
        compat["acceptance"]["newCompatibilityFailures"] or compat["changedHistoricalFiles"] or
        not all(t["pass"] for t in compat["h3b2Safety"]["tests"]) or not compat["acceptance"]["preservedOriginalFailures"]):
    problems.append("changed historical result")
old_hashes={}
for name in ["YJ-P04-H3B2","YJ-P04-H3B2S"]:
    folder=root/"docs/reports/evidence"/name
    h=hashlib.sha256();n=0
    for p in sorted(folder.rglob("*.json")):
        rel=p.relative_to(root).as_posix()
        pinned=subprocess.check_output(["git","show","4d443d3ea95479afb291637c04898475ceea6663:"+rel],cwd=root)
        if p.read_bytes().replace(b"\r\n",b"\n")!=pinned:problems.append(rel)
        h.update(rel.encode()+b"\0"+hashlib.sha256(pinned).digest());n+=1
    old_hashes[name]=dict(files=n,orderedSHA256=h.hexdigest())
save("legacy-regression.json",dict(commands=commands,prefix=prefix,scopeControls=safety["checks"],oldReserve=public["totals"]["local"]["fact"],
    wusanOldAndScoped=safety["totals"],scopeCounterexample=diag["actual"],integrityExitMessage=message,
    historicalEvidence=old_hashes,problems=problems))
print("old prefixes",counts,"scope controls",len(safety["checks"]),"old exits 1/1 retained","unexpected",len(problems))
sys.exit(bool(problems))
