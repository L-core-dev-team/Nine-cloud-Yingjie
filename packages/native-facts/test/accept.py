"""Evaluate locked synthetic artifacts and separately preserve the historical red gates."""
import hashlib
import json
from pathlib import Path
import sys

root=Path(__file__).resolve().parents[3]
e=root/"docs/reports/evidence/YJ-P04-NATIVE-FACT-01"
f=root/"packages/native-facts/test/frozen"
def read(p):return json.loads(p.read_bytes())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def result():
    hard=[];missing=[]
    def check(ok,message):
        if not ok:hard.append(message)
    frozen=read(e/"freeze.json")
    for name,h in frozen["files"].items():check(sha(f/name)==h,"frozen checksum "+name)
    overall=read(e/"four-arms.json")
    for part,group in frozen["groups"].items():
        gold={g["id"]:g for p in f.glob(part+"-gold-*.jsonl") for g in map(json.loads,p.read_bytes().splitlines())}
        rows=overall["index"][part];metrics=overall["measure"][part]
        check({v["id"] for v in rows}==set(gold) and len(rows)==len(gold),"story coverage "+part)
        hits=0;faults=0
        for v in rows:
            p=e/v["file"];check(sha(p)==v["sha256"],"trace checksum "+v["id"]);story=read(p)
            labels=gold[v["id"]]; check(len(story["rows"])==len(labels["turns"]),"turn coverage")
            check(len(story["attacks"])==len(labels["attacks"]),"adverse query coverage")
            for row,g in zip(story["rows"],labels["turns"]):
                check(row["r"]==g["r"] and row["world"]==[g["before"],g["after"]] and row["sub"]==[g["subBefore"],g["subAfter"]],"rule and gold disagree")
                facts=row["facts"];hits+=len(facts)
                if len(facts)>g["facts"]:hard.append("unsupported fact")
                if len(facts)<g["facts"]:missing.append("missed eligible real-rule arrival")
                for fact in facts:
                    check(fact["before"]==g["before"] and fact["after"]==g["after"] and fact["revision"]==g["r"] and fact["receiptSha"]==row["receiptSha"],"incorrect fact binding")
                obs=row["observed"];check(obs["scope-layer-mixed"]==obs["trusted-native"],"story influenced rule fact")
                check(all(obs[k]==["UNVERIFIED","untrusted-reader",0] for k in ["plain-prose","untrusted-wire"]),"authority impersonation")
                check(row["duplicateAdded"]==0,"double counted")
            for a,g in zip(story["attacks"],labels["attacks"]):
                check(a["at"]==g["at"] and a["fault"]==g["fault"] and a["pass"] and a["status"]=="UNVERIFIED" and not a["added"],"fault admitted")
                faults+=1
        check(faults==group["attackQueries"],"fault count")
        if hits!=group["positive"] or not hits:missing.append("positive coverage "+part)
        for name,m in metrics["totals"].items():
            check(not(m["FP"] or m["send"] or m["scene"] or m["duplicates"]),"hard gate "+name)
        check(not metrics["failures"],"scorer discrepancies "+part)
    prefix=read(e/"native-prefix.json");check(not prefix["failures"] and prefix["checked"]==sum(g["revisions"] for g in frozen["groups"].values()),"new prefixes")
    guards=read(e/"guards.json");check(all(t["ok"] for g in guards.values() for t in g["checks"]),"targeted guard")
    reg=read(e/"legacy-regression.json");check(not reg["problems"] and all(r["exit"]==r["expected"] for r in reg["commands"]),"legacy regression")
    comp=read(e/"compatibility.json");check(not comp["acceptance"]["newCompatibilityFailures"] and comp["historicalH3B2Gate"]["identical"] and comp["acceptance"]["preservedOriginalFailures"],"historical red gates")
    status="FAIL" if hard else "NATIVE_FACT_PARTIAL" if missing else "NATIVE_FACT_OFFLINE_RULE_ADAPTER_PASS"
    return dict(status=status,issues=hard,missing=missing,authority="SYNTHETIC_AUTHORITY_FIXTURE",
        actualUpstreamRead="UPSTREAM_AUTHENTICATED_READER_NOT_VERIFIED",realSnapshotPair="NOT_VERIFIED",cardScope="UPSTREAM_AUTHORITY_GAP",
        realAccounts=0,liveModelQueries=0,liveText=0,liveImages=0,actualUSD=0,nativePgChrome="ENV_BLOCKED / NOT_RUN")
try:v=result()
except (OSError,KeyError,ValueError) as err:v=dict(status="NATIVE_FACT_PARTIAL",missing=[str(err)])
print(json.dumps(v,ensure_ascii=False,separators=(",",":")))
sys.exit(0 if v["status"]=="NATIVE_FACT_OFFLINE_RULE_ADAPTER_PASS" else 1 if v["status"]=="FAIL" else 2)
