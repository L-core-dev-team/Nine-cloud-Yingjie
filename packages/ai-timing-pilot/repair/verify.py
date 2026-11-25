"""Zero-call verifier. --capture writes first receipts exclusively; default checks them."""
import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from replay import HERE, OUTPUT, VERSION, Journal, archive, digest, pilot, source_view, validate


def cases():
    controls = []
    def sample(slot):
        def get(folder):
            return pilot.read(pilot.EV / folder / (slot + ".json"))
        packet = get("packets")
        return packet, get("raw"), source_view(packet)
    def test(label, p, a, view, reason=None):
        result = validate(p, pilot.enc(a), view)
        pilot.req(result["valid"] == (reason is None) and result["reason"] == reason and result["execution"] == pilot.EXEC, label)
        controls.append({"case": label, "accepted": result["valid"], "reason": result["reason"]})
    p, a, v = sample("new06")
    test("局部可见与深处未知同时成立", p, a, v)
    wrong = copy.deepcopy(a)
    wrong["focus"] = ["可见一线瓷白的完整风轮"]
    test("原句不能为未知部件提供身份", p, wrong, v, "focus target not grounded")
    bad = copy.deepcopy(v)
    bad["positive"][0]["target"] = "深处"
    test("更换支持目标的视图不能移用", p, a, bad, "wrong evidence view")
    bad = copy.deepcopy(v)
    bad["positive"][0]["quote"] = "瓷白是风轮"
    test("后添无原文的标注不可放行", p, a, bad, "wrong evidence view")
    p, a, v = sample("new02")
    test("位置成立而声源缺证", p, a, v)
    wrong = copy.deepcopy(a)
    wrong["focus"].append("案卷上的现场落笔")
    test("出现其他合法焦点仍不得搭带缺证主体", p, wrong, v, "focus target not grounded")
    p, a, v = sample("old07")
    test("近处井台可见", p, a, v)
    def altered(suffix, value, reason):
        b = copy.deepcopy(a)
        b["evidence"][-1] = value
        test(suffix, p, b, v, reason)
    altered("首处冲突之后的未来引文", {"rev":8,"quote":"水汽","use":"history"}, "future/source")
    altered("首处冲突之后的无来源引文", {"rev":7,"quote":"手中有灯","use":"focus"}, "ambiguous/missing quote")
    altered("历史冰闸不能作为当前焦点", dict(a["evidence"][-1], use="focus"), "historical-focus")
    altered("假设开闸不能作为当前焦点", dict(a["evidence"][2], use="focus"), "excluded-focus")
    test("异场景回答不可接受", p, dict(a, scope="other-scope"), v, "scope")
    test("模型不得更改启动授权", p, dict(a, send=True), v, "keys")
    b = copy.deepcopy(a)
    b["conditionalPresentation"]["withoutReference"] = "new"
    test("首处冲突之后的无参考分支仍校验", p, b, v, "without-reference mismatch")
    b["timingIntent"] = "update"
    b["visualReliability"]["value"] = "insufficient"
    test("更新意图仍需可见依据", p, b, v, "update requires grounded focus")
    b = copy.deepcopy(a)
    b["conditionalPresentation"].update(withSuitableReference="edit", requiredReferenceConditions=[])
    test("编辑条件仍必填", p, b, v, "reference conditions")
    return controls


def recovery(tmp, group, total, stop):
    one, split = [tmp / (group + suffix + ".sqlite") for suffix in ("-continuous","-resume")]
    def step(db, lo, hi):
        subprocess.run([sys.executable,"-B",str(HERE/"replay.py"),str(db),group,str(lo),str(hi)],check=True)
    step(one, 1, total)
    step(split, 1, stop)
    j = Journal(split)
    before = j.snapshot()
    j.close()
    step(split, stop+1, total)
    a, b = Journal(one), Journal(split)
    try:
        reference = a.snapshot()
        pilot.req(reference == b.snapshot() and reference[:stop] == before, "recovery diverged")
        for data, _ in reference:
            b.save(json.loads(data))
        pilot.req(reference == b.snapshot(), "duplicate effect")
        conflict = json.loads(reference[0][0])
        conflict["bindings"]["evidenceView"] = "other-view"
        try:
            b.save(conflict)
        except ValueError as error:
            pilot.req(str(error) == "same-key conflict", "unexpected error")
        else:
            raise AssertionError("conflict passed")
        pilot.req(reference == b.snapshot(), "conflict modified state")
        return {"splitAfter":stop,"identicalPrefixes":[h for _,h in reference],"duplicatesAdded":0,"conflictRejected":True,
                "processSegments":[[1,total],[1,stop],[stop+1,total]],"segmentExitCodes":[0,0,0]}
    finally:
        a.close()
        b.close()


def main(capture):
    baseline = pilot.read(OUTPUT/"baseline.json")["sha256"]
    for name, fingerprint in baseline.items():
        pilot.req(pilot.sha((pilot.ROOT/name).read_bytes()) == fingerprint, "baseline drift: "+name)
    rows, views, changes = [], [], []
    for group, count in (("old",14),("new",6)):
        for r in range(1,count+1):
            row, view = archive(group,r)
            rows.append(row)
            views.append(view)
            z = row["result"]
            pilot.req(z["execution"] == pilot.EXEC, "execution boundary")
            if row["originalValid"] != z["valid"]:
                slot = row["slot"]
                old = pilot.read(pilot.EV/"results"/(slot+".json"))
                raw = pilot.read(pilot.EV/"raw"/(slot+".json"))
                changes.append({"slot":slot,"before":old,"after":z,"focusAsReceived":raw["focus"],
                                "citationsInRaw":len(raw["evidence"]),"allCitationsChecked":len(raw["evidence"])==len(z["evidence"]),
                                "view":view,"bindings":row["bindings"],"repairIndependentAudits":0})
    controls = cases()
    with tempfile.TemporaryDirectory() as d:
        receipts={g:recovery(Path(d),g,n,s) for g,n,s in (("old",14,7),("new",6,3))}
    pilot.req({c["slot"] for c in changes} == {"old07","new02","new06"} and
              all(c["allCitationsChecked"] and c["after"]["valid"] for c in changes) and
              all(r["result"]["valid"] for r in rows), "acceptance mismatch")
    products = {"rows.jsonl":b"".join(pilot.enc(x)+b"\n" for x in rows),"views.json":pilot.enc(views),
                "changes.json":pilot.enc(changes),"controls.json":pilot.enc(controls),"recovery.json":pilot.enc(receipts)}
    for name,data in products.items():
        if capture:
            pilot.once(OUTPUT/name,data)
        else:
            pilot.req((OUTPUT/name).read_bytes() == data, "receipt drift: "+name)
    print(json.dumps({"status":"TIMING_REPAIR_REPLAY_PASS","originalFiles":len(baseline),"rows":len(rows),"originalAccepted":sum(r["originalValid"] for r in rows),
                      "replayAccepted":sum(r["result"]["valid"] for r in rows),"controls":len(controls),"restored":[14,6],"newModelCalls":0}))


if __name__ == "__main__":
    main(sys.argv[1:] == ["--capture"])
