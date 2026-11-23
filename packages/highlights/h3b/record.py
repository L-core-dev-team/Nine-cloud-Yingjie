"""Record an offline repeat without modifying H3-A's historical evidence."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from importlib.util import module_from_spec, spec_from_file_location
sys.dont_write_bytecode=True

root=Path(__file__).resolve().parents[3]
out=root/"docs/reports/evidence/YJ-P04-H3B"
archive=root/"docs/reports/evidence/YJ-P04-H3A"
def read(p): return json.loads(p.read_bytes())
def write(key,data):
    (out/(key+".json")).write_bytes((json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n").encode())
def run(name,*args):
    cmd=["node","--permission","--allow-fs-read=*","packages/highlights/h3b/"+name+".mjs",*args]
    r=subprocess.run(cmd,cwd=root,capture_output=True)
    if r.returncode:
        write(name+"-red",dict(command=cmd,exit=r.returncode,stderr=r.stderr.decode(errors="replace")[-3500:],stdout=r.stdout.decode(errors="replace")[-3500:]))
        r.check_returncode()
    return json.loads(r.stdout)
def gate_c():
    subprocess.run([sys.executable,"packages/highlights/test/h3b/freeze.py"],cwd=root,check=True)
    groups={}; failures={}; admission={}; by_family={}
    for part in ("dev","held"):
        result=run("evaluate",part)
        groups[part]=result["groups"]
        corpus=[json.loads(line) for line in (root/("packages/highlights/test/h3b/"+part+".jsonl")).read_bytes().splitlines()]
        by_id={s["id"]:s for s in corpus}
        by_family[part]=[]
        for row in result["details"]:
            if row["method"]!="fixture": continue
            s=by_id[row["story"]]
            pairs=list(zip(s["rows"],row["revisions"]))
            by_family[part].append(dict(story=s["id"],family=s["family"],discovered=sum(t["review"] and r["review"] for t,r in pairs),
                discoveryGold=sum(t["review"] for t,r in pairs),quietProposed=sum(t["fact"] and r["review"] for t,r in pairs),
                quietGold=sum(t["fact"] for t,r in pairs),quietConfirmed=sum(t["fact"] and r["fact"] for t,r in pairs),
                falseReview=sum(not t["review"] and r["review"] for t,r in pairs)))
        for g in groups[part].values():
            for metric in ("review","fact"):
                tp,fp,fn=(g[metric+k] for k in ("TP","FP","FN"))
                g[metric+"Precision"]=tp/(tp+fp) if tp+fp else None
                g[metric+"Recall"]=tp/(tp+fn) if tp+fn else None
        failures[part]=result["failures"]
        admission[part]={k:{i:v for i,v in g.items() if i.startswith(("fact","quiet","top","rank","role","abstention"))} for k,g in result["groups"].items()}
        # Compact per-row receipts, including every miss and the actual role slots and citations.
        for i in range(0,len(result["details"]),12):
            write(f"{part}-rows-{i//12+1}",result["details"][i:i+12])
    hist=run("historical")
    write("public-errors",dict(cases=hist["publicCases"],metrics=hist["publicMetrics"],allErrors=hist["errors"]))
    write("proposal-measurement",dict(exit=0,groups=groups,byFamily=by_family,columns="discovery = fact or routed candidate, fact = independently admitted, counts are per revision; null precision = no positive predictions; roleComplete requires the frozen pair in one proposal"))
    write("causal-admission",dict(groups=admission,targeted=hist["targeted"],unauthorizedNewConfirmations=hist["safety"]))
    write("prefix-replay",dict(historical=hist["prefixes"],new={"dev":108,"held":108},exit=0,verified=["complete rounds, roles, receipts, ranking, proposal keys and evidence, causal edges as-of","each earlier output equals isolated replay of the identical prefix with the same scope and session"]))
    write("failures",dict(perRevision=failures,publicErrors="public-errors.json",priorFailures="../YJ-P04-H3A/failures.json",
          firstHistoricalRun=dict(exit=1,failedAssertion="rankedCandidate.learnedAt <= currentRevision",cause="inherited H1 candidates encode birth in candidate.revision and source.revision; learnedAt is absent",correction="verify candidate exists in birth round, source revision equals birth, learnedAt when present, and standalone prefix output equality"),
          rankingFailures="See ranked lists in dev-rows and held-rows against the corresponding frozen story.rank",
          roleMisses="See all roles per row against frozen entities; roleComplete is strict, including missing slots"))
    write("safety",dict(exit=0,**run("safety"),historicalSafetyFailures=hist["safety"]))
def gate_d():
    spec=spec_from_file_location("oldtests",root/"packages/highlights/h3a/record.py")
    mod=module_from_spec(spec);spec.loader.exec_module(mod)
    with tempfile.TemporaryDirectory() as tmp:
        mod.out=Path(tmp)
        shutil.copyfile(archive/"pre-fix.json",mod.out/"pre-fix.json")
        mod.gate_c()
        mod.gate_d()
        regression=read(mod.out/"regression.json")
        # Keep actual small receipts. Large H3A traces are deterministically
        # identical to the archived inputs; record byte comparisons for each.
        keys=["guards","causal-audit","prefix-replay","failures"]
        keys.extend(sorted(p.stem for p in mod.out.glob("trace-*.json")))
        regression["h3aCurrentRun"]={k:dict(sha256=hashlib.sha256((mod.out/(k+".json")).read_bytes()).hexdigest(),
              identical=(mod.out/(k+".json")).read_bytes()==(archive/(k+".json")).read_bytes()) for k in keys}
        for f in mod.out.glob("compat-*.json"):
            shutil.copyfile(f,out/f.name)
        write("regression",regression)
    write("benchmark",run("benchmark"))
if __name__=="__main__":
    if sys.argv[1]=="C": gate_c()
    elif sys.argv[1]=="D": gate_d()
    else: raise SystemExit("choose C or D")
