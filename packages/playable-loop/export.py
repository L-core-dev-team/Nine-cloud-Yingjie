"""Export bounded research evidence, without exporting account, connection or session tables."""
import hashlib,json,sqlite3,sys
from session import BASE,HERE
root=HERE.parents[1];ev=root/"docs/reports/evidence/YJ-P05-PLAYABLE-LOOP-01"
def save(p,v):
    data=(json.dumps(v,ensure_ascii=False,indent=2)+"\n").encode()
    if p.exists():
        assert p.read_bytes()==data
    else:p.write_bytes(data)
def export(name):
    assert name in ("demo","rehearsal")
    con=sqlite3.connect((BASE/name/"sidecar.sqlite").as_uri()+"?mode=ro",uri=True)
    rounds=[json.loads(b) for b, in con.execute("select record from action where record is not null order by expected")]
    assert len(rounds)==8 and [h["revision"] for h in rounds]==list(range(1,9))
    slots=[]
    for rev,kind,packet,status,raw,result in con.execute("select rev,kind,packet,status,raw,result from slot order by rev,kind"):
        p=json.loads(packet);h=rounds[rev-1];assert p["scope"]==h["scope"] and p["bodySha"]==h["bodySha"] and p["prefix"][-1]["text"]==h["text"]
        slot=kind+f"{rev:02}"
        row=dict(revision=rev,kind=kind,status=status,packetSha=hashlib.sha256(packet.encode()).hexdigest(),result=json.loads(result) if result else None)
        if name=="demo":
            row["sourceBinding"]={k:h[k] for k in ("ownerHash","saveHash","branch","revision","requestKey","receiptSha","bodySha","ruleVersion","canonVersion")}
            assert (ev/"packets"/(slot+".json")).read_bytes()==packet.encode()
            assert (ev/"raw"/(slot+".json")).read_bytes()==raw
            trace=json.loads((ev/"access"/(slot+".json")).read_bytes());assert trace["packetSha"]==row["packetSha"] and trace["rawSha"]==hashlib.sha256(raw).hexdigest()
            row.update(rawSha=trace["rawSha"],resultSha=hashlib.sha256(result.encode()).hexdigest(),trace=trace)
        slots.append(row)
    con.close()
    save(ev/(name+"-export.json"),{"instance":name,"rounds":rounds,"slots":slots})
    print(name,len(rounds),len(slots),sum(s["status"]=="returned" for s in slots))
if __name__=="__main__":export(sys.argv[1])
