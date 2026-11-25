"""Persist recommendations from archived inputs only, with experiment and both source scopes in the key."""
import sqlite3,sys
from slots import *
class Journal:
    def __init__(self,path):
        self.db=sqlite3.connect(path,isolation_level=None)
        self.db.execute("CREATE TABLE IF NOT EXISTS chain (protocol TEXT, cohort TEXT, scope TEXT, rev INTEGER, packet BLOB, raw BLOB, result BLOB, digest TEXT, PRIMARY KEY(protocol,cohort,scope,rev))")
    def rows(self):
        return list(self.db.execute("SELECT * FROM chain ORDER BY protocol,cohort,scope,rev"))
    def ingest(self,g,r,p,b):
        scope=sources(g)[0]["scope"]; version=POL["version"]; pk=(version,g,scope,r)
        req((p["protocol"],p["scope"],p["revision"])==(version,scope,r),"scope")
        self.db.execute("BEGIN IMMEDIATE")
        try:
            old=self.db.execute("SELECT packet,raw FROM chain WHERE protocol=? AND cohort=? AND scope=? AND rev=?",pk).fetchone()
            if old:
                req(old==(enc(p),b),"conflicting-key")
            else:
                last=self.db.execute("SELECT rev,packet,raw,result,digest FROM chain WHERE protocol=? AND cohort=? AND scope=? ORDER BY rev DESC LIMIT 1",pk[:3]).fetchone()
                req(r==(last[0]+1 if last else 1),"gap")
                prior=previous(json.loads(last[1]),last[2],json.loads(last[3])) if last else None
                req(p==packet(g,r,prior),"packet-contamination-or-prefix")
                z=validate(p,b);digest=sha(enc([pk,last[-1] if last else None,sha(enc(p)),sha(b),sha(enc(z))]))
                self.db.execute("INSERT INTO chain VALUES (?,?,?,?,?,?,?,?)",(*pk,enc(p),b,enc(z),digest))
            self.db.execute("COMMIT")
        except Exception:
            self.db.execute("ROLLBACK");raise
    def batch(self,g,lo,hi):
        for r in range(lo,hi+1):
            pp,b,z=paths(slot(g,r));self.ingest(g,r,read(pp),b.read_bytes())
if __name__=="__main__":
    j=Journal(sys.argv[1]);j.batch(sys.argv[2],int(sys.argv[3]),int(sys.argv[4]));j.db.close()
