"""Run the continuous and interrupted journals in separate Python processes."""
import subprocess
import tempfile
from ledger import *

def verify(directory):
    def run(filename,lo,hi):
        args=[sys.executable,"-B",str(HERE/"ledger.py"),str(directory/filename),str(lo),str(hi)]
        res=subprocess.run(args,capture_output=True)
        require(res.returncode==0,res.stderr.decode(errors="replace"))
        return {"command":["python","-B","ledger.py",filename,lo,hi],"exit":res.returncode,
                "stdout":res.stdout.decode().strip()}
    calls=[run("continuous.sqlite",1,14),run("interrupted.sqlite",1,7)]
    db=Journal(directory/"interrupted.sqlite")
    early=db.rows()
    db.close()
    calls.append(run("interrupted.sqlite",8,14))
    a=Journal(directory/"continuous.sqlite"); b=Journal(directory/"interrupted.sqlite")
    try:
        allrows=a.rows()
        require(allrows==b.rows() and early==allrows[:7],"RESTORE_MISMATCH")
        names=[]
        def rejected(label,func):
            before=b.rows()
            try: func()
            except (ValueError,TypeError,KeyError):
                require(before==b.rows(),"PARTIAL_WRITE")
                names.append(label)
            else: raise RuntimeError(label+" accepted")
        b.ingest(1,14)
        require(allrows==b.rows(),"DUPLICATE_MUTATION")
        raw=path("raw",1).read_bytes(); pkt=path("packets",1).read_bytes()
        rejected("conflicting-key",lambda:b.append(SCOPE,1,pkt,raw+b" "))
        rejected("cross-scope",lambda:b.append("foreign",1,pkt,raw))
        fresh=Journal(directory/"rejections.sqlite")
        try:
            rejected("out-of-order",lambda:fresh.append(SCOPE,2,path("packets",2).read_bytes(),path("raw",2).read_bytes()))
            future=read(path("packets",1)); future["prefix"].append(STORY[1])
            rejected("future-prefix",lambda:fresh.append(SCOPE,1,encoded(future),raw))
            bad=read(path("raw",1)); bad["rev"]=2
            rejected("future-envelope",lambda:fresh.append(SCOPE,1,pkt,encoded(bad)))
            bad=read(path("raw",1)); bad["scope"]="foreign"
            rejected("foreign-envelope",lambda:fresh.append(SCOPE,1,pkt,encoded(bad)))
            require(not fresh.rows(),"REJECT_WROTE_ROW")
            bad=read(path("raw",1));bad["fields"]["place"][2]=[STORY[-1]["text"]]
            v=fresh.append(SCOPE,1,pkt,encoded(bad))
            require(v["placeId"] is None and "place" in v["errors"] and v["values"]["count"]==2,"FUTURE_FIELD")
        finally: fresh.close()
        return {"commands":calls,"equalRowsIncludingOriginalBytes":len(allrows),"firstSevenUnchanged":True,
                "duplicatesNoNewRowsOrEvents":True,"rejected":names,"futureQuoteLocallyRejected":True,
                "prefixes":[{"revision":r,"stateHash":sha(view),"chainHash":digest,
                           "events":len(json.loads(view)["events"])} for r,_,_,_,view,digest in allrows]}
    finally: a.close(); b.close()
if __name__=="__main__":
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        print(json.dumps(verify(Path(tmp)),ensure_ascii=True))
