"""An isolated append-only SQLite journal for the frozen research session."""
import sqlite3
from chain import *

class Journal:
    def __init__(self, filename):
        self.db=sqlite3.connect(filename,isolation_level=None)
        self.db.execute("CREATE TABLE IF NOT EXISTS revisions (r INTEGER PRIMARY KEY, scope TEXT, packet BLOB, raw BLOB, view BLOB, chain TEXT)")
    def close(self): self.db.close()
    def rows(self):
        return list(self.db.execute("SELECT r,scope,packet,raw,view,chain FROM revisions ORDER BY r"))
    def at(self,r):
        row=self.db.execute("SELECT view FROM revisions WHERE r=?",(r,)).fetchone()
        return json.loads(row[0]) if row else None
    def append(self,scope,r,request,raw):
        require(scope==SCOPE and type(r) is int and 1<=r<=len(STORY),"HOST_SCOPE_OR_REV")
        self.db.execute("BEGIN IMMEDIATE")
        try:
            found=self.db.execute("SELECT scope,packet,raw,view FROM revisions WHERE r=?",(r,)).fetchone()
            if found:
                require(found[:3]==(scope,request,raw),"CONFLICTING_REVISION")
                view=json.loads(found[3])
            else:
                last=self.db.execute("SELECT r,view,chain FROM revisions ORDER BY r DESC LIMIT 1").fetchone()
                require(r==(last[0]+1 if last else 1),"GAP")
                prev=json.loads(last[1]) if last else None
                require(request==encoded(packet(r,prev)),"PREFIX_MISMATCH")
                from dialogue import unique
                answer=json.loads(raw.decode("utf-8-sig"),object_pairs_hook=unique)
                view=project(r,answer,prev)
                digest=sha(encoded([scope,r,last[2] if last else None,sha(request),sha(raw),sha(encoded(view))]))
                self.db.execute("INSERT INTO revisions VALUES (?,?,?,?,?,?)",(r,scope,request,raw,encoded(view),digest))
            self.db.execute("COMMIT")
            return view
        except Exception:
            self.db.execute("ROLLBACK")
            raise
    def ingest(self,lo,hi):
        for r in range(lo,hi+1):
            view=self.append(SCOPE,r,path("packets",r).read_bytes(),path("raw",r).read_bytes())
            require(encoded(view)==path("states",r).read_bytes(),"SAVED_VIEW_MISMATCH")

if __name__=="__main__":
    journal=Journal(sys.argv[1])
    try:
        journal.ingest(int(sys.argv[2]),int(sys.argv[3]))
        print("last revision and chain SHA:",journal.rows()[-1][::5])
    finally:
        journal.close()
