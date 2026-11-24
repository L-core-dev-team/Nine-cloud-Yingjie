"""Prepare a single fresh dialogue or replay immutable first replies. No model transport."""
import argparse
import json
from pathlib import Path
from scene import HERE, encoded, packet, project_frame, sha
from dialogue import unique

EVIDENCE = HERE.parents[2]/"docs/reports/evidence/YJ-P04-AI-SNAPSHOT-02"
OLD = EVIDENCE.parent/"YJ-P04-AI-SNAPSHOT-01/dialogue/raw"


def write_once(path, data):
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists():
        if path.read_bytes()!=data:
            raise ValueError("CAPTURE_ALREADY_EXISTS: "+path.name)
    else:
        with path.open("xb") as stream:
            stream.write(data)


def read_frame(path,g,r,previous,legacy=False):
    from scene import hidden
    try:
        answer=json.loads(path.read_bytes().decode("utf-8-sig"),object_pairs_hook=unique)
    except (ValueError,UnicodeError) as error:
        return hidden(g,r,str(error))
    return project_frame(g,r,answer,previous,legacy=legacy)


def prepare(g,r):
    previous=None
    for i in range(1,r):
        previous=read_frame(EVIDENCE/"raw"/f"{g}{i}.json",g,i,previous)
    data=encoded(packet(g,r,previous))
    write_once(EVIDENCE/"packets"/f"{g}{r}.json",data)
    return sha(data)


def compare_all(legacy):
    # Never imported while preparing participant packets.
    from score import compare, expected
    folder=OLD if legacy else EVIDENCE/"raw"
    result=[]
    for g in ("ABC" if legacy else "BCD"):
        previous=None
        for r in range(1,4):
            slot=f"{g}{r}"
            path=folder/(slot+".json")
            if not legacy:
                packet_bytes=encoded(packet(g,r,previous))
                assert (EVIDENCE/"packets"/(slot+".json")).read_bytes()==packet_bytes
            view=read_frame(path,g,r,previous,legacy)
            reference=expected(g,r) if g!="D" else json.loads((HERE/"gold-D.json").read_bytes())[r-1]
            row={"slot":slot,"rawSha256":sha(path.read_bytes()),"view":view,"rawScore":None,"projectedScore":None}
            if not legacy:
                row["packetSha256"]=sha(packet_bytes)
            try:
                a=json.loads(path.read_bytes().decode("utf-8-sig"),object_pairs_hook=unique)
                raw={}
                for c in a["claims"]:
                    if c["status"]=="complete":
                        raw[c["field"]]=c["values"] if c["field"] in ("people","features") else c["values"][0]
                raw["count"]=None if raw.get("people") is None else len(raw["people"])
                row["rawScore"]=compare(raw,reference)
            except (UnicodeError,KeyError,IndexError,TypeError,ValueError):
                row["rawError"]="UNSCORABLE"
            if view["status"]!="HIDDEN":
                row["projectedScore"]=compare(view["values"],reference)
                row["partialRosterMatch"]=sorted(view["partial"].get("people",[]))==sorted(reference["partialPeople"])
                row["excludedLayersMatch"]=sorted({e["layer"] for e in view["excluded"]})==sorted(reference["excluded"])
                row["changedMatch"]=view["changed"]==reference["changed"] or (
                    view["changed"] is not None and reference["changed"] is not None
                    and sorted(view["changed"])==sorted(reference["changed"]))
            result.append(row)
            previous=view
    return result


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode",choices=("prepare","new","legacy"))
    parser.add_argument("slot",nargs="?")
    args=parser.parse_args()
    if args.mode=="prepare":
        if args.slot not in [g+str(i) for g in "BCD" for i in range(1,4)]:
            parser.error("slot must be B1..D3")
        print(prepare(args.slot[0],int(args.slot[1])))
    else:
        print(json.dumps(compare_all(args.mode=="legacy"),ensure_ascii=True,indent=2))
