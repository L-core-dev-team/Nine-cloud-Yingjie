// Operator-only replay of the pinned L1 sample. No provider, HTTP host or image planner is loaded.
import {DatabaseSync} from "node:sqlite";
import {createHash} from "node:crypto";
import {userInfo,tmpdir} from "node:os";
import {basename,dirname,join} from "node:path";
import {pathToFileURL} from "node:url";
import {cp,lstat,mkdtemp,readFile,readdir,realpath,rm} from "node:fs/promises";
import {existsSync,createReadStream} from "node:fs";
import {execFileSync} from "node:child_process";
import {isDeepStrictEqual} from "node:util";
import {cardScope,hash,consume} from "../../scene-state/store.mjs";
import {project} from "../../scene-state/project.mjs";
import {eventKey,fromCardHistory} from "../../contracts/dist/index.js";
import {extractContinuity} from "../continuity.mjs";
import {sentences} from "../extract.mjs";
import {extractInitialSurvey} from "../initial-survey.mjs";

const expected="1c65286041ae74ccae956c08bdca02b3e91f9273411834c83adbd98071e23f98";
function check(ok,code){if(!ok)throw Error(code);}
async function fingerprint(path){
  const tree=createHash("sha256");
  async function visit(p){
    const stat=await lstat(p);
    check(!stat.isSymbolicLink(),"LINK_IN_SOURCE");
    if(stat.isDirectory()){
      for(const name of (await readdir(p)).sort()){
        tree.update(JSON.stringify(name));await visit(join(p,name));
      }
    }else{
      check(stat.isFile(),"NON_FILE_IN_SOURCE");
      const file=createHash("sha256");for await(const chunk of createReadStream(p))file.update(chunk);
      tree.update(file.digest());
    }
    tree.update("\n");
  }
  await visit(path);return tree.digest("hex");
}
function approval(file){
  const db=new DatabaseSync(file,{readOnly:true});
  try{
    const rows=db.prepare("SELECT id,binding,state,receipt FROM pilot").all();
    check(rows.length===1 && rows[0].id==="YJ-P02-L1-single-luna-text" && rows[0].state==="ACKNOWLEDGED","APPROVAL_MISMATCH");
    check(JSON.parse(rows[0].receipt).bodySha256===expected,"RECEIPT_HASH_MISMATCH");
    return JSON.parse(rows[0].binding);
  }finally{db.close();}
}
async function readonly(pool,fn){
  const db=await pool.connect();
  try{await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");return await fn(db);}
  finally{try{await db.query("ROLLBACK");}finally{db.release();}}
}
async function replay(copy,binding){
  process.env.YJ13_CLUSTER=copy;
  const {cardRuntime,statePool,withDatabase,upstream}=await import("../../scene-state/test/local-db.mjs");
  const {start,stop}=await import("../../local-demo/cluster.mjs");
  const {CardImportService}=await import(pathToFileURL(join(upstream,"apps/api/dist/card-import/service.js")));
  const cards=cardRuntime().pool;
  let started=false,projection;
  try{
    start(copy,{port:cards.options.port});started=true;
    return await readonly(cards,async card=>{
      const databases=(await card.query("SELECT datname FROM pg_database WHERE datname ~ '^yj04_test_[a-f0-9]{32}$'")).rows;
      check(databases.length===1,"PROJECTION_NOT_UNIQUE");projection=statePool(databases[0].datname);
      return readonly(projection,async scene=>{
        const actual=(await scene.query("SHOW data_directory")).rows[0].data_directory;
        check(await realpath(actual)===await realpath(join(copy,"postgres")),"WRONG_CLUSTER");
        const {rows}=await scene.query(`SELECT e.*,s.state,s.revision AS highwater,x.audit
          FROM yingjie_scene.event e JOIN yingjie_scene.stream s USING(scope)
          JOIN yingjie_play.extraction x ON x.scope=e.scope AND x.revision=e.revision WHERE e.raw_text_hash=$1 AND e.revision=1`,[expected]);
        check(rows.length===1,"SOURCE_ROW_NOT_UNIQUE");const [event]=rows;
        const {ownerId,sessionId,key}=event.source;
        check(hash(ownerId)===binding.ownerHash && hash(sessionId)===binding.sessionHash &&
          hash(key)===binding.actionKeyHash && event.scope===cardScope(ownerId,sessionId),"SCOPE_MISMATCH");
        const service=new CardImportService(card);
        const history=await service.history(ownerId,sessionId,0);
        check(history.length===1 && history[0].key===key && history[0].resulting_revision===1,"HISTORY_MISMATCH");
        const [row]=history,source=fromCardHistory(ownerId,sessionId,row).source;
        check(isDeepStrictEqual(source,event.source) && eventKey(source)===event.event_key,"SOURCE_KEY_MISMATCH");
        const body=row.narrative;
        check(hash(body)===expected && hash(body.trim())===event.normalized_text_hash &&
          hash(JSON.stringify([event.event_key,1,row.action,body]))===event.input_hash,"BODY_MISMATCH");
        const original=await service.request(ownerId,sessionId,key);
        check(original.status==="completed" && original.narrative===body && original.resulting_revision===1,"NOT_COMPLETED");
        check(!(await card.query("SELECT 1 FROM card_import.group_participants WHERE owner_id=$1 AND session_id=$2 LIMIT 1",[ownerId,sessionId])).rowCount,"NOT_ORDINARY");
        check((await service.session(ownerId,sessionId)).revision===1 && event.highwater===1 &&
          (await scene.query("SELECT count(*)::int AS n FROM yingjie_scene.event WHERE scope=$1",[event.scope])).rows[0].n===1,"STREAM_MISMATCH");
        // L1's sync at revision zero initializes this fresh state before the first action.
        const state={current:null,places:[],reason:"no-history",imageLedger:"fresh"};
        const narrative=body.trim(),out=extractContinuity({source,state,narrative,action:row.action.trim()});
        const result=project(state,source,out.observations);
        check(isDeepStrictEqual(out.audit,event.audit) && isDeepStrictEqual(result,event.result) &&
          isDeepStrictEqual(out.observations,event.observations) && isDeepStrictEqual(state,event.state),"REPLAY_MISMATCH");
        const images=(await scene.query(`SELECT (SELECT count(*)::int FROM yingjie_image.task) AS tasks,
          (SELECT count(*)::int FROM yingjie_image.attempt) AS attempts`)).rows[0];
        check(images.tasks===0 && images.attempts===0,"IMAGE_COUNT_MISMATCH");
        const chunks=sentences(narrative)??[];
        if(process.argv.includes("--check-staged")){
          const diff=execFileSync("git",["diff","--cached","--no-ext-diff","--unified=0"],{encoding:"utf8",windowsHide:true});
          check([body,...chunks.map(c=>c.value),ownerId,sessionId,key].every(value=>!diff.includes(value)),"PRIVATE_VALUE_IN_DIFF");
        }
        const shadow=await withDatabase(async pool=>{
          for(const path of ["../../image-tasks/schema.sql","../schema.sql"])
            await pool.query(await readFile(new URL(path,import.meta.url),"utf8"));
          const saved={source,revision:1,action:row.action,rawNarrative:body};
          check(await consume(pool,saved,extractInitialSurvey)==="applied" &&
            await consume(pool,saved,extractInitialSurvey)==="duplicate","SHADOW_WRITE");
          const [entry]=(await pool.query(`SELECT raw_text_hash,result,audit FROM yingjie_scene.event
            JOIN yingjie_play.extraction USING(scope,revision) WHERE scope=$1 AND revision=1`,[event.scope])).rows;
          check(entry.raw_text_hash===expected && entry.audit.replayOnly && entry.audit.method==="zh-visible-clause/3" &&
            entry.result.status==="not-ready" && entry.result.reason==="incomplete-initial-survey" &&
            isDeepStrictEqual(entry.audit.partialFacts?.map(f=>[f.field,f.values.length]),
              [["lighting",1],["observedFeatures",2],["observedPeople",3]]),"SHADOW_RESULT");
          const counts=(await pool.query(`SELECT (SELECT count(*)::int FROM yingjie_image.task) AS tasks,
            (SELECT count(*)::int FROM yingjie_image.attempt) AS attempts`)).rows[0];
          check(!counts.tasks && !counts.attempts,"SHADOW_IMAGE_ACTIVITY");
          return {method:entry.audit.method,replayOnly:true,reason:entry.result.reason,result:entry.result.status,
            evidence:entry.audit.evidence,partialFields:(entry.audit.partialFacts??[]).map(f=>({field:f.field,
              valueCount:f.values.length,evidenceIndex:f.evidenceIndex})),duplicateSuppressed:true,images:counts};
        });
        return {sha256:expected,utf16Length:body.length,utf8Bytes:Buffer.byteLength(body),revision:1,
          history:"completed-history",bindingMatches:true,priorEvents:0,priorPlaces:0,priorCurrent:null,
          result:result.status,reason:result.reason,method:out.audit.method,evidence:out.audit.evidence,
          observations:out.observations.map(x=>({type:x.operation.type,reason:x.operation.reason})),
          sentences:chunks.map(({start,length})=>({start,length})),storedAuditStateResultMatch:true,images,
          shadow};
      });
    });
  }finally{
    try{await projection?.end();await cards.end();}finally{if(started)stop(copy);}
  }
}

async function main(){
  const [name]=process.argv.slice(2);
  check(/^(?:yj13-demo-)[A-Za-z0-9]{6}$/.test(name??""),"SOURCE_UNAVAILABLE");
  const home=userInfo().homedir,root=process.platform==="win32"?join(home,"AppData/Local/Temp"):tmpdir();
  const source=join(root,name),ledger=join(home,".nine-cloud-yingjie/yj-p02-l1/approval.sqlite");
  check(existsSync(join(source,"state.json")) && existsSync(join(source,"postgres/PG_VERSION")),"SOURCE_UNAVAILABLE");
  const before=await fingerprint(ledger),binding=approval(ledger);
  // Compare only fixture directory metadata to the verified L1 receipt before copying anything.
  const receiptDir=dirname(ledger);
  const receipts=(await readdir(receiptDir)).filter(n=>/^ui-receipt-[\da-f-]+\.json$/i.test(n));
  const matched=[];
  for(const name of receipts){
    const file=join(receiptDir,name),r=JSON.parse(await readFile(file,"utf8"));
    if(r.status==="LUNA_ONE_CALL_PASS" && r.history?.bodySha256===expected &&
       r.reservation?.actionKeyHash===binding.actionKeyHash)matched.push((await lstat(file)).mtimeMs);
  }
  check(matched.length===1,"SOURCE_UNAVAILABLE");
  const candidates=[];
  for(const item of await readdir(root,{withFileTypes:true})){
    if(!item.isDirectory() || !/^yj13-demo-[A-Za-z0-9]{6}$/.test(item.name))continue;
    const pg=join(root,item.name,"postgres");
    if(existsSync(join(pg,"PG_VERSION")) && Math.abs((await lstat(pg)).mtimeMs-matched[0])<10_000)
      candidates.push(item.name);
  }
  check(candidates.length===1 && candidates[0]===name,"SOURCE_UNAVAILABLE");
  check(!existsSync(join(source,"postgres/postmaster.pid")),"SOURCE_NOT_STOPPED");
  const binary=process.platform==="win32"?"pg_controldata.exe":"pg_controldata";
  const controlBin=[process.env.CARD_DEMO_POSTGRES_BIN,process.env.YJ_PG_CLIENT_BIN].filter(Boolean)
    .map(dir=>join(dir,binary)).find(existsSync);
  check(controlBin,"MISSING_PG_CONTROLDATA");
  const control=execFileSync(controlBin,[join(source,"postgres")],
    {windowsHide:true,env:{...process.env,LC_ALL:"C"},encoding:"utf8"});
  check(/^Database cluster state:\s+shut down\s*$/m.test(control),"UNCLEAN_SHUTDOWN");
  const original=await fingerprint(source),tmp=await realpath(tmpdir()),copy=await mkdtemp(join(tmp,"yj-l2-copy-"));
  let result;
  try{
    await cp(source,copy,{recursive:true});
    check((await fingerprint(copy))===original,"COPY_MISMATCH");
    result=await replay(copy,binding);
  }finally{
    const target=await realpath(copy);
    check(dirname(target)===tmp && basename(target).startsWith("yj-l2-copy-"),"CLEANUP_SCOPE");
    check(!existsSync(join(target,"postgres/postmaster.pid")),"COPY_STILL_RUNNING");
    await rm(target,{recursive:true,force:true});
    check((await fingerprint(source))===original && (await fingerprint(ledger))===before,"ORIGINAL_CHANGED");
  }
  console.log(JSON.stringify({...result,originalClusterUnchanged:true,approvalFileUnchanged:true,approvalState:"ACKNOWLEDGED",
    newTextCalls:0,newImageCalls:0,newCostUsd:0}));
}
try{await main();}catch(e){
  const code=/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:"LOCAL_AUDIT_ERROR";
  console.error(JSON.stringify({status:code==="SOURCE_UNAVAILABLE"?"SOURCE_UNAVAILABLE":"PARTIAL",code}));
  process.exitCode=1;
}
