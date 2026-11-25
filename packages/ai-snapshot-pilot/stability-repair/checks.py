"""Measure the fixed targets and rejection boundaries without supplying them to the projector."""
from copy import deepcopy
from replay import repair
from source import Source, STORY, path, read
from narrative import declaration, discovered_direction, narrative

def run(v):
    def attr(r,n,k):
        return next(o for o in v[r]["objects"] if o["name"]==n)["attributes"][k]
    def val(r,n,k): return attr(r,n,k)["value"]
    def event(r,k): return [e["evidence"]["quote"] for e in v[r][k]]
    def diff(r,n,k): return next(d for d in v[r]["observedDifferences"] if (d["object"],d["attribute"])==(n,k))
    d=diff(10,"水簿","opening")
    goals={
      "R2-attributes-unknown":val(2,"水簿","opening") is None and val(2,"铜盆","contents") is None and
            all(a["lastConfirmedRevision"]==1 for a in [attr(2,"水簿","opening"),attr(2,"铜盆","contents")]),
      "R2-arrangement":all(val(2,n,"arrangement")=="原样摆放" for n in ("铜盆","水簿")),
      "R2-conditional-only":len(v[2]["obligations"])==1 and v[2]["obligations"][0]["status"]=="conditional"
            and not v[2]["payoffLinks"] and not v[2]["visibleEvents"],
      "R4-part-and-opening":val(4,"水簿","opening")=="摊开" and val(4,"水簿","part:页")=="被风掀动了一角",
      "R8-bearing-first-learned":v[8]["values"]["perspective"]=="向西" and v[8]["fields"]["perspective"]["firstKnown"]==8
            and not any("转身" in q for q in event(8,"visibleEvents")),
      "R9-visible-flow":v[9]["obligations"][0]["conditionCandidate"]["revision"]==9 and
            v[9]["obligations"][0]["result"] is None and not v[9]["payoffLinks"],
      "R10-observation-only":(d["before"]["revision"],d["before"]["value"],d["after"]["value"])==(4,"摊开","合拢")
            and d["actor"] is None and d["actualChangeRevision"] is None and
            not any("合拢" in q or "铜盆空了" in q for q in event(10,"visibleEvents")),
      "R11-explicit-same-attribute":val(11,"铜盆","contents")=="空" and attr(11,"铜盆","contents")["evidence"]["rev"]==11,
      "R13-two-attributes":val(13,"水簿","opening")=="摊开" and val(13,"墨迹","moisture")=="湿",
      "R13-payoff-evidence":v[13]["payoffLinks"][0]["declaredAt"]==2 and v[13]["payoffLinks"][0]["conditionAt"]==9
            and v[13]["payoffLinks"][0]["outcome"]["consequence"]=="从这一刻起她自己再不能支用"
            and v[13]["payoffLinks"][0]["status"]=="needs-review",
      "R14-ink-and-book":val(14,"水簿","opening")=="摊开" and val(14,"墨迹","moisture")=="干"
            and "墨迹已经干了" in event(14,"visibleEvents"),
      "occlusion-and-place-scope":v[5]["values"]["people"]==["蒋绫"] and v[5]["values"]["count"] is None
            and not v[7]["objects"] and v[7]["values"]["people"] is None and diff(10,"铜盆","contents")["before"]["revision"]==1
            and v[10]["values"]["count"]==v[11]["values"]["count"]==0}
    assert all(goals.values()),goals
    source=Source(8,{"limits":[],"excluded":[]});q=read(path("raw",8))["fields"]["perspective"][2][0]
    assert discovered_direction(source,"向东",[q],"井栏旁") is None
    for prefix in ("她在井栏旁，","据说我在井栏旁，","若我在井栏旁，","我梦见我在井栏旁，","我曾经在井栏旁，"):
        source.text=prefix+q+"。"
        assert discovered_direction(source,"向西",[q],"井栏旁") is None
    source.text="我在井栏旁，"+q.replace("一直","并非")+"。"
    assert discovered_direction(source,"向西",[q.replace("一直","并非")],"井栏旁") is None
    raw=read(path("raw",13)); raw["objects"][0][1]="摊开在原处"
    invalid=repair(13,raw,v[12])
    assert not any(o["name"]=="墨迹" for o in invalid["objects"])
    assert invalid["objects"][0]["attributes"]["opening"]["value"]=="摊开"
    raw=read(path("raw",4));raw["objects"][0][4]="旁人的衣角"
    invalid=repair(4,raw,v[3])
    assert invalid["objects"][0]["attributes"].get("part:页",{}).get("value") is None
    assert invalid["objects"][0]["attributes"]["opening"]["value"]=="摊开"
    q=read(path("raw",2))["events"][0][1]; src=Source(2,{"limits":[],"excluded":[]})
    for pre in ("若","听说","我梦见","昨天我记起","她打算让"):
        src.text=pre+q+"。"
        assert declaration(src,q,["岑苇"]) is None
    raw=read(path("raw",13)); original=Source(13,v[13]); prior=deepcopy(v[12])
    d=prior["obligations"][0]
    for field,value in (("actor","旁人"),("resource","另一轮水"),("recipient","别处的药圃")):
        prev=deepcopy(prior); prev["obligations"][0]["terms"][field]["value"]=value
        _,links=narrative(original,raw,v[13],prev)
        assert links[0]["status"]=="unlinked"
    prev=deepcopy(prior);prev["obligations"][0]["status"]="needs-review-invalidated"
    assert narrative(original,raw,v[13],prev)[1][0]["status"]=="unlinked"
    prev=deepcopy(prior);prev["obligations"].append(deepcopy(d))
    assert narrative(original,raw,v[13],prev)[1][0]["status"]=="unlinked"
    return {"targetGroups":goals,"adversarial":{"oppositeOtherReportedPastDreamHypotheticalNegatedBearing":"rejected",
        "unassertedMoisture":"absent; opening retained","otherComponent":"unbound",
        "noncurrentDeclaration":"rejected","wrongActorResourceBeneficiaryInvalidatedAmbiguousPromise":"unlinked"}}
