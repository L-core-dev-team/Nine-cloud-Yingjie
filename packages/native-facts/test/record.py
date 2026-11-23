"""Package actual stdout without re-opening the held evaluator."""
from pathlib import Path
from statistics import median
from collections import Counter
import hashlib
import json
import sys

scratch,out=map(lambda s:Path(s).resolve(),sys.argv[1:])
out.mkdir(parents=True,exist_ok=True)
def read(name):return json.loads((scratch/name).read_text(encoding="utf-8-sig"))
def save(name,data):
    path=out/(name+".json")
    path.write_bytes((json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n").encode())
    return hashlib.sha256(path.read_bytes()).hexdigest()
index={};measure={};counts=Counter();fail=[]
for part,filename in [("dev","native-dev-first.json"),("held","native-held.json")]:
    raw=read(filename)
    index[part]=[]
    for case in raw.pop("cases"):
        file="trace-"+case["id"];h=save(file,case)
        index[part].append(dict(id=case["id"],file=file+".json",sha256=h))
        counts.update(r["observed"]["trusted-native"][1] for r in case["rows"])
    fail.extend(raw["failures"]);measure[part]=raw
save("four-arms",dict(measure=measure,index=index,nativeClassCounts=counts,failures=fail,
     freezeCommit="0bf6efda367d346ded1571edaca28b0719939792",
     lockedImplementation="02ef19ba82505f8d6c49a38c2cc2d189e8c5a492",
     officialHeldOpenedUTC=(scratch/"native-held-open.txt").read_text(encoding="utf-8-sig").strip(),
     holdoutScoredOnce=True,synthetic=True,independentHumanReview="NOT_RUN"))
save("guards",dict(locked=read("native-guards-first.json"),publicAfterLock=read("native-extra.json")))
save("native-prefix",read("native-prefix.json"))
for name,example in read("native-examples.json").items():save("proof-"+name.lower(),example)
bench=[]
for n in [20,100,300,1000]:
    data=read(f"native-bench-{n}.json")
    data["medianWallMs"]=median(t["wallMs"] for t in data["trials"])
    data["medianCpuMs"]=median(t["cpuMs"] for t in data["trials"])
    bench.append(data)
save("benchmark",dict(results=bench,warmup=1,trials=3,measurement="per-size process RSS peak includes runtime and synthetic repository"))
