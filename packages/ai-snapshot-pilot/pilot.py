"""Offline request construction and candidate projection for the fixed nine slots."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
DIGESTS = {
    "prompt.txt":"a34f75a18e3534a4b23a868ebf3ca98b701a77475dc50fd31c8de8774cf7c739",
    "schema.json":"13518ed1a0ab273c7068fafd8b72c55482dfd086092f2899e9c1eb3ac2c5fc83",
    "policy.json":"01c5a553a1d8d8c538254d23a472bdd006fcd4fd7180db558d50cadfd611f175",
    "stories.json":"41776686912acef7b14dcd73fa16af0799978417eae57871bc742ef02bf704ed",
    "../first-play/test/scene-snapshot/input.json":"9fbb9f3615b2922b6e17f6e88cd95edbdf9223e903d381eeabe543e5efe802cb"}
FIELDS = ("place","people","features","timeOfDay","lighting","viewpoint","perspective")
SLOTS = tuple((g,r) for g in "ABC" for r in range(1,4))
TAG = "AI_SCENE_PROPOSAL / RESEARCH_ONLY"

def require(condition, reason):
    if not condition:
        raise ValueError(reason)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",",":"), allow_nan=False).encode()

def frozen(name):
    data = (HERE/name).read_bytes().replace(b"\r\n", b"\n")
    require(sha(data) == DIGESTS[name], "FROZEN_INPUT_CHANGED")
    return data

POLICY = json.loads(frozen("policy.json"))
BATCH = sha(encoded(DIGESTS))
def history(group, rev):
    require((group,rev) in SLOTS, "SLOT_OUT_OF_RANGE")
    if group == "A":
        texts = [r["narrative"] for r in json.loads(frozen("../first-play/test/scene-snapshot/input.json"))]
    else:
        texts = json.loads(frozen("stories.json"))[group]
    return texts[:rev]

def request(group, rev):
    prefix = history(group, rev)
    content = {"group":group,"currentRevision":rev,"history":[{"rev":i,"narrative":t} for i,t in enumerate(prefix,1)]}
    body = encoded({"model":POLICY["model"],"service_tier":"default","store":False,"stream":False,
        "background":False,"tools":[],"reasoning":{"effort":"none"},"truncation":"disabled",
        "max_output_tokens":POLICY["maxOutputTokens"],"instructions":frozen("prompt.txt").decode(),
        "input":encoded(content).decode(),"text":{"format":{"type":"json_schema","name":"scene_proposal",
        "strict":True,"schema":json.loads(frozen("schema.json"))}}})
    require(len(body) <= POLICY["maxRequestBytes"], "REQUEST_TOO_LARGE")
    return body

def locate(ref, group, rev, prefix):
    require(isinstance(ref,dict) and set(ref)=={"group","rev","quote","layer","visible"}, "BAD_REFERENCE")
    index, quote = ref["rev"], ref["quote"]
    require(ref["group"]==group and type(index) is int and 1<=index<=rev, "WRONG_SOURCE")
    require(type(ref["visible"]) is bool and ref["layer"] in
            ("current","past","dream","hypothetical","reported","unknown"), "BAD_SCOPE")
    require(isinstance(quote,str) and 0<len(quote)<=240, "BAD_QUOTE")
    text=prefix[index-1]
    start=text.find(quote)
    require(start>=0 and text.find(quote,start+1)<0, "MISSING_OR_AMBIGUOUS_SPAN")
    offset=lambda s:len(s.encode("utf-16-le"))//2
    return {**ref,"sourceSha256":sha(text.encode()),"start":offset(text[:start]),"end":offset(text[:start+len(quote)])}

def project(group, rev, proposal, previous=None):
    prefix=history(group,rev)
    require(set(proposal)=={"tag","claims","exclusions"} and proposal["tag"]==TAG,"BAD_SHAPE")
    claims=proposal["claims"]
    require(isinstance(claims,list) and len(claims)==len(FIELDS),"FIELD_COUNT")
    require(isinstance(proposal["exclusions"],list) and len(proposal["exclusions"])<=12,"EXCLUSIONS")
    if rev>1:
        require(previous is not None and (previous["group"],previous["revision"])==(group,rev-1),"PREVIOUS_SCOPE")
    else:
        require(previous is None,"PREVIOUS_SCOPE")
    values, partial, spans, inherited = {}, {}, {}, []
    for c in claims:
        require(isinstance(c,dict) and set(c)=={"field","status","op","values","delta","previous","refs"},"BAD_CLAIM")
        field,status,op,items,delta=c["field"],c["status"],c["op"],c["values"],c["delta"]
        require(field in FIELDS and field not in values and status in ("complete","partial","unknown"),"BAD_FIELD")
        require(isinstance(c["refs"],list) and len(c["refs"])<=8,"BAD_REFERENCE")
        refs=[locate(ref,group,rev,prefix) for ref in c["refs"]]
        spans[field]=refs
        require(isinstance(delta,list) and all(isinstance(v,str) and 0<len(v)<=60 for v in delta)
                and len(delta)==len(set(delta)) and len(delta)<=16,"BAD_DELTA")
        if status=="unknown":
            require(items is None and op=="unknown" and not delta and c["previous"] is None,"UNKNOWN_FILLED")
            values[field]=None
            continue
        require(refs and all(r["layer"]=="current" and r["visible"] for r in refs)
                and any(r["rev"]==rev for r in refs),"NO_CURRENT_VISIBLE_SUPPORT")
        require(isinstance(items,list) and len(items)<=20 and all(isinstance(v,str) and
                v.strip()==v and 0<len(v)<=72 for v in items) and len(set(items))==len(items),"BAD_VALUES")
        collection=field in ("people","features")
        require(collection or (len(items)==1 and status=="complete"),"BAD_SCALAR")
        normalized=sorted(items) if collection else items[0]
        if op=="set":
            require(c["previous"] is None and not delta and all(r["rev"]==rev for r in refs),"UNBOUND_SET")
        else:
            require(op in ("keep","add","remove") and previous is not None and
                    type(c["previous"]) is int and c["previous"]==rev-1 and status=="complete","NO_BASELINE")
            old=previous["values"][field]
            require(old is not None,"UNKNOWN_BASELINE")
            inherited.append(field)
            if op=="keep":
                require(not delta and old==normalized,"KEEP_MISMATCH")
            else:
                require(collection and delta,"BAD_DELTA")
                before,after=set(old),set(items)
                if op=="add":
                    require(set(delta).isdisjoint(before) and before|set(delta)==after,"ADD_MISMATCH")
                else:
                    require(set(delta)<=before and before-set(delta)==after,"REMOVE_MISMATCH")
        values[field]=normalized if status=="complete" else None
        if status=="partial":
            require(collection and items and op=="set","BAD_PARTIAL")
            partial[field]=normalized
    if inherited:
        require(values["place"] is not None and values["place"]==previous["values"]["place"],"PLACE_CHANGED")
    excluded=[locate(ref,group,rev,prefix) for ref in proposal["exclusions"]]
    for e in excluded:
        require(e["layer"]!="current","CONFLICTING_LAYER")
        for entries in spans.values():
            for r in entries:
                if r["layer"]=="current" and r["rev"]==e["rev"]:
                    require(r["end"]<=e["start"] or r["start"]>=e["end"],"OVERLAPPING_SCOPES")
    values["count"]=None if values["people"] is None else len(values["people"])
    changed=None if previous is None else sorted(k for k in FIELDS if values[k]!=previous["values"][k]
                                        or partial.get(k)!=previous["partial"].get(k))
    return {"group":group,"revision":rev,"tag":TAG,"values":values,"partial":partial,"changed":changed,
            "textComplete":all(values[k] is not None for k in FIELDS),"candidateVisualHash":sha(encoded([group,values,partial])),
            "spans":spans,"excluded":excluded,"sceneEligible":False,"send":False}
