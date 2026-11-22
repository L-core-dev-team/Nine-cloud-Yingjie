import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";

// Exercise ImageTasks itself against small relational tables. PostgreSQL locking/recovery semantics
// are covered by its native suite, not by this single-connection dialect translation.
export class TestPool {
  constructor(path=":memory:"){
    this.db=new DatabaseSync(path);
    this.db.exec("PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL");
    const sql=readFileSync(new URL("../../image-tasks/schema.sql",import.meta.url),"utf8")
      .replace("CREATE SCHEMA IF NOT EXISTS yingjie_image;","").replaceAll("yingjie_image.","");
    this.db.exec(sql);
    this.db.exec("CREATE TABLE IF NOT EXISTS event (scope text, revision integer, event_key text, raw_text_hash text)");
  }
  async connect(){return this;}
  release(){}
  async query(text,args=[]){
    const values=[];
    if(text==="BEGIN" || text==="BEGIN ISOLATION LEVEL SERIALIZABLE")text="BEGIN IMMEDIATE";
    const sql=text.replaceAll("yingjie_image.","").replaceAll("yingjie_scene.","").replaceAll("::int","").replace(/ FOR (?:SHARE|UPDATE)(?: OF a)?/g,"")
      .replaceAll("now()","strftime('%Y-%m-%dT%H:%M:%fZ','now')")
      .replace("UPDATE attempt a SET","UPDATE attempt AS a SET")
      .replace("jsonb_set(record,'{localWait}','\"stopped\"')","json_set(a.record,'$.localWait','stopped')")
      .replace(/jsonb_set\(record,'\{outcome\}',\s*'([^']+)'\)/,"json_set(record,'$.outcome',json('$1'))")
      .replace(/\$(\d+)/g,(_,i)=>{
        let v=args[i-1];
        if(v instanceof Date)v=v.toISOString();
        else if(typeof v==="boolean")v=Number(v);
        else if(v!==null && typeof v==="object")v=JSON.stringify(v);
        values.push(v);return "?";
      });
    const rows=this.db.prepare(sql).all(...values);
    for(const r of rows){
      if(r.record)r.record=JSON.parse(r.record);
      if(r.plan)r.plan=JSON.parse(r.plan);
      if("enabled" in r)r.enabled=Boolean(r.enabled);
    }
    return {rows,rowCount:rows.length};
  }
  close(){this.db.close();}
}
