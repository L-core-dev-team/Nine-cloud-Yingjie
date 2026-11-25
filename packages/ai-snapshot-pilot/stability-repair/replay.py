"""Derive a new state from immutable first replies; original packets remain bound to the old chain."""
import json
from attributes import observe
from narrative import discovered_direction, narrative
from source import Source, chain, evidence
from inputs import OUT as ORIGINAL, STORY, SCOPE, TAG, encoded, path, read, require, sha

def repair(r,raw,previous=None):
    previous=previous or {}
    require((not previous and r==1) or (previous.get("scope")==SCOPE and previous.get("rev")==r-1),"REPAIR_SEQUENCE")
    base=chain.project(r,raw,previous.get("continuation"),attribute_guard=True)
    src=Source(r,base)
    value,op,quotes=raw["fields"]["perspective"]
    if op=="seen" and base["errors"].get("perspective")=="UNSUPPORTED_BEARING":
        ref=discovered_direction(src,value,quotes,base["values"]["viewpoint"])
        if ref:
            base["values"]["perspective"]=value
            base["fields"]["perspective"]={"value":value,"status":"complete","refs":[ref],"firstKnown":r}
            del base["errors"]["perspective"]
    objects,history,diffs=observe(src,raw,base,previous)
    obligations,links=narrative(src,raw,base,previous)
    visible=[]; learned=[]; narrative_events=[]
    for ev in base["events"]:
        kind=ev["kind"]; q=ev["evidence"]["quote"]
        if kind in ("new-knowledge","correction"): learned.append(ev); continue
        if kind in ("payoff","commitment") or "支用" in q:
            if evidence(src,q):
                narrative_events.append({**ev,"evidence":dict(ev["evidence"],layer="current-narrative",visible=False)})
            continue
        after_gap=any(d["before"]["revision"]<r-1 and q==d["after"]["evidence"]["quote"] for d in diffs)
        if after_gap or "早已" in q:
            learned.append({**ev,"kind":"observed-result"}); continue
        visible.append(ev)
    current={o["id"]: {k:a["value"] for k,a in o["attributes"].items()} for o in objects}
    digest=sha(encoded([base["placeId"],base["values"],base["fields"]["people"]["status"],current]))
    old=previous.get("currentAttributes",{})
    boundary=[]
    for oid in old.keys()|current.keys():
        for k in old.get(oid,{}).keys()|current.get(oid,{}).keys():
            was=old.get(oid,{}).get(k); now=current.get(oid,{}).get(k)
            if (was is None)!=(now is None):
                boundary.append({"id":oid,"attribute":k,"kind":"now-unobserved" if now is None else "now-observed"})
    source={"scope":SCOPE,"revision":r,"prefixSha256":sha(encoded(STORY[:r])),
            "narrative":src.text,"action":STORY[r-1]["action"],"rawSha256":sha(path("raw",r).read_bytes()),
            "originalPacketSha256":sha(path("packets",r).read_bytes())}
    limits=base["limits"]
    return {"scope":SCOPE,"rev":r,"source":source,"tag":TAG,"sceneEligible":False,"send":False,
            "coverage":"repaired-candidate-not-independently-reviewed","fields":base["fields"],"values":base["values"],
            "objects":objects,"placeId":base["placeId"],"limits":limits,"excluded":base["excluded"],
            "visibleEvents":visible,"knowledgeEvents":learned,"narrativeEvents":narrative_events,
            "observedDifferences":diffs,"availabilityChanges":sorted(boundary,key=lambda x:(x["id"],x["attribute"])),
            "obligations":obligations,"payoffLinks":previous.get("payoffLinks",[])+links,
            "currentAttributes":current,"history":history,"visualDigest":digest,
            "digestChanged":None if not previous else previous["visualDigest"]!=digest,
            "expressibility":{"unknownFields":[f for f,a in base["fields"].items() if a["status"]!="complete"],
                "unknownAttributes":[[o["name"],k] for o in objects for k,a in o["attributes"].items() if a["value"] is None],
                "originalAdapterDiagnostics":base["errors"],"review":"pending","reusableImageEstablished":False},
            "continuation":{k:base[k] for k in ("fields","placeId","objects")}}
