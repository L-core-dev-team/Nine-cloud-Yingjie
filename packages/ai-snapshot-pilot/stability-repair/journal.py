"""Keep the original transactional journal intact inside a separate repair database."""
import sys
from replay import repair
from source import HERE
from inputs import SCOPE, STORY, OUT as ORIGINAL, encoded, path, read, require, sha
from ledger import Journal
import json

class RepairJournal(Journal):
    def __init__(self,filename):
        super().__init__(filename)
        self.db.execute("CREATE TABLE IF NOT EXISTS repaired (r INTEGER PRIMARY KEY, view BLOB NOT NULL, chain TEXT NOT NULL)")
        self.manifest=read(ORIGINAL/"manifest.json")

    def apply(self,scope,r,request,raw):
        require(scope==SCOPE and type(r) is int and 1<=r<=len(STORY),"REPAIR_SCOPE")
        require(self.manifest[f"packets/{r:02}.json"]==sha(request) and
                self.manifest[f"raw/{r:02}.json"]==sha(raw),"ARCHIVE_BINDING")
        self.db.execute("BEGIN IMMEDIATE")
        try:
            found=self.db.execute("SELECT view FROM repaired WHERE r=?",(r,)).fetchone()
            if found:
                self.db.execute("COMMIT")
                return json.loads(found[0])
            previous=self.db.execute("SELECT r,view,chain FROM repaired ORDER BY r DESC LIMIT 1").fetchone()
            require(r==(previous[0]+1 if previous else 1),"REPAIR_GAP")
            original=self.db.execute("SELECT scope,packet,raw,view FROM revisions WHERE r=?",(r,)).fetchone()
            require(original and original[:3]==(scope,request,raw) and
                    sha(original[3])==self.manifest[f"states/{r:02}.json"],"ORIGINAL_BINDING")
            view=repair(r,json.loads(raw.decode("utf-8-sig")),json.loads(previous[1]) if previous else None)
            data=encoded(view)
            digest=sha(encoded([scope,r,previous[2] if previous else None,sha(request),sha(raw),sha(data)]))
            self.db.execute("INSERT INTO repaired VALUES (?,?,?)",(r,data,digest))
            self.db.execute("COMMIT")
            return view
        except Exception:
            self.db.execute("ROLLBACK")
            raise
    def ingest(self,lo,hi):
        for r in range(lo,hi+1):
            super().ingest(r,r)
            self.apply(SCOPE,r,path("packets",r).read_bytes(),path("raw",r).read_bytes())
    def repaired(self):
        return list(self.db.execute("SELECT r,view,chain FROM repaired ORDER BY r"))

if __name__=="__main__":
    db=RepairJournal(sys.argv[1])
    try:
        db.ingest(int(sys.argv[2]),int(sys.argv[3]))
        row=db.repaired()[-1]
        print(row[0],row[2])
    finally: db.close()
