"""Deterministic offline validation, model access not used by this command."""
from copy import deepcopy
from pathlib import Path
import subprocess,sys,tempfile
from journal import *
def invoke(db,g,lo,hi):
    args=["python","-B",str(HERE/"journal.py"),str(db),g,str(lo),str(hi)]
    proc=subprocess.run(args,capture_output=True)
    req(proc.returncode==0,proc.stderr.decode(errors="replace"))
    return {"command":["python","-B","journal.py",db.name,g,lo,hi],"exit":proc.returncode}
def replay(g,n,mid,d):
    one=d/(g+"-continuous.sqlite");two=d/(g+"-restart.sqlite")
    run=[invoke(one,g,1,n),invoke(two,g,1,mid)]
    j=Journal(two);early=j.rows();j.db.close()
    run.append(invoke(two,g,mid+1,n))
    a=Journal(one);b=Journal(two)
    try:
        rows=a.rows();req(rows==b.rows() and early==rows[:mid],"restart mismatch")
        b.batch(g,1,n);req(b.rows()==rows,"duplicate effect")
        pp,rp,z=paths(slot(g,1));pk=read(pp);raw=rp.read_bytes()
        for label,payload,response in (("conflict",pk,raw+b" "),("cross",dict(pk,scope="foreign"),raw)):
            try:b.ingest(g,1,payload,response)
            except ValueError:pass
            else:raise AssertionError(label)
        for i,row in enumerate(rows,1):
            pp,rp,z=paths(slot(g,i));req(row[4:7]==(pp.read_bytes(),rp.read_bytes(),z.read_bytes()),"archive drift")
        return {"commands":run,"prefixes":[r[-1] for r in rows],"identical":len(rows),"unchangedEarly":mid,
                "duplicatesAdded":0,"conflictRejected":True,"crossScopeRejected":True}
    finally:a.db.close();b.db.close()
def safety():
    rows=[json.loads(x) for x in SRC.read_bytes().splitlines()]
    row=deepcopy(rows[0]);row["authorTimingBaseline"]="LEAK";row["fields"]["place"]["sourceAction"]="LEAK"
    row["objects"][0]["attributes"]["unexpected"]={"value":"LEAK"}
    req(clean(row)==clean(rows[0]),"allowlist")
    p=packet("old",1,None);raw=read(paths("old01")[1]);req(validate(p,enc(raw))["valid"],"test fixture baseline")
    trials={}
    for key,val in [("send",True),("actualAction","edit"),("actualAction","reuse"),("scope","wrong")]:
        result=validate(p,enc(dict(raw,**{key:val})));req(not result["valid"],key);trials[key+str(val)]=result["reason"]
    bad=deepcopy(raw);bad["evidence"][0]["rev"]=2
    req(not validate(p,enc(bad))["valid"],"future")
    for r in (5,7):
        pk=read(paths(slot("old",r))[0]); ex=pk["sceneCandidate"]["excluded"][0]
        bad=deepcopy(raw);bad.update(revision=r,evidence=[dict(rev=r,quote=ex["quote"],use="focus")])
        req(not validate(pk,enc(bad))["valid"],"excluded")
    with tempfile.TemporaryDirectory() as d:
        j=Journal(Path(d)/"negative.sqlite")
        for tag,payload in (("label",dict(p,authorTimingBaseline="update")),("future",dict(p,prefix=p["prefix"]+[{"rev":2,"text":"future"}]))):
            try:j.ingest("old",1,payload,enc(raw))
            except ValueError as e:trials[tag]=str(e)
            else:raise AssertionError(tag)
        req(j.rows()==[],"rejection wrote row");j.db.close()
    return {"hostNegativeCases":trials,"futureEvidenceAndExcludedFocusRejected":True,"nestedWhitelist":True}
def main(capture):
    names=[slot(g,r) for g,length in (("old",14),("new",6)) for r in range(1,length+1)]
    audits=read(HERE/"evaluation/rubric.json")["audits"]
    access=[]; ledger=[]
    context={x["slot"]:x for x in read(EV/"context-trace.json")}
    for name in names+["audit-"+i for i in audits]:
        pp,rp,z=paths(name);p,b,res=read(pp),rp.read_bytes(),read(z)
        a=read(EV/"access"/(name+".json")); att=read(EV/"attempts"/(name+".json"))
        req(a["outputSha256"]==sha(b) and att["packetSha256"]==sha(enc(p)),"delivery binding")
        t=context[name]
        req(t["rawSha256"]==sha(b) and t["packetSha256"]==sha(enc(p)),"context binding")
        verified=t["onlyPacketRead"] and t["fullPacketReturned"] and not t["inheritedUserConversation"]
        access.append(verified)
        ledger.append({**att,"delivery":"returned","rawSha256":sha(b),"resultSha256":sha(enc(res)),"valid":res["valid"],"verifiedAccess":verified})
        if name.startswith("audit-"):
            cp,cb,cz=paths(name.removeprefix("audit-")); req(p==audit_packet(read(cp),cb.read_bytes(),read(cz)),"audit mismatch")
            req(res["binding"]==p["binding"],"stale audit")
    with tempfile.TemporaryDirectory() as directory:
        results={g:replay(g,n,m,Path(directory)) for g,n,m in (("old",14,7),("new",6,3))}
    checks={"recovery":results,"safety":safety(),"accessChecks":access,"attempts":len(ledger),
            "sourceSha256":sha(SRC.read_bytes()),"allBlocked":all(read(paths(n)[2])["execution"]==EXEC for n in names)}
    for name,data in [("replay.json",checks),("ledger.json",ledger)]:
        if capture:once(EV/name,enc(data))
        else:req((EV/name).read_bytes()==enc(data),"non-deterministic "+name)
    print(json.dumps({"prefixes":[r["identical"] for r in results.values()],"accessVerified":sum(access),"slots":len(ledger),"allBlocked":checks["allBlocked"]}))
if __name__=="__main__":main(sys.argv[1:]==["--capture"])
