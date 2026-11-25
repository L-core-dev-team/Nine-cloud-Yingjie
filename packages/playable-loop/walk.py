"""Operator for the single formal walk. Model conversations are separate, manual CODEX_RELAY slots."""
import hashlib,json,os,sqlite3,subprocess,sys,time
from pathlib import Path
from session import BASE,HERE
root=HERE.parents[1]
ev=root/"docs/reports/evidence/YJ-P05-PLAYABLE-LOOP-01"
inbox=root.parent/"p05-inbox"
def put(path,b):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("xb") as f:f.write(b)
def run(argv):
    # On Windows a detached pg_ctl descendant may retain a pipe handle after
    # the launcher exits. Regular files let the parent wait for the command itself.
    tag=str(time.time_ns())
    stdout=BASE/"demo"/("operator-"+tag+".out")
    stderr=BASE/"demo"/("operator-"+tag+".err")
    with stdout.open("xb") as out, stderr.open("xb") as err:
        p=subprocess.run(argv,cwd=root,stdout=out,stderr=err)
    # Only the synthetic browser observations and relay result are captured.
    log={"command":[str(a).replace(str(BASE),"<private>") for a in argv],"exit":p.returncode,
         "stdout":stdout.read_bytes().decode("utf8",errors="replace").strip(),"stderr":stderr.read_bytes().decode("utf8",errors="replace").strip()}
    with (ev/"walk-commands.jsonl").open("a",encoding="utf8") as f:f.write(json.dumps(log,ensure_ascii=False)+"\n")
    if p.returncode:raise RuntimeError("formal step failed: "+str(argv[1])+" / "+str(p.returncode))
    return log
def snapshot(name,rev):
    db=sqlite3.connect((BASE/"demo/sidecar.sqlite").as_uri()+"?mode=ro",uri=True)
    with db:
        h=[json.loads(x[0]) for x in db.execute("select record from action where record is not null order by expected")]
        slots=[[r,k,s,hashlib.sha256(p.encode()).hexdigest(),hashlib.sha256(b).hexdigest() if b else None] for r,k,s,p,b in db.execute("select rev,kind,status,packet,raw from slot order by rev,kind")]
    db.close()
    assert h[-1]["revision"]==rev
    snap={"history":h,"slots":slots};dest=ev/(name+".json")
    if dest.exists():assert json.loads(dest.read_bytes())==snap
    else:put(dest,json.dumps(snap,ensure_ascii=False).encode())
    return snap
def restart(tag,rev):
    a=snapshot(tag+"-before",rev)
    for verb in ("stop","resume"):run([sys.executable,"-B","packages/playable-loop/session.py",verb,"demo"])
    run(["node","packages/playable-loop/browser-check.mjs","demo","check","0","0"])
    assert a==snapshot(tag+"-after",rev)
def main():
    ev.mkdir(parents=True,exist_ok=True)
    for r in range(1,9):
        if r==1 and sys.argv[1:]==["--recover-observed-r1"]:
            run(["node","packages/playable-loop/browser-check.mjs","demo","check","0","0"])
            assert json.loads((ev/"prepared-restart-before.json").read_bytes())==snapshot("prepared-restart-after",1)
        else:
            run(["node","packages/playable-loop/browser-check.mjs","demo","walk",str(r),str(r)]+([str(ev/"screens")] if r in (3,4,8) else []))
            if r==1:restart("prepared-restart",1)
        for kind in ("state","timing"):
            label=kind+f"{r:02}";packet=inbox/label/"input.json";raw=inbox/label/"first.json"
            packet.parent.mkdir(parents=True,exist_ok=True)
            run(["node","packages/playable-loop/relay.mjs",str(BASE/"demo"),"reserve",str(r),kind,str(packet)])
            put(ev/"packets"/(label+".json"),packet.read_bytes())
            print("READY",label,flush=True)
            deadline=time.monotonic()+2400
            while not raw.exists() and time.monotonic()<deadline:time.sleep(.35)
            if not raw.exists():raise RuntimeError("reserved slot awaiting reconciliation")
            run(["node","packages/playable-loop/relay.mjs",str(BASE/"demo"),"import",str(r),kind,str(raw)])
            put(ev/"raw"/(label+".json"),raw.read_bytes())
        if r==4:restart("reward-restart",4)
    snapshot("final",8)
    run(["node","packages/playable-loop/browser-check.mjs","demo","check","0","0",str(ev/"screens")])
    print("DONE",flush=True)
if __name__=="__main__":main()
