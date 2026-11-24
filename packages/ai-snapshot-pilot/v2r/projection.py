"""Research-only overlay for v2. Identity, current state and coverage are distinct."""
from copy import deepcopy
import re

from packets import encoded, prefix, sha
from scene import hidden, locate, project_frame, require

BEARING = re.compile(r"(?:面向|朝向|向|朝|面|往)(东北|东南|西北|西南|东|西|南|北)(?![东西南北])")
DELIMITER = re.compile(r"[，。；！？：、“”]")

def overlap(a,b):
    return a["rev"] == b["rev"] and a["start"] < b["end"] and b["start"] < a["end"]

def bearing(value, quotes, narrative, direct):
    match = BEARING.fullmatch(value)
    if not match:
        return None
    found = []
    for quote in quotes:
        for m in BEARING.finditer(quote):
            start = narrative.index(quote) + m.start()
            actual = BEARING.match(narrative, start)
            clause = DELIMITER.split(narrative[:start])[-1]
            # Restrict newly interpreted bearings to observer or subjectless locatives.
            if (not actual or actual.group(1) != m.group(1)
                or not re.fullmatch(r"(?:眼下|此刻|现在)?(?:我(?:仍|却)?|(?:才知道)?自己(?:一直)?|仍)?(?:在[^，。]{1,24}|倚[^，。]{1,12}|从[^，。]{1,12})?(?:仍)?", clause)
                or narrative[:start].count("“") > narrative[:start].count("”")
                or any(x in clause for x in ("没有","并非","不是","他说","她说","不曾","他","她"))):
                return None
            found.append(m.group(1))
    continues = any(x in q for q in quotes for x in ("仍","依旧","没变","未变","不变","没换"))
    if (not found and (direct or not continues)) or any(x != match.group(1) for x in found):
        return None
    return "向" + match.group(1)

def object_states(items, view, texts):
    ids = view["fields"]["features"]["value"]
    require(isinstance(items,list) and len(items)<=20, "OBJECT_LIST")
    names = [o["id"] for o in items]
    require(all(isinstance(n,str) and n and len(n)<=72 for n in names)
            and len(names)==len(set(names)) and sorted(names)==sorted(ids or []), "OBJECT_ID_SET")
    def source(quote):
        ref = {"group":view["group"],"rev":view["revision"],"quote":quote,"layer":"current","visible":True}
        span = locate(ref,view["group"],view["revision"],texts)
        require(not any(overlap(span,e) for e in view["excluded"]), "OBJECT_SCOPE_CONFLICT")
        return span
    result = []
    for o in items:
        require(set(o)=={"id","identityQuote","state","mention","stateQuote"}, "OBJECT_KEYS")
        name = o["id"]
        identity = source(o["identityQuote"])
        require(name in identity["quote"], "OBJECT_ID_ANCHOR")
        state = o["state"]
        evidence = None
        if state is None:
            require(o["mention"] is None and o["stateQuote"] is None, "UNKNOWN_STATE_FILLED")
        else:
            evidence = source(o["stateQuote"])
            mention = o["mention"]
            require(isinstance(mention,str) and mention and mention in evidence["quote"]
                    and (mention==name or [n for n in names if mention in n]==[name]), "OBJECT_REFERENT")
            require(isinstance(state,str) and state.strip() and state in evidence["quote"]
                    and state!=mention, "OBJECT_STATE_ANCHOR")
            # An evidence span must not assign another named object's condition to this identity.
            require(any(mention in clause and state in clause and not any(n!=name and n in clause for n in names)
                        for clause in DELIMITER.split(evidence["quote"])),
                    "OBJECT_STATE_SUBJECT")
        result.append({"id":name,"status":"observed" if evidence else "state-unknown",
                       "identityEvidence":identity,"state":state,"mention":o["mention"],"stateEvidence":evidence})
    return result

