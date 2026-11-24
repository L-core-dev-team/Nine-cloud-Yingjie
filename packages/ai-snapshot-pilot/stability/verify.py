"""Offline replay and byte-level receipt verification; --capture is write-once."""
import subprocess
from evaluate import *
from pathlib import Path

def main(capture):
    receipts=[]
    def run(args,json_result=False):
        result=subprocess.run(args,cwd=ROOT,capture_output=True)
        out=result.stdout.decode("utf-8",errors="replace").strip()
        receipts.append({"command":args,"exit":result.returncode,
                         "stdout":"JSON stored separately" if json_result else out,
                         "stderr":result.stderr.decode("utf-8",errors="replace")})
        require(result.returncode==0,repr(receipts[-1]))
        return json.loads(out) if json_result else out
    def verify_file(name,value):
        data=encoded(value)
        if capture: write_once(OUT/name,data)
        else: require((OUT/name).read_bytes()==data,"EVIDENCE_CHANGED:"+name)
    rows=evaluate()
    verify_file("evaluation.json",rows)
    js=run(["node","--permission","--allow-fs-read=*","packages/ai-snapshot-pilot/stability/policies.mjs"],True)
    verify_file("policy-results.json",js)
    recovered=run(["python","-B","packages/ai-snapshot-pilot/stability/restart.py"],True)
    verify_file("restart.json",recovered)
    run(["python","-B","packages/ai-snapshot-pilot/v2r/verify.py"])
    for r in range(1,15):
        assert rows["rows"][r-1]["send"] is False and js[r-1]["send"] is False
    assert rows["rows"][1]["guardedReplayDifferences"]=={"水簿":None,"铜盆":None}
    assert rows["rows"][10]["guardedReplayDifferences"]=={}
    states=[read(path("states",r)) for r in range(1,15)]
    def objid(revision,name):
        return next(o["id"] for o in states[revision-1]["objects"] if o["name"]==name)
    assert objid(1,"铜盆")==objid(10,"铜盆")!=objid(6,"铜盆")
    assert states[4]["values"]["people"]==["蒋绫"] and states[4]["values"]["count"] is None
    assert states[6]["values"]["people"] is None and not states[6]["objects"]
    assert states[9]["values"]["count"]==0 and states[9]["values"]["people"]==[]
    assert len(recovered["prefixes"])==14
    inventory={p.relative_to(OUT).as_posix():sha(p.read_bytes()) for kind in
               ("packets","raw","states","audit-packets","audit-raw") for p in sorted((OUT/kind).glob("*.json"))}
    require(len(inventory)==50,"COUNT")
    verify_file("manifest.json",inventory)
    if capture: write_once(OUT/"commands.json",encoded(receipts))
    print(json.dumps({"prefixes":14,"reviews":4,"hashes":len(inventory),"counts":rows["counts"],"commandExits":[r["exit"] for r in receipts]}))
if __name__=="__main__":
    assert sys.argv[1:] in ([],["--capture"])
    main(bool(sys.argv[1:]))
