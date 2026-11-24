"""Isolated field-level scene candidates. No network, provider or production imports."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from pilot import FIELDS, TAG, encoded, history, locate, require, sha

DIRECTIONS = ("东", "西", "南", "北", "东北", "东南", "西北", "西南")
LOCATIVE = tuple("旁边上下内外侧前后中间处口顶底门楼岸台墙桥廊道亭室里")
COLLECTIONS = {"people", "features"}
INHERITS = {"keep", "add", "remove"}


def prefix(group, rev):
    require(group in ("A","B","C","D") and type(rev) is int and 1 <= rev <= 3, "SLOT")
    if group == "D":
        return json.loads((HERE/"story-D.json").read_bytes())[:rev]
    return history(group, rev)


def hidden(group, rev, error):
    return {"group":group, "revision":rev, "status":"HIDDEN", "error":error, "fields":{},
            "sceneId":None, "digest":None, "tag":TAG, "send":False, "sceneEligible":False}


def sources(group, rev, answer, texts, legacy):
    required = {"tag","claims","exclusions"} if legacy else {"tag","claims","exclusions","group","revision"}
    require(isinstance(answer,dict) and set(answer)==required and answer["tag"]==TAG, "BAD_ENVELOPE")
    if not legacy:
        require(answer["group"]==group and type(answer["revision"]) is int and answer["revision"]==rev, "FRAME_SCOPE")
    claims = answer["claims"]
    require(isinstance(claims,list) and len(claims)==len(FIELDS)
            and all(isinstance(c,dict) and isinstance(c.get("field"),str) for c in claims)
            and {c["field"] for c in claims}==set(FIELDS), "FIELD_IDENTITY")
    excluded = answer["exclusions"]
    require(isinstance(excluded,list) and len(excluded)<=12, "EXCLUSIONS")
    excluded = [locate(ref,group,rev,texts) for ref in excluded]
    require(all(ref["layer"]!="current" for ref in excluded), "CONFLICTING_LAYER")
    refs = {}
    for c in claims:
        keys = {"field","op","values","status","previous","delta","refs"}
        if not legacy:
            keys.add("storyChangeQuote")
        require(set(c)==keys and isinstance(c["refs"],list) and len(c["refs"])<=8,"BAD_CLAIM_SHAPE")
        spans = [locate(ref,group,rev,texts) for ref in c["refs"]]
        if c["status"]!="unknown":
            require(all(r["layer"]=="current" and r["visible"] for r in spans),"NONCURRENT_OR_HIDDEN")
        for r in spans:
            if r["layer"]=="current":
                require(not any(e["rev"]==r["rev"] and r["start"]<e["end"] and e["start"]<r["end"]
                                for e in excluded), "OVERLAPPING_SCOPES")
        event = c.get("storyChangeQuote")
        if event is not None:
            require(isinstance(event,str) and any(r["rev"]==rev and r["layer"]=="current" and r["visible"]
                    and r["quote"]==event for r in spans), "INVALID_EVENT_SOURCE")
        refs[c["field"]] = spans
    return refs, excluded


def physical(field, value, quotes, direct):
    if field=="perspective":
        require(value.startswith("向") and value[1:] in DIRECTIONS, "NOT_PHYSICAL_DIRECTION")
        if direct:
            require(any(marker+value[1:] in q for marker in ("向","朝","往","面","望")
                        for q in quotes), "NO_DIRECTION_ANCHOR")
    if field=="viewpoint":
        require(value.endswith(LOCATIVE) and not any(mark in value for mark in ("人称","镜头"))
                and not any(marker+d in value for marker in ("向","朝","面向") for d in DIRECTIONS),
                "NOT_PHYSICAL_POSITION")
        if direct:
            require(any(value in q for q in quotes), "NO_POSITION_ANCHOR")


def field_value(c, spans, rev, prior, same_place):
    field, op, status = c["field"], c["op"], c["status"]
    items, delta = c["values"], c["delta"]
    require(isinstance(delta,list) and len(delta)<=20 and all(isinstance(v,str) and v.strip()==v
            and 0<len(v)<=72 for v in delta) and len(set(delta))==len(delta),"BAD_DELTA")
    if status=="unknown":
        require(items is None and op=="unknown" and not delta and c["previous"] is None
                and c.get("storyChangeQuote") is None,"UNKNOWN_FILLED")
        return "unknown", None
    direct = op in ("set","reobserve")
    require(status in ("complete","partial") and (direct or op in INHERITS), "BAD_OPERATION")
    require(isinstance(items,list) and len(items)<=20 and all(isinstance(v,str) and 0<len(v)<=72
            and v==v.strip() for v in items) and len(set(items))==len(items),"BAD_VALUES")
    collection = field in COLLECTIONS
    require(collection or (status=="complete" and len(items)==1),"BAD_SCALAR")
    require(status!="partial" or (collection and direct and bool(items)),"BAD_PARTIAL")
    quotes = [r["quote"] for r in spans if r["rev"]==rev]
    require(quotes,"NO_CURRENT_EVIDENCE")
    value = sorted(items) if collection else items[0]
    if direct:
        require(c["previous"] is None and not delta and len(spans)==len(quotes),"UNBOUND_OBSERVATION")
        if field=="place":
            require(all(any(part in q for q in quotes) for part in value.split("／")), "NO_PLACE_ANCHOR")
        if field in ("people","features","timeOfDay","lighting"):
            require(all(any(item in q for q in quotes) for item in items), "NO_DIRECT_VALUE_ANCHOR")
            if collection and not items:
                require(any(any(word in q for word in ("无","没有","无人","空","不剩")) for q in quotes),
                        "EMPTY_WITHOUT_OBSERVATION")
        physical(field, value, quotes, True)
    else:
        require(prior and prior["status"]=="complete" and type(c["previous"]) is int
                and c["previous"]==rev-1 and status=="complete","NO_COMPLETE_BASELINE")
        require(same_place, "UNBOUND_SCENE")
        old = prior["value"]
        if op=="keep":
            require(old==value and not delta and c.get("storyChangeQuote") is None,"KEEP_MISMATCH")
        else:
            require(collection and delta,"BAD_DELTA")
            before,after,changes = set(old),set(items),set(delta)
            valid = (changes.isdisjoint(before) and before|changes==after) if op=="add" else (
                    changes<=before and before-changes==after)
            require(valid,"DELTA_MISMATCH")
        physical(field, value, quotes, False)
    return status, value


def project_frame(group,rev,answer,previous=None,*,legacy=False):
    texts = prefix(group,rev)
    if previous is not None and (previous.get("group"),previous.get("revision"))!=(group,rev-1):
        return hidden(group,rev,"PREVIOUS_SCOPE")
    try:
        refs, excluded = sources(group,rev,answer,texts,legacy)
    except (ValueError,TypeError,KeyError) as exc:
        return hidden(group,rev,str(exc))
    old_fields = previous["fields"] if previous else {}
    old_place = previous["sceneId"] if previous else None
    claims = {c["field"]:c for c in answer["claims"]}
    fields, corrections, events, changes = {}, [], [], []
    scene_id = None
    for name in FIELDS:  # Resolve the place before allowing other fields to inherit.
        c, prior = claims[name], old_fields.get(name)
        same_place = old_place is not None and (name=="place" or old_place==scene_id)
        error = None
        try:
            status,value = field_value(c,refs[name],rev,prior,same_place)
        except (ValueError,TypeError) as exc:
            status,value,error = "needs-review",None,str(exc)
        if name=="place" and status=="complete":
            scene_id = value
        known = status in ("partial","complete")
        same_value = bool(prior and (prior["status"],prior["value"])==(status,value))
        continuing = bool(known and prior and same_place and same_value)
        first = prior["firstKnown"] if continuing else rev if known else None
        fields[name] = {"status":status,"value":value,"firstKnown":first,"operation":c["op"],
                        "refs":refs[name],"error":error}
        if rev>1 and not same_value:
            changes.append(name)
        if known and c.get("storyChangeQuote") is not None:
            events.append({"field":name,"quote":c["storyChangeQuote"]})
        elif known and rev>1 and not continuing and c["op"] in ("set","reobserve"):
            corrections.append({"field":name,"reason":"newly-grounded" if not prior or
                                prior["status"] not in ("partial","complete") else "reobserved"})
    values = {f:r["value"] if r["status"]=="complete" else None for f,r in fields.items()}
    partial = {f:r["value"] for f,r in fields.items() if r["status"]=="partial"}
    values["count"] = None if values["people"] is None else len(values["people"])
    return {"group":group,"revision":rev,"status":"complete" if all(v is not None for v in values.values())
            else "partial","fields":fields,"sceneId":scene_id,"values":values,"partial":partial,
            "changed":sorted(changes) if previous and previous["status"]!="HIDDEN" else None,
            "corrections":corrections,"storyChangeCandidates":events,
            "excluded":excluded,"digest":sha(encoded([group,values,partial])),"tag":TAG,
            "send":False,"sceneEligible":False}


def packet(group,rev,previous):
    require(group in ("B","C","D") and (previous is None if rev==1 else previous is not None
            and (previous["group"],previous["revision"])==(group,rev-1)), "PACKET_SEQUENCE")
    context = None
    if previous is not None:
        context = {k:previous[k] for k in ("group","revision","status","sceneId","digest")}
        context["error"] = previous.get("error")
        context["nonAuthoritative"] = True
        context["fields"] = {f:{k:v[k] for k in ("value","status","error","firstKnown")}
                             for f,v in previous["fields"].items()}
    return {"instructions":(HERE/"prompt.txt").read_text("utf-8"),
            "schema":json.loads((HERE/"schema.json").read_bytes()),"group":group,"revision":rev,
            "history":[{"rev":i,"narrative":t} for i,t in enumerate(prefix(group,rev),1)],
            "previousCandidate":context}