def project(group, rev, raw, previous=None, *, archived=False):
    texts = prefix(group,rev)
    try:
        answer = deepcopy(raw)
        items = None if archived else answer.pop("objects")
        people = next(c for c in answer["claims"] if c["field"]=="people")
        limits = []
        if people["status"]=="partial":
            require(isinstance(people["refs"],list) and len(people["refs"])<=8, "BAD_CLAIM_SHAPE")
            support = []
            for ref in people["refs"]:
                span = locate(ref,group,rev,texts)
                if span["layer"]=="unknown" and not span["visible"]:
                    require(span["rev"]==rev, "LIMIT_REVISION")
                    limits.append(span)
                    if ref not in answer["exclusions"]:
                        answer["exclusions"].append(ref)
                else:
                    support.append(ref)
            people["refs"] = support
        direction = next(c for c in answer["claims"] if c["field"]=="perspective")
        rejected = False
        if isinstance(direction["values"],list) and len(direction["values"])==1:
            quotes = [locate(r,group,rev,texts)["quote"] for r in direction["refs"] if r["rev"]==rev]
            normalized = bearing(direction["values"][0], quotes, texts[-1], direction["op"]!="keep")
            if normalized:
                direction["values"] = [normalized]
            else:
                direction["values"] = []
                rejected = True
        view = project_frame(group,rev,answer,previous)
        if view["status"]=="HIDDEN":
            return view
        if rejected:
            view["fields"]["perspective"]["error"]="UNSUPPORTED_OBSERVER_BEARING"
        view["visibilityLimits"] = limits
        view["objects"] = [] if archived else object_states(items,view,texts)
        view["candidateContentSha256"] = sha(encoded(raw))
        # Local continuity links never carry a previous state or confer a global identity.
        links = []
        if previous and (previous.get("sceneId") is None or previous["sceneId"]==view["sceneId"]):
            prior_ids = {o["id"] for o in previous.get("objects",[])}
            for obj in view["objects"]:
                evidence = obj["identityEvidence"]
                same_known_scene = view["sceneId"] and view["sceneId"]==previous.get("sceneId")
                continuation = any(marker in evidence["quote"] for marker in ("还在","依旧","仍在"))
                if obj["id"] in prior_ids and (continuation or
                        (same_known_scene and view["fields"]["features"]["operation"]=="keep")):
                    links.append({"id":obj["id"],"previousRevision":rev-1,"evidence":evidence})
        view["objectContinuity"] = links
        old_states = {o["id"]:o["state"] for o in (previous or {}).get("objects",[])}
        linked = {link["id"] for link in links}
        observations = {}
        for obj in view["objects"]:
            name, state = obj["id"], obj["state"]
            if state is None:
                observations[name] = "specific-state-unobserved"
            elif name not in linked or old_states[name] is None:
                observations[name] = "newly-observed-state"
            elif old_states[name] != state:
                observations[name] = "different-observed-state"
            else:
                observations[name] = "same-observed-state"
        view["objectStateObservations"] = observations
        view["facilityCoverage"] = "coverage-needs-review"
        view["fields"]["features"]["scope"] = "legacy-values" if archived else "identity-list"
        view["digest"] = sha(encoded([view["digest"],sorted((o["id"],o["state"]) for o in view["objects"])]))
        return view
    except (ValueError,KeyError,TypeError,StopIteration,AttributeError) as e:
        return hidden(group,rev,str(e))

def review(packet, raw_review, candidate_path, view):
    from packets import audit_packet
    require(packet==audit_packet(candidate_path) and view.get("candidateContentSha256")==sha(encoded(packet["candidate"])), "UNBOUND_REVIEW")
    require(set(raw_review)=={"verdict","checked","findings"} and raw_review["verdict"] in
            ("covered","needs-review") and isinstance(raw_review["checked"],list)
            and isinstance(raw_review["findings"],list), "REVIEW_SHAPE")
    text = packet["currentNarrative"]
    for row in raw_review["checked"]+raw_review["findings"]:
        require(isinstance(row["object"],str) and row["object"] and isinstance(row["quote"],str)
                and row["quote"] and text.count(row["quote"])==1, "REVIEW_QUOTE")
    require(all(isinstance(r["registered"],str) and r["registered"] for r in raw_review["checked"])
            and all(r["kind"] in ("omitted","contradicted","unsupported") and isinstance(r["detail"],str)
                    and r["detail"] for r in raw_review["findings"]), "REVIEW_CONTENT")
    if raw_review["findings"] or raw_review["verdict"]!="covered":
        return "coverage-needs-review"
    objects = view.get("objects",[])
    require(objects and view.get("group")=="C" and view.get("revision")==2 and
            {o["id"] for o in objects}=={r["object"] for r in raw_review["checked"]}, "REVIEW_OBJECT_SET")
    for obj in objects:
        span = obj["stateEvidence"] or obj["identityEvidence"]
        matches = [r for r in raw_review["checked"] if r["object"]==obj["id"]]
        require(any((r["quote"] in span["quote"] or span["quote"] in r["quote"])
                    and (obj["state"] is None or obj["state"] in r["registered"])
                    for r in matches), "REVIEW_STATE_EVIDENCE")
    return "model-reviewed-no-omission"
