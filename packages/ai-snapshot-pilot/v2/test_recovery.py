"""Small targeted checks against the outcomes locked before the dialogues."""
import json
from copy import deepcopy
from scene import FIELDS, HERE, TAG, project_frame

def empty(g,r):
    return {"group":g,"revision":r,"tag":TAG,"exclusions":[],"claims":[
        {"field":f,"op":"unknown","status":"unknown","values":None,"delta":[],"previous":None,
         "refs":[],"storyChangeQuote":None} for f in FIELDS]}

def claim(a,field,value,quote,op="set"):
    c=next(c for c in a["claims"] if c["field"]==field)
    c.update(status="complete",op=op,values=value,previous=None if op in ("set","reobserve") else a["revision"]-1,
             refs=[{"group":a["group"],"rev":a["revision"],"quote":quote,"layer":"current","visible":True}])
    return c

def apply(a,previous=None):
    return project_frame(a["group"],a["revision"],a,previous)

def run():
    seen={}
    a=empty("D",1)
    claim(a,"viewpoint",["向东"],"秤台旁")
    claim(a,"perspective",["第一人称"],"我在桐湾验秤亭的秤台旁停下")
    claim(a,"lighting",["灰白天光"],"灰白天光里")
    base=apply(a)
    assert base["values"]["lighting"]=="灰白天光" and base["values"]["count"] is None
    for case,f in [("wrongDirection","perspective"),("directionAsPosition","viewpoint")]:
        assert base["fields"][f]["status"]=="needs-review"
        seen[case]="FIELD_UNKNOWN"
    b=empty("D",2)
    claim(b,"place",["桐湾验秤亭"],"仍在桐湾验秤亭的秤台旁","reobserve")
    claim(b,"viewpoint",["秤台旁"],"仍在桐湾验秤亭的秤台旁","reobserve")
    claim(b,"perspective",["向北"],"自己一直面向北","reobserve")
    claim(b,"lighting",["灰白天光"],"灰白天光依旧","keep")
    v=apply(b,base)
    assert v["values"]["perspective"]=="向北" and v["fields"]["perspective"]["firstKnown"]==2
    assert v["values"]["viewpoint"]=="秤台旁" and base["values"]["viewpoint"] is None
    assert not v["storyChangeCandidates"] and v["values"]["place"]=="桐湾验秤亭"
    seen.update(unknownReobserved="ACCEPT",repairAfterRejected="ACCEPT")
    assert v["fields"]["lighting"]["error"]=="UNBOUND_SCENE"
    seen["unboundPlaceInheritance"]="FIELD_UNKNOWN"
    no_previous=apply(b,None)
    assert no_previous["values"]["place"]=="桐湾验秤亭" and no_previous["fields"]["lighting"]["error"]=="NO_COMPLETE_BASELINE"
    seen["keepAfterMissing"]="FIELD_UNKNOWN"
    a2=deepcopy(a)
    claim(a2,"place",["桐湾验秤亭"],"我在桐湾验秤亭的秤台旁停下")
    known=apply(a2)
    mismatch=deepcopy(b)
    c=claim(mismatch,"lighting",["其他光"],"灰白天光依旧","keep")
    assert apply(mismatch,known)["fields"]["lighting"]["error"]=="KEEP_MISMATCH"
    seen["keepMismatch"]="FIELD_UNKNOWN"
    c["refs"]=[]
    assert apply(mismatch,known)["fields"]["lighting"]["error"]=="NO_CURRENT_EVIDENCE"
    seen["noEvidenceKeep"]="FIELD_UNKNOWN"
    for case,key,value in (("crossScope","group","B"),("future","rev",3),("falseQuote","quote","一段伪引文"),
                           ("noncurrent","layer","dream")):
        bad=deepcopy(b)
        next(c for c in bad["claims"] if c["field"]=="perspective")["refs"][0][key]=value
        assert apply(bad,base)["status"]=="HIDDEN"
        seen[case]="HIDE"
    bad=deepcopy(b)
    ref=next(c for c in bad["claims"] if c["field"]=="perspective")["refs"][0]
    bad["exclusions"]=[dict(ref,layer="reported",visible=False)]
    assert apply(bad,base)["status"]=="HIDDEN"
    seen["overlap"]="HIDE"
    assert apply(b,dict(base,group="B"))["status"]=="HIDDEN"
    c3=empty("C",3)
    assert apply(c3)["values"]["count"] is None
    claim(c3,"people",[],"在场的除我以外再无一人")
    assert apply(c3)["values"]["count"]==0
    seen["unknownVsEmpty"]="DISTINCT"
    assert seen==json.loads((HERE/"rubric.json").read_bytes())["directed"]
    return seen

if __name__=="__main__":
    print(json.dumps(run(),sort_keys=True))
