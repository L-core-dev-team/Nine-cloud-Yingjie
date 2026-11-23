"""Offline H3-A acceptance. Historical H2R failures remain expected red controls."""
from concurrent.futures import ThreadPoolExecutor
from importlib.util import module_from_spec, spec_from_file_location
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[3]
out = root / "docs/reports/evidence/YJ-P04-H3A"
history = root / "docs/reports/evidence"
def encode(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"))+"\n").encode()
def save(name,value):
    (out/(name+".json")).write_bytes(encode(value))
def node(path,*args):
    result=subprocess.run(["node","--permission","--allow-fs-read=*",path,*args],cwd=root,stdout=subprocess.PIPE,check=False)
    data=json.loads(result.stdout)
    if result.returncode:
        save(Path(path).stem+"-failed", data)
        result.check_returncode()
    return data

def gate_c():
    targeted=node("packages/highlights/h3a/targeted.mjs")
    public=node("packages/highlights/h3a/public-replay.mjs")
    guards=node("packages/highlights/h3a/guards.mjs")
    save("guards",guards)
    # Complete traces in bounded shards. Each has a dictionary of verified
    # source spans plus per-revision changes to the ledger and the active ranks.
    catalog=[]
    for i in range(0,len(targeted["all"]),2):
        items=targeted["all"][i:i+2]
        name=f"trace-{i//2+1:02}"
        save(name,items)
        for item in items:
            catalog.append({k:item[k] for k in ["id","expected","baseline","got","reg","issues"]}|{"file":name+".json"})
    save("causal-audit",dict(cases=catalog,failures=targeted["failures"],historicalCases=12,newCases=52,
                             verifiedSpanVisits=targeted["spans"]))
    for k,rows in public["outputs"].items():save("public-"+k,rows)
    save("prefix-replay",dict(targeted=targeted["prefixes"],public=public["prefixes"],groups=public["receipts"],
                              checks=["complete round including ranks and ledger diff","candidate IDs and evidence","causal edges by learnedAt"]))
    save("failures",dict(historicalRed="pre-fix.json",firstGuardRun="guards-first.json",identityReview="identity-review.json",firstPublicRun="public-first.json",
                         finalTargeted=targeted["failures"],finalGuards=[t for t in guards["tests"] if not t["pass"]],
                         currentPublicErrors=public["sourceErrors"],currentPublicRankingOrDetectionDifferences=public["changes"]))

def gate_d():
    # Import the recorded compatibility runner, redirecting all result paths to a
    # fresh temp directory. Its historical acceptance files are read-only inputs.
    spec=spec_from_file_location("historical",root/"packages/highlights/h2r/regression.py")
    runner=module_from_spec(spec)
    spec.loader.exec_module(runner)
    old=json.loads((history/"YJ-P04-H2/regression.json").read_bytes())
    commands={k:v["cmd"] for k,v in old.items()}
    prefix="node --permission --allow-fs-read=* packages/highlights/"
    commands.update(h2=prefix+"v2/measure.mjs",h2rGuards=prefix+"h2r/guards.mjs",
                    causalAudit=prefix+"h2r/causal-audit.mjs")
    with tempfile.TemporaryDirectory() as tmp:
        runner.out=Path(tmp)
        with ThreadPoolExecutor(max_workers=4) as pool:
            jobs=[pool.submit(runner.run,k,cmd,tmp) for k,cmd in commands.items()]
            results=dict(j.result() for j in jobs)
    for k,r in results.items():
        if "receipt" in r:
            save("compat-"+k,r.pop("receipt"))
            r["receiptFile"]="compat-"+k+".json"
        if k=="h2rGuards":
            r["passed"]=sum(t["pass"] for t in r["summary"]["tests"])
            del r["summary"]
    previous=json.loads((history/"YJ-P04-H2R/measurement.json").read_bytes())
    for part in ("dev","held"):
        value=node("packages/highlights/h2r/evaluate.mjs",part)
        results["h2r-"+part]={"command":prefix+"h2r/evaluate.mjs "+part,"exit":0,"publicRegression":True,
                              "identicalAllMethodMetrics":value["groups"]==previous[part]["groups"]}
    baseline=json.loads((out/"pre-fix.json").read_bytes())
    results["historicalHashes"]={p:hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in baseline["oldFiles"].items()}
    failed=[k for k in commands if k!="causalAudit" and results[k]["exit"]!=0]
    expected=results["causalAudit"]["exit"]==1 and results["causalAudit"]["failures"]==baseline["replay"]["failed"]
    results["acceptance"]={"newCompatibilityFailures":failed,"preservedOriginalFailures":expected}
    save("regression",results)
    assert not failed and expected and all(results["historicalHashes"].values())
    assert all(results["h2r-"+part]["identicalAllMethodMetrics"] for part in ("dev","held"))
    save("benchmark",node("packages/highlights/h3a/benchmark.mjs"))

if __name__=="__main__":
    gate_c()
    gate_d()
    print("H3A offline acceptance completed; the archived H2R red control remains 10/12.")
