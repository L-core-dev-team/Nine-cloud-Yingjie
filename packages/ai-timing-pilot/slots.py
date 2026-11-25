"""Reserve once before delivery. Never calls a model. Slot directories contain only their packet."""
import sys
from pilot import *
INBOX=ROOT.parent/"timing-inbox"
def paths(name):
    return EV/"packets"/(name+".json"),EV/"raw"/(name+".json"),EV/"results"/(name+".json")
def prepare(name):
    audit=name.startswith("audit-");slotname=name.removeprefix("audit-")
    m=re.fullmatch(r"(old|new)(\d{2})",slotname);req(m,"slot")
    group,r=m[1],int(m[2]);dest,_,_=paths(name)
    if audit:
        req(slotname in read(HERE/"evaluation/rubric.json")["audits"],"audit slot")
        pk,raw,result=paths(slotname);p=audit_packet(read(pk),raw.read_bytes(),read(result))
    else:
        prior=None
        if r>1:
            pk,raw,result=paths(slot(group,r-1));prior=previous(read(pk),raw.read_bytes(),read(result))
        p=packet(group,r,prior)
    once(dest,enc(p));once(INBOX/name/"input.json",enc(p))
    ledger=EV/"attempts"/(name+".json");req(not ledger.exists(),"already reserved: stop")
    once(ledger,enc({"experiment":"timing/1","slot":name,"kind":"audit" if audit else "candidate","attempt":1,
                     "scope":p["scope"],"revision":r,"packetSha256":sha(enc(p)),"delivery":"reserved-before-send"}))
def finish(name):
    pk,raw,result=paths(name);p=read(pk);b=raw.read_bytes()
    if name.startswith("audit-"):
        try:
            a=json.loads(b);req((a["scope"],a["revision"])==(p["scope"],p["revision"]) and set(a["checks"])=={"importance","visual","evidence","cadence","conditions"} and all(isinstance(x,str) and x for x in a["checks"].values()),"audit shape")
            req(a["verdict"] in ("supported","needs-review","major-error") and isinstance(a["findings"],list) and a["evidence"],"audit fields")
            z={"valid":True,"verdict":a["verdict"],"evidence":[locate(p["packet"],e) for e in a["evidence"]],"binding":p["binding"]}
        except (ValueError,KeyError,TypeError) as ex:z={"valid":False,"reason":str(ex),"binding":p["binding"]}
    else:z=validate(p,b)
    once(result,enc(z));print(name,z["valid"],z.get("reason"),z.get("verdict"))
if __name__=="__main__":
    for name in sys.argv[2:]: (prepare if sys.argv[1]=="prepare" else finish)(name)
