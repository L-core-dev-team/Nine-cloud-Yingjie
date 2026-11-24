"""After the last first reply, compare frozen labels and append independent reviews."""
from collections import Counter
from chain import *
from runpy import run_path
measure = run_path(str(HERE/'score.py'))['measure']

def audit(r,raw,view):
    if r not in PROTOCOL["audits"]: return {"status":"not-independently-reviewed"}
    pkg=audit_input(r,raw,view)
    require(path("audit-packets",r).read_bytes()==encoded(pkg),"AUDIT_BINDING")
    a=read(path("audit-raw",r))
    require(a["scope"]==SCOPE and a["rev"]==r and a["verdict"] in ("covered","needs-review"),"AUDIT_SCOPE")
    quotes=a["checked"]+[f["quote"] for f in a["findings"]]
    ok=bool(a["checked"]) and all(isinstance(q,str) and q and STORY[r-1]["text"].count(q)==1 for q in quotes)
    return {"status":"model-reviewed-no-omission" if ok and a["verdict"]=="covered" and not a["findings"] else "needs-review",
            "verdict":a["verdict"],"validQuotes":ok,"findings":a["findings"],
            "requestSha":sha(encoded(pkg)),"replySha":sha(path("audit-raw",r).read_bytes())}

def evaluate():
    gold=read(HERE/"gold.json")
    states={}; lastByPlace={}; memory={}; rows=[]; guarded=None
    for r,(raw,v) in enumerate(frames(14),1):
        require(encoded(v)==path("states",r).read_bytes(),"STATE_CHANGED")
        previous=states.get(r-1)
        base=lastByPlace.get(v["placeId"])
        changed=[k for k,x in v["values"].items() if not previous or previous["values"].get(k)!=x]
        guarded=project(r,raw,guarded,attribute_guard=True)
        guarded_diff={o["name"]:o["state"] for o,a in zip(guarded["objects"],v["objects"]) if o["state"]!=a["state"]}
        historical=[{"id":o["id"],"name":o["name"],"then":memory[o["id"]],"now":o["state"]}
                    for o in v["objects"] if o["id"] in memory and o["state"]!=memory[o["id"]]["state"]]
        for o in v["objects"]:
            if o["id"] and o["state"] is not None: memory[o["id"]]={"rev":r,"state":o["state"]}
        prior_objects={o["id"]:o for o in base["objects"]} if base else {}
        comparisons=[{"id":o["id"],"name":o["name"],"then":prior_objects[o["id"]]["state"],"now":o["state"]}
            for o in v["objects"] if o["id"] and o["id"] in prior_objects and prior_objects[o["id"]]["state"]!=o["state"]]
        states[r]=v
        if v["placeId"]: lastByPlace[v["placeId"]]=v
        a=audit(r,raw,v)
        g=gold[r-1]
        row={"rev":r,"actual":v["values"],"peopleStatus":v["fields"]["people"]["status"],
             "objects":{o["name"]:o["state"] for o in v["objects"]},"events":[[e["kind"],e["evidence"]["quote"]] for e in v["events"]],
             "limits":[e["quote"] for e in v["limits"]],"excluded":[[e["layer"],e["quote"]] for e in v["excluded"]],
             "errors":v["errors"],"vsPreviousFields":changed,"sameDigest":bool(previous and previous["digest"]==v["digest"]),
             "priorLocalRevision":base["rev"] if base else None,"localObjectDifferences":comparisons,"historicalDifferences":historical,"guardedReplayDifferences":guarded_diff,
             "audit":a,"literal":measure(v,g),"authorBaseline":{k:g[k] for k in ("importance","event","visible","advice","causes")},
             "send":False,"sceneEligible":False}
        rows.append(row)
    return {"rows":rows,"counts":{k:dict(Counter(value for row in rows for value in row["literal"][k].values())) for k in ("fields","objects")}}

if __name__=="__main__":
    print(json.dumps(evaluate(),ensure_ascii=True))
