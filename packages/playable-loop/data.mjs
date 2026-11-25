import {DatabaseSync} from "node:sqlite";
import {join} from "node:path";
import {createHash} from "node:crypto";
export const hash=v=>createHash("sha256").update(typeof v==="string"||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest("hex");
export const blocked={sceneEligible:false,send:false,actualAction:"blocked",dispatchAttempted:false};
export function openStore(directory){
  const db=new DatabaseSync(join(directory,"sidecar.sqlite"));
  db.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY,v TEXT NOT NULL); CREATE TABLE IF NOT EXISTS action(k TEXT PRIMARY KEY, scope TEXT NOT NULL, expected INTEGER NOT NULL, body TEXT NOT NULL, record TEXT); CREATE TABLE IF NOT EXISTS slot(scope TEXT NOT NULL,rev INTEGER NOT NULL,kind TEXT NOT NULL,packet TEXT NOT NULL,status TEXT NOT NULL,raw BLOB,result TEXT,PRIMARY KEY(scope,rev,kind))");
  return {db,get:k=>db.prepare("SELECT v FROM kv WHERE k=?").get(k)?.v,set:(k,v)=>db.prepare("INSERT OR REPLACE INTO kv VALUES(?,?)").run(k,v),
    history:scope=>db.prepare("SELECT record FROM action WHERE scope=? AND record IS NOT NULL ORDER BY expected").all(scope).map(x=>JSON.parse(x.record))};
}
