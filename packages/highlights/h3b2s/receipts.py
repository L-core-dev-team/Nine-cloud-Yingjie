"""Summarize saved one-pass measurements. Does not replay or change any label."""
from pathlib import Path
from collections import Counter
from statistics import median
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[3]
scratch = Path(sys.argv[1]).resolve()
out = root / "docs/reports/evidence/YJ-P04-H3B2S"
fixtures = root / "packages/highlights/test/h3b2s"

def raw(name):
    return json.loads((scratch / ("h3b2s-" + name + ".json")).read_text(encoding="utf-8-sig"))

def save(name, data):
    (out / (name + ".json")).write_bytes((json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode())

def ratio(a, b):
    return a / b if b else None

def rates(triple):
    tp, fp, fn = triple
    return dict(precision=ratio(tp,tp+fp),recall=ratio(tp,tp+fn))

def accumulate(result, k, val):
    if isinstance(val,list):
        dst=result.setdefault(k, [0]*len(val))
        for i,n in enumerate(val):dst[i]+=n
    else:result[k]=result.get(k,0)+val

def hashfile(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

freeze=json.loads((out/"freeze.json").read_bytes())
assert all(hashfile(fixtures/name)==sha for name,sha in freeze["files"].items())
scope_stats={}; arms={}; failures={}; index={}
for part in ["dev","held"]:
    stories=raw(part)
    gold={g["id"]:g for f in sorted(fixtures.glob(part+"-*.jsonl")) for g in map(json.loads,f.read_text(encoding="utf8").splitlines())}
    assert set(gold)=={s["id"] for s in stories}
    matrix=Counter();oldmatrix=Counter();bound={};reasons=Counter()
    unknown=total=leaks=0
    by_arm={}; errors=[]; index[part]=[]
    for serial,s in enumerate(stories,1):
        story=s["id"]; g=gold[story]; file=f"{part}-{serial:02d}"
        save(file,s)
        index[part].append(dict(id=story,file=file+".json",sha256=hashfile(out/(file+".json"))))
        for name,vals in s["arms"].items():
            agg=by_arm.setdefault(name,{})
            for k,v in vals.items():
                if k not in ("failures","rank"):accumulate(agg,k,v)
            for err in vals["failures"]:
                errors.append(dict(story=story,arm=name,type=err["type"],revision=err["r"],trace=file+".json"))
            want=g["rows"][-1]["rank"]
            if vals["rank"]!=want:
                errors.append(dict(story=story,arm=name,type="ranking",expected=want,actual=vals["rank"],trace=file+".json"))
        matrix.update(s["scope"]["matrix"])
        for k,v in s["scope"]["boundaries"].items():accumulate(bound,k,v)
        for a in s["scope"]["bad"]:
            errors.append(dict(story=story,arm="h3b2s",type="scope",revision=a["r"],start=a["start"],end=a["end"],
                               expected=a["gold"],actual=a["observed"],trace=file+".json"))
            leaks+=int(a["gold"]!="R" and a["observed"]=="R")
        for row,gr,c in zip(s["rows"],g["rows"],s["byRevision"]):
            for seg in row["spans"]:
                n=seg["end"]-seg["start"]; total+=n
                if "U" in seg["path"].split("/"):
                    unknown+=n;reasons[seg["reason"]]+=n
            for seg in gr["spans"]:
                oldmatrix[seg["path"]+">"+c["arms"]["h3b2"]["scope"]]+=seg["end"]-seg["start"]
                if seg["op"] not in ("F","-F"):continue
                for name,d in c["arms"].items():
                    if seg["start"] not in d["reviewed"]:errors.append(dict(story=story,arm=name,type="undiscovered",revision=row["r"],start=seg["start"],trace=file+".json"))
    for name,v in by_arm.items():
        v["confirmed"]=rates(v["fact"]);v["discovery"]=rates(v["review"])
        v["roleAccuracy"]=ratio(*v["role"]);v["stateAccuracy"]=ratio(*v["state"])
        v["quietRecall"]=v["confirmed"]["recall"];v["top1Rate"]=ratio(v["top1"],v["rankGold"]);v["top3Rate"]=ratio(v["top3"],v["rankGold"])
        v["pairRate"]=ratio(v["ordered"],v["pairs"])
    scope_stats[part]=dict(unit="UTF-16 overlap; boundary TP/FP/FN; each wrong overlap retained",matrix=matrix,
        boundaries={k:dict(counts=v,**rates(v)) for k,v in bound.items()},wrongRealityIntervals=leaks,
        unknownUnits=unknown,totalUnits=total,unknownFraction=ratio(unknown,total),unknownReasons=reasons,
        h3b2WholeRevision=oldmatrix,h3aWorldKind=None,h3bWorldKind=None)
    arms[part]=by_arm;failures[part]=errors
save("scope-audit",scope_stats);save("proposal",dict(arms=arms,stories=index))
save("grounding",{part:{name:{k:v[k] for k in ("fact","confirmed","quietRecall","scopeLeak","realFP","top1","top3","rankGold","pairs","ordered")}
                             for name,v in group.items()} for part,group in arms.items()})
# Split the failure index by story group; keep all unchanged four-arm diagnostics.
catalog={}
for part,rows in failures.items():
    catalog[part]=[]
    for i in range(0,len(rows),80):
        name=f"fail-{part}-{i//80+1}"; save(name,rows[i:i+80]); catalog[part].append(name+".json")
save("failure-list",dict(index=catalog,firstDevelopment="dev-first.json",old="pre-fix.json",
    heldHardFailure="held-05.json",postHeldCounterexample="post-held.json",
    scopeErrors={k:sum(r["type"]=="scope" for r in rows) for k,rows in failures.items()}))
controls=raw("controls")
save("case-wusan",dict(story="雾散后",rows=controls["wusan"],reserve=controls["reserve"],fact=controls["totals"]))
save("safety",controls["checks"])
prefix=raw("all-prefix")
causal=dict(targeted=prefix.pop("targeted"),changed=prefix.pop("changed"),publicMisses=prefix.pop("publicMisses"))
save("causal-audit",causal)
save("prefix-replay",prefix)
bench=raw("bench")
for entry in bench["results"]:
    entry["medians"]={k:median(t[k] for t in entry["trials"]) for k in entry["trials"][0]}
save("benchmark",bench)
diag=raw("postheld");save("post-held",diag)
reg=json.loads((out/"regression.json").read_bytes())
issues=[]
if any(v["wrongRealityIntervals"] for v in scope_stats.values()):issues.append("non-reality spans assigned to reality")
if diag["actual"]!=diag["expectedFacts"]:issues.append("independently reproduced false admission after misclassified outer frame")
if any(g["h3b2s"]["fact"][1] for g in arms.values()):issues.append("frozen false confirmation")
if any(not t["pass"] for t in controls["checks"]):issues.append("hostile or public control")
if prefix["problems"] or prefix["sends"]:issues.append("prefix or permissions")
if causal["changed"] or len(causal["targeted"])!=64:issues.append("historical controls changed")
if any(g["h3b2s"]["unauthorized"] or g["h3b2s"]["sends"] for g in arms.values()):issues.append("visual authorization")
if reg["acceptance"]["newCompatibilityFailures"] or reg["changedHistoricalFiles"] or not reg["acceptance"]["preservedOriginalFailures"]:issues.append("compatibility")
incomplete=(sum(prefix["counts"].values())!=1765 or not arms["held"]["h3b2s"]["fact"][0] or
            any(g["h3b2s"]["fact"][2] for g in arms.values()))
status="FAIL" if issues else ("H3B2S_PARTIAL" if incomplete else "H3B2S_OFFLINE_SCOPE_SAFETY_PASS")
verdict=dict(status=status,issues=issues,
    freezeCommit="17f03ed24866b8e8db6f58bd557c4e4375fc1415",scorerCommit="4eef3ba16841bee4e41f793f78c2978d00f18342",
    freezeSHA256=hashfile(out/"freeze.json"),firstHeldOpened=(scratch/"h3b2s-held-open.txt").read_text(encoding="utf-8-sig").strip(),
    heldScoredOnce=True,postHeldChangesToScorerOrEntry=False,independent="INDEPENDENT_HUMAN_BLIND_REVIEW_NOT_RUN",
    grounding="SEMANTIC_FACT_GROUNDING_NOT_VERIFIED",realModelQueries=0,realText=0,realImages=0,usd=0)
save("acceptance",verdict)
print(verdict["status"],issues)
sys.exit(1 if issues else (2 if incomplete else 0))
