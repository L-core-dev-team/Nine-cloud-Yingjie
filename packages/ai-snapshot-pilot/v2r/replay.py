"""Read-only replay. Verifies each delivered packet against the actual prior projection."""
import json
from packets import OUT, OLD, HERE, audit_packet, build, encoded, read, sha
from projection import project, review

def check_packet(slot, payload):
    data = (OUT/"packets"/(slot+".json")).read_bytes()
    if data != encoded(payload):
        raise ValueError("PACKET_CHANGED: "+slot)
    return sha(data)

def replay():
    from score import compare, expected
    archived = {r["slot"]:r for r in read(OLD/"new.json")}
    result = {"archived":{}, "new":{}, "reviews":{}}
    def row(raw_path, view, g, r):
        gold = expected(g,r) if g!="D" else read(HERE.parent/"v2/gold-D.json")[r-1]
        return {"rawSha256":sha(raw_path.read_bytes()), "projection":view,
                "literalScore":compare(view["values"],gold) if "values" in view else None}
    def audited(which,path,view):
        slot = "review-"+which
        p = audit_packet(path)
        request_hash = check_packet(slot,p)
        response = OUT/"raw"/(slot+".json")
        try:
            verdict = review(p,read(response),path,view)
            error = None
        except (KeyError,TypeError,ValueError,OSError) as exc:
            verdict,error = "coverage-needs-review",str(exc)
        view["facilityCoverage"] = verdict
        result["reviews"][slot] = {"candidateSha256":p["candidateSha256"],"packetSha256":request_hash,
            "rawSha256":sha(response.read_bytes()) if response.exists() else None,"coverage":verdict,"error":error}
    for g in "BDC":
        prev = None
        for r in range(1,3 if g=="C" else 4):
            slot = g+str(r)
            path = OLD/"raw"/(slot+".json")
            view = project(g,r,read(path),prev,archived=True)
            record = row(path,view,g,r)
            record["originalProjectionStatus"] = archived[slot]["view"]["status"]
            record["originalLiteralScore"] = archived[slot]["projectedScore"]
            if slot=="C2":
                record["beforeReview"] = view.get("facilityCoverage")
                audited("old",path,view)
            result["archived"][slot] = record
            prev = view
    prev = None
    for r in range(1,4):
        slot = "C"+str(r)
        packet_hash = check_packet(slot,build(r,prev))
        path = OUT/"raw"/(slot+".json")
        view = project("C",r,read(path),prev)
        if r==2:
            audited("new",path,view)
        result["new"][slot] = {**row(path,view,"C",r), "packetSha256":packet_hash}
        prev = view
    return result

if __name__ == "__main__":
    print(json.dumps(replay(),ensure_ascii=True,sort_keys=True,indent=2))
