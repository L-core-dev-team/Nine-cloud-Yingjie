"""Offline acceptance; use --capture once to archive deterministic replay receipts."""
from collections import Counter
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from checks import run as check_targets
from journal import RepairJournal
from replay import repair
from source import HERE, OUT, ORIGINAL, SCOPE, STORY, encoded, path, read, require, sha
from inputs import write_once

def run_process(args):
    proc=subprocess.run(args,capture_output=True)
    require(proc.returncode==0,proc.stderr.decode(errors="replace"))
    return {"exit":proc.returncode,"stdout":proc.stdout.decode().strip()}

def restart(root):
    runs=[]
    def run(name,lo,hi):
        args=[sys.executable,"-B",str(HERE/"journal.py"),str(root/name),str(lo),str(hi)]
        runs.append({"command":["python","-B","journal.py",name,lo,hi],**run_process(args)})
    run("one.sqlite",1,14)
    run("two.sqlite",1,7)
    db=RepairJournal(root/"two.sqlite")
    early=db.repaired()
    db.close()
    run("two.sqlite",8,14)
    db=RepairJournal(root/"two.sqlite");other=RepairJournal(root/"one.sqlite")
    try:
        rows=db.repaired()
        assert rows==other.repaired() and early==rows[:7] and len(rows)==14
        originals=db.rows()
        db.ingest(1,14)
        assert db.repaired()==rows and originals==db.rows()
        def reject(label,fn,store):
            before=store.repaired()
            try: fn()
            except ValueError as exc:
                assert before==store.repaired()
                return [label,str(exc)]
            raise AssertionError(label)
        pkt=path("packets",1).read_bytes();raw=path("raw",1).read_bytes()
        rejected=[reject("conflicting-key",lambda:db.apply(SCOPE,1,pkt,raw+b" "),db),
                  reject("foreign-scope",lambda:db.apply("foreign",1,pkt,raw),db)]
        fresh=RepairJournal(root/"empty.sqlite")
        try:
            rejected.append(reject("gap",lambda:fresh.apply(SCOPE,2,path("packets",2).read_bytes(),path("raw",2).read_bytes()),fresh))
            future=read(path("packets",1));future["prefix"].append(STORY[1])
            rejected.append(reject("future-prefix",lambda:fresh.apply(SCOPE,1,encoded(future),raw),fresh))
            forged=read(path("raw",1));forged["fields"]["place"][2]=[STORY[13]["text"]]
            rejected.append(reject("future-quote",lambda:fresh.apply(SCOPE,1,pkt,encoded(forged)),fresh))
            assert repair(1,forged)["placeId"] is None
            # A process may stop after persisting an original but before its derivation.
            fresh.append(SCOPE,1,pkt,raw)
            assert not fresh.repaired()
            fresh.ingest(1,1)
            assert fresh.repaired()==rows[:1]
        finally: fresh.close()
        return {r:json.loads(data) for r,data,_ in rows},{"processes":runs,"prefixes":[
            {"rev":r,"stateSha256":sha(data),"chainSha256":digest} for r,data,digest in rows],
            "equal":len(rows),"oldPrefixUnchanged":len(early),"duplicateRowsAdded":0,
            "interruptedDerivationRecovered":True,"rejections":rejected}
    finally: db.close();other.close()

def main(capture):
    from runpy import run_path
    classify=run_path(str(HERE.parent/"stability/score.py"))["classify"]
    golden=read(HERE.parent/"stability/gold.json")
    original=read(ORIGINAL/"evaluation.json")
    policy=read(ORIGINAL/"policy-results.json")
    with tempfile.TemporaryDirectory() as directory:
        states,restart_receipt=restart(Path(directory))
    checked=check_targets(states)
    timing=[]; counts=Counter()
    for r,v in states.items():
        scores={f:classify(value,golden[r-1][f]) for f,value in v["values"].items()}
        counts.update(scores.values())
        assert all(scores[f].startswith("correct") for f in ("place","count","people"))
        row={k:value for k,value in v.items() if k not in ("continuation","currentAttributes","history")}
        row["historicalLastConfirmed"]=v["history"]
        row["previousExperimentPolicy"]=policy[r-1]
        row["authorTimingBaseline"]=original["rows"][r-1]["authorBaseline"]
        row["fixedBasicFieldScores"]=scores
        timing.append(row)
    original_checks=run_process([sys.executable,"-B",str(HERE.parent/"stability/verify.py")])
    assert all(v["send"] is False and v["sceneEligible"] is False for v in timing)
    metadata={"status":"STABILITY_REPAIR_REPLAY_PASS","oldStatus":"FAIL","oldRestart":"PASS",
        "newDialogues":0,"independentReviewsOfRepairedOutput":0,"oldFirstReplies":14,"oldAudits":4,
        "oldAuditsBoundToOldCandidates":{r["rev"]:r["audit"]["status"] for r in original["rows"] if r["audit"]["status"]!="not-independently-reviewed"},
        "oldManifestSha256":sha((ORIGINAL/"manifest.json").read_bytes()),"oldLiteral":original["counts"],
        "repairedBasicFields":dict(counts),"repairedTargetChecks":checked,
        "compatibility":{"command":"python -B packages/ai-snapshot-pilot/stability/verify.py",**original_checks},
        "paidAPI":0,"images":0,"simulatedDispatch":0,"extraUsd":0}
    for name,data in [("timing-input.jsonl",b"".join(encoded(row)+b"\n" for row in timing)),
                      ("restart.json",encoded(restart_receipt)),("verification.json",encoded(metadata))]:
        if capture: write_once(OUT/name,data)
        else: require((OUT/name).read_bytes()==data,"REPLAY_MISMATCH:"+name)
    print(json.dumps({"status":metadata["status"],"prefixes":len(states),"targetGroups":len(checked["targetGroups"]),
        "basicFields":dict(counts),"finalChain":restart_receipt["prefixes"][-1]["chainSha256"]}))
if __name__=="__main__":
    assert sys.argv[1:] in ([],["--capture"])
    main(bool(sys.argv[1:]))
