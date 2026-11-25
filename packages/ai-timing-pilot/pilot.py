"""Frozen packet builder and host checks. Offline, without evaluation imports."""
from pathlib import Path
import hashlib,json,re

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
EV=ROOT/"docs/reports/evidence/YJ-P04-TIMING-01"
SRC=EV.parent/"YJ-P04-STABILITY-01R/timing-input.jsonl"
def read(p):return json.loads(p.read_bytes())
def enc(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
def sha(b):return hashlib.sha256(b).hexdigest()
def req(test,msg):
    if not test:raise ValueError(msg)
def once(p,b):
    p.parent.mkdir(parents=True,exist_ok=True)
    if p.exists():req(p.read_bytes()==b,"immutable "+p.name)
    else:
        with p.open("xb") as f:f.write(b)

POL=read(HERE/"protocol.json")
SCHEMA=read(HERE/"schema.json")
EXEC={"tag":"AI_SCENE_PROPOSAL / RESEARCH_ONLY","referenceStatus":"none-established","sceneEligible":False,
      "actualAction":"blocked","send":False,"dispatchAttempted":False}
def scalar(v):req(type(v) in (str,int,bool) or v is None,"scalar");return v
def select(v,keys):
    return {k:scalar(v[k]) for k in keys.split() if k in v}
def ref(x):
    return select(x,"rev layer visible quote")
def attr(x):
    d=select(x,"status value revision lastConfirmedRevision origin")
    if x.get("evidence"): d["evidence"]=ref(x["evidence"])
    return d
def named(x,func,allowed):
    return {k:func(v) for k,v in x.items() if k in allowed}
ATTRS="opening position moisture arrangement contents visibility ice movement part:页 observed-description".split()
def event(x):return {"kind":x["kind"],"evidence":ref(x["evidence"])}
def clean(row):
    f={}
    for k in ("place","people","viewpoint","perspective","lighting","timeOfDay"):
        x=row["fields"][k]; val=x["value"]
        f[k]={"value":[scalar(n) for n in val] if type(val)==list else scalar(val),"status":x["status"],
              "firstKnown":x["firstKnown"],"refs":list(map(ref,x["refs"]))}
    obligations=[]
    for d in row["obligations"]:
        c=d.get("conditionCandidate")
        obligations.append({**select(d,"declaredAt status"),"utterance":ref(d["utterance"]),
            "terms":named(d["terms"],lambda t:select(t,"value sourceQuote"),("actor","condition","resource","recipient")),
            "condition":None if not c else {"revision":c["revision"],"evidence":ref(c["evidence"])}})
    links=[{**select(l,"status declaredAt conditionAt reason"),"outcome":{**select(l["outcome"],"revision actor resource recipient consequence"),
             "evidence":ref(l["outcome"]["evidence"])}} for l in row["payoffLinks"]]
    return {"sourceType":"repaired-archive","scope":scalar(row["scope"]),"revision":scalar(row["rev"]),
        "text":scalar(row["source"]["narrative"]),"fields":f,"count":scalar(row["values"]["count"]),
        "objects":[{**select(x,"id name"),"identity":ref(x["identity"]),"attributes":named(x["attributes"],attr,ATTRS)} for x in row["objects"]],
        "historicalOnly":{oid:named(attrs,attr,ATTRS) for oid,attrs in row["historicalLastConfirmed"].items() if re.fullmatch("[0-9a-f]{20}",oid)},
        "observedDifferences":[{**select(d,"object attribute actor actualChangeRevision"),"before":attr(d["before"]),"after":attr(d["after"])} for d in row["observedDifferences"]],
        **{k:list(map(event,row[k])) for k in ("visibleEvents","knowledgeEvents","narrativeEvents")},
        "obligations":obligations,"links":links,"limits":list(map(ref,row["limits"])),"excluded":list(map(ref,row["excluded"])),
        "coverage":"not-independently-reviewed"}
def sources(group):
    if group=="old":return [clean(json.loads(l)) for l in SRC.read_bytes().splitlines()]
    req(group=="new","group")
    out=[]
    for x in read(HERE/"fixture.json"):
        r=x["rev"]; mk=lambda quote,layer="current":{"rev":r,"quote":quote,"layer":layer}
        out.append({"sourceType":"author-supplied-source-fixture","scope":"research-cliff-01","revision":r,"text":x["text"],
                    "fields":{k:{"value":v,"status":"observed","refs":[mk(q)]} for k,v,q in x["facts"]},
                    "limits":[mk(q,"unknown") for _,q in x["unknown"]],"excluded":[mk(q,l) for l,q in x["excluded"]],
                    "events":[{"kind":k,"evidence":mk(q)} for k,q in x["events"]],"coverage":"not-independently-reviewed"})
    return out
def slot(group,r):return group+f"{r:02d}"
def packet(group,r,prior):
    rows=sources(group);req(1<=r<=len(rows) and ((r==1 and prior is None) or
        (r>1 and prior and (prior["scope"],prior["revision"])==(rows[r-1]["scope"],r-1))),"sequence")
    return {"protocol":POL["version"],"instructions":POL["candidate"],"schema":SCHEMA,"scope":rows[r-1]["scope"],"revision":r,
            "prefix":[{"rev":x["revision"],"text":x["text"]} for x in rows[:r]],"sceneCandidate":rows[r-1],
            "previousRecommendation":prior,"referenceStatus":"none-established"}
def shape(v,s):
    if "enum" in s:req(v in s["enum"],"enum");return
    t=s["type"]
    req(type(v)=={"integer":int,"object":dict,"string":str,"array":list}[t],"type")
    if t=="object":
        req(set(v)==set(s["properties"]),"keys")
        for k,sub in s["properties"].items():shape(v[k],sub)
    if t=="array":
        for item in v:shape(item,s["items"])
    if t=="string":req(0<len(v.strip())<=1200,"string")
    if t=="integer":req(v>=1,"integer")
def locate(p,e):
    r=e["rev"];req(type(r)==int and 1<=r<=p["revision"],"future/source")
    q=e["quote"];t=p["prefix"][r-1]["text"];req(isinstance(q,str) and q and t.count(q)==1,"ambiguous/missing quote")
    i=t.index(q);return {"rev":r,"quote":q,"start":i,"end":i+len(q),"textSha256":sha(t.encode())}
def validate(p,b):
    spans=[]
    try:
        def unique(pairs):
            req(len(dict(pairs))==len(pairs),"duplicate key");return dict(pairs)
        a=json.loads(b.decode("utf-8-sig"),object_pairs_hook=unique);shape(a,SCHEMA)
        req((p["scope"],p["revision"])==(a["scope"],a["revision"]),"scope")
        req(a["evidence"],"no evidence")
        for e in a["evidence"]:
            s=locate(p,e);spans.append({**s,"use":e["use"]})
            if e["use"]=="focus":
                req(s["rev"]==p["revision"],"historical-focus")
                for x in p["sceneCandidate"]["excluded"]+p["sceneCandidate"]["limits"]:
                    if x["rev"]!=s["rev"]:continue
                    z=locate(p,x);req(not(s["start"]<z["end"] and z["start"]<s["end"]),"excluded-focus")
        req(not a["focus"] or any(s["use"]=="focus" for s in spans),"ungrounded focus")
        intent=a["timingIntent"];cp=a["conditionalPresentation"]
        req(cp["withoutReference"]==("new" if intent=="update" else intent),"without-reference mismatch")
        if intent=="update":
            req(a["visualValue"]["value"] not in ("none","unknown") and a["visualReliability"]["value"] not in ("conflict","insufficient") and a["focus"],"update requires grounded focus")
        if cp["withSuitableReference"] in ("edit","reuse"):req(cp["requiredReferenceConditions"],"reference conditions")
        return {"valid":True,"reason":None,"evidence":spans,"execution":EXEC}
    except (ValueError,TypeError,KeyError,IndexError,UnicodeError) as exc:
        return {"valid":False,"reason":str(exc),"evidence":spans,"execution":EXEC}
def previous(p,b,result):
    try:a=json.loads(b.decode("utf-8-sig"));intent=a.get("timingIntent")
    except (ValueError,AttributeError,UnicodeError):intent=None
    return {"scope":p["scope"],"revision":p["revision"],"valid":result["valid"],"rawIntent":intent if intent in SCHEMA["properties"]["timingIntent"]["enum"] else None,
            "validIntent":intent if result["valid"] else None,"packetSha256":sha(enc(p)),"rawSha256":sha(b),"execution":"blocked"}
def audit_packet(p,b,result):
    return {"instructions":POL["audit"],"scope":p["scope"],"revision":p["revision"],"packet":p,
            "raw":b.decode("utf-8-sig"),"mechanicalResult":result,"binding":{"packet":sha(enc(p)),"raw":sha(b),"result":sha(enc(result)),
            "candidatePrompt":sha(POL["candidate"].encode()),"auditPrompt":sha(POL["audit"].encode())}}
