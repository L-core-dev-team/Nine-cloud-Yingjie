"""Attribute candidates are derived from archived object or event candidates, not gold."""
import re
from copy import deepcopy
from source import evidence, chain

def atom(value):
    if value in ("合拢","摊开","仍摊开","紧闭","升起"):
        return "opening", value.removeprefix("仍")
    if value in ("空了","空的") or re.fullmatch(r"(?:盛着)?[半一满].{0,4}水",value):
        return "contents","空" if value.startswith("空") else value.removeprefix("盛着")
    if "薄冰" in value: return "ice",value
    if "露出" in value: return "visibility",value
    if value=="取走": return "movement",value
    if value.endswith(("上","下","旁")): return "position",value
    return "observed-description",value

def observe(src,raw,base,previous):
    history=deepcopy(previous.get("history",{}))
    objects={}
    differences=[]
    def entity(name,identity):
        oid=chain.stable("object",name,base["placeId"])
        return objects.setdefault(oid,{"id":oid,"name":name,"identity":identity,"attributes":{}})
    def record(obj,key,value,q,origin):
        ref=evidence(src,q)
        if not ref: return
        fact={"value":value,"revision":src.r,"evidence":ref,"origin":origin,"status":"observed"}
        attrs=obj["attributes"]
        if key in attrs and attrs[key]["value"]!=value:
            attrs[key]={"value":None,"status":"needs-review","reason":"conflicting-candidates"}
        else: attrs[key]=fact
    if not base["placeId"]: return [],history,[]
    proposed={item[0]:item for item in raw["objects"]}
    for old in base["objects"]:
        name=old["name"]
        obj=entity(name,old["identityEvidence"])
        _,state,identity,q,mention=proposed[name]
        if old["state"] is not None:
            key,value=atom(old["state"])
            record(obj,key,value,old["stateEvidence"]["quote"],"archive:object-state")
        if state=="@keep" and q and re.fullmatch(r"原样摆放的[\u4e00-\u9fff]+",q) and name in q.split("的",1)[1].split("和"):
            record(obj,"arrangement","原样摆放",q,"archive:keep-quote")
        # A possessive construction anchors both the object's pose and the moving component.
        owner_pose=re.fullmatch(re.escape(name)+r"(摊开|合拢)的(?:那|这)?(?:页|盖|门)",identity)
        if owner_pose:
            record(obj,"opening",owner_pose[1],identity,"mechanical:identity-clause")
        if isinstance(q,str) and evidence(src,q):
            part=re.fullmatch(re.escape(name)+r"(摊开|合拢)的(?:那|这)?(页|盖|门)(被[^，。；]{1,12}(?:掀动|吹起|掀起)[^，。；]*)",q)
            if part and mention in (name,q[:part.start(3)]):
                record(obj,"opening",part[1],q,"mechanical:possessive")
                record(obj,"part:"+part[2],part[3],q,"mechanical:possessive")
        # Evaluate each subject separately. A later clause cannot lend its predicate to the first.
        if isinstance(q,str) and isinstance(state,str) and q.count(state)==1 and src.text.count(q)==1:
            for clause in re.split("[，；。]",q):
                m=re.fullmatch(re.escape(name)+r"(?:仍)?(摊开|合拢)(?:在原处)?",clause)
                if m and m[1] in state and evidence(src,clause):
                    record(obj,"opening",m[1],clause,"mechanical:subject-clause")
    # Ink is a separately named visible subject; no ownership or global page identity is inferred.
    candidates=[(o[3],o[1],"archive:object-state") for o in raw["objects"] if o[1] and o[3] and o[1] in o[3] and src.text.count(o[3])==1]
    candidates += [(q,q,"archive:change-event") for k,q in raw["events"] if k=="change"]
    for q,asserted,origin in candidates:
        for clause in re.split("[，；。]",q):
            m=re.fullmatch(r"(墨迹|字迹)(?:尚|仍|已经|已)?(湿|干)(?:了)?",clause)
            ref=evidence(src,clause) if m and clause in asserted else None
            if ref:
                record(entity(m[1],ref),"moisture",m[2],clause,origin)
    for oid,obj in objects.items():
        memory=history.setdefault(oid,{})
        attrs=obj["attributes"]
        for key in sorted(set(attrs)|set(memory)):
            last=memory.get(key)
            current=attrs.setdefault(key,{"value":None,"status":"unknown","reason":"no-current-attribute-evidence"})
            current["lastConfirmedRevision"]=src.r if current["status"]=="observed" else last["revision"] if last else None
            if current["status"]!="observed": continue
            if last and current["value"]!=last["value"]:
                differences.append({"kind":"observed-difference","id":oid,"object":obj["name"],"attribute":key,
                    "before":last,"after":current,"actualChangeRevision":None,"actor":None})
            memory[key]=current
    return list(objects.values()),history,sorted(differences,key=lambda d:(d["id"],d["attribute"]))
