"""Bounded attribution for a directly uttered conditional and its candidate consequences."""
import re
from copy import deepcopy
from source import NONCURRENT, evidence, chain
from inputs import STORY, SCOPE, locate, overlap

def discovered_direction(src,value,quotes,location):
    if not location or len(quotes)!=1 or not isinstance(value,str): return None
    q=quotes[0]
    ref=evidence(src,q)
    if not ref: return None
    bearing=re.fullmatch(r"(?:向|朝|面向)(东南|东北|西南|西北|东|南|西|北)",value or "")
    if not bearing: return None
    discovery=r"(?:才|刚)(?:从[\u4e00-\u9fff]{1,10})?(?:认出|辨明|知道)自己一直(?:面向|朝向|向)"+bearing[1]+r"(?:，并没有转身)?"
    if not re.fullmatch(discovery,q): return None
    if src.sentence(q)!="我在"+location+"，"+q: return None
    return ref

def declaration(src,q,people):
    # Only the utterance is present. Its hypothetical object remains in the old exclusions.
    m=re.fullmatch(r"(?P<actor>[\u4e00-\u9fff]{1,6})说，若(?P<condition>[^，。]{2,12})，(?:她|他|我)愿把自己的(?P<resource>[^，。]{2,10})让给(?P<recipient>[^，。]{1,10})",q)
    if not m or m["actor"] not in people or src.sentence(q)!=q or NONCURRENT.search(q): return None
    if src.text.count(m["actor"]+"说")!=1: return None
    utterance=dict(src.span(m["actor"]+"说"),layer="current-speech",visible=False)
    if any(overlap(utterance,e) for e in src.layers): return None
    span=src.span(q)
    if any(overlap(span,e) and (e["layer"]!="hypothetical" or e["start"]<utterance["end"]) for e in src.layers): return None
    # Bind inner terms to the hypothetical passage, never publish them as current visual refs.
    terms={k:{"value":m[k],"sourceQuote":q,"startInQuote":m.start(k),"endInQuote":m.end(k)}
           for k in ("actor","condition","resource","recipient")}
    return {"id":chain.stable("conditional",[src.r,q]),"declaredAt":src.r,"terms":terms,
            "utterance":utterance,"content":{"quote":q,"layer":"conditional-intent","revision":src.r},
            "status":"conditional","result":None,"conditionCandidate":None}

def condition_matches(term,q):
    return bool(re.fullmatch(r"(井脉|水脉)(?:复流|恢复流动)",term) and
                re.fullmatch(r"(水脉|井脉)从[^，。]{1,8}(?:冲成|涌出|流出)[^，。]{1,10}",q))

def transfer_parts(src,events,people):
    for kind,q in events:
        if kind!="payoff" or not evidence(src,q): continue
        sentence=src.sentence(q)
        m=re.fullmatch(r"(?P<actor>[\u4e00-\u9fff]{1,6})在[^，。]{1,16}签下自己的名字，(?P<transfer>把(?:她|他)这(?P<resource>[^，。]{2,8})正式让给(?P<recipient>[^，。]{1,15}))，(?P<loss>从这一刻起(?:她|他)自己再不能支用)",sentence)
        ref=evidence(src,sentence) if m else None
        if ref and m["actor"] in people and m["transfer"]==q and evidence(src,m["loss"]):
            return m,dict(ref,layer="current-narrative",visible=False)
    return None

def same_terms(d,m):
    t=d["terms"]
    return (d["status"]=="condition-observed-candidate" and m["actor"]==t["actor"]["value"]
            and m["resource"].replace("井水","水")==t["resource"]["value"])

def linkable(d,m):
    t=d["terms"]
    return same_terms(d,m) and m["recipient"]==t["recipient"]["value"]  # explicit identical recipient only

def narrative(src,raw,base,previous):
    ledger=deepcopy(previous.get("obligations",[]))
    links=[]
    people=base["values"]["people"] or []
    if re.search(r"作废|撤回|取消|收回承诺|反悔|不再作数",src.text):
        for entry in ledger:
            if entry["result"] is None: entry["status"]="needs-review-invalidated"
    for kind,q in raw["events"]:
        if kind=="commitment":
            d=declaration(src,q,people)
            if d:
                hints=[]
                for i,row in enumerate(STORY[:src.r-1],1):
                    for sentence in re.split("[。！？]",row["text"]):
                        for person in people:
                            if (sentence.startswith(person+"问，") and d["terms"]["recipient"]["value"] in sentence
                                    and not NONCURRENT.search(sentence)):
                                hint=locate({"group":SCOPE,"rev":i,"quote":sentence,"layer":"reported","visible":False},
                                            SCOPE,src.r,[s["text"] for s in STORY[:src.r]])
                                hints.append({"speaker":person,"reference":hint})
                d["earlierMentions"]=hints
                ledger.append(d)
        if kind=="change" and evidence(src,q):
            matches=[d for d in ledger if d["status"]=="conditional" and condition_matches(d["terms"]["condition"]["value"],q)]
            if len(matches)==1:
                d=matches[0]
                d["conditionCandidate"]={"revision":src.r,"evidence":src.current(q),"placeId":base["placeId"],
                    "basis":"flow-language match in this story; source identity not independently confirmed"}
                d["status"]="condition-observed-candidate"
    outcome=transfer_parts(src,raw["events"],people)
    if outcome:
        m,ref=outcome
        payload={"revision":src.r,"actor":m["actor"],"resource":m["resource"],"recipient":m["recipient"],
                 "consequence":m["loss"],"evidence":ref}
        matches=[d for d in ledger if linkable(d,m)]
        if len(matches)==1:
            matches[0].update(result=payload,status="payoff-candidate")
        else:
            # A qualified later name can be compatible without proving that two recipients are identical.
            plausible=[d for d in ledger if same_terms(d,m) and
                        m["recipient"].endswith("的"+d["terms"]["recipient"]["value"])]
            if len(plausible)==1:
                links.append({"status":"needs-review","conditionalId":plausible[0]["id"],
                    "declaredAt":plausible[0]["declaredAt"],"conditionAt":plausible[0]["conditionCandidate"]["revision"],
                    "outcome":payload,"reason":"earlier recipient is unqualified; linkage is not identity proof"})
            else: links.append({"status":"unlinked","outcome":payload})
    return ledger,links
