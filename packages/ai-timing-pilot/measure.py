"""Evaluation only. Human-readable and machine-readable first-reply measures from fixed labels."""
from slots import *
def measure():
    rubric=read(HERE/"evaluation/rubric.json")
    author=read(EV/"semantic-review.json")
    cases=[];summaries={}
    dimensions=("importance","visualValue","reliability","intent","conditionalPresentation","evidence","boundary","requiredReasons")
    for g in ("old","new"):
        group=[]
        for i,label in enumerate(rubric[g],1):
            name=slot(g,i);pk,raw,z=paths(name);b=raw.read_bytes();res=read(z);a=json.loads(b)
            assess=author[name];req(assess["rawSha256"]==sha(b),"semantic review binding")
            cp=a["conditionalPresentation"];intent=a["timingIntent"]
            packet_data=read(pk)
            references=[]
            for item in a["evidence"]:
                try:references.append(locate(packet_data,item))
                except (ValueError,IndexError,KeyError,TypeError):references.append(None)
            scores={"importance":len(label)<4 or a["narrativeImportance"]["value"]==label[3],
                    "visualValue":len(label)<5 or a["visualValue"]["value"]==label[4],
                    "intent":intent in label[0].split(),"boundary":res["execution"]==EXEC,
                    "conditionalPresentation":cp["withoutReference"]==("new" if intent=="update" else intent),
                    "evidence":bool(references) and all(references),"reliability":True,"requiredReasons":True}
            for dim in assess["issues"]:scores[dim]=False
            row={"slot":name,"group":g,"rawSha256":sha(b),"intent":intent,"importance":a["narrativeImportance"]["value"],
                "visualValue":a["visualValue"]["value"],"reliability":a["visualReliability"]["value"],"conditional":cp,
                "rubric":label,"scores":scores,"exactReferences":references,"authorReview":assess,"structuralValid":res["valid"],"rejection":res.get("reason"),
                "audit":read(paths("audit-"+name)[2]) if name in rubric["audits"] else None}
            group.append(row);cases.append(row)
        summaries[g]={"n":len(group),"dimensions":{k:sum(r["scores"][k] for r in group) for k in dimensions},
                      "allDimensions":sum(all(r["scores"].values()) for r in group),
                      "intents":{k:sum(r["intent"]==k for r in group) for k in ("update","text-only","defer","needs-review")}}
    return {"cases":cases,"summaries":summaries}
if __name__=="__main__":
    m=measure()
    if sys.argv[1:]==["--capture"]:once(EV/"scores.json",enc(m))
    else:req((EV/"scores.json").read_bytes()==enc(m),"score mismatch")
    print(json.dumps(m["summaries"]))
