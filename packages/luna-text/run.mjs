import {join} from "node:path";
import {userInfo,tmpdir} from "node:os";
import {existsSync} from "node:fs";
import {mkdir,mkdtemp,open,rm} from "node:fs/promises";
import {preflight,priceDate,modelId,prepare,action,ceilingNanoUsd,reserveNanoUsd} from "./adapter.mjs";
import {SingleApproval} from "./ledger.mjs";

const [mode="preflight",out]=process.argv.slice(2);
if(!["preflight","fake","live"].includes(mode))throw Error("use preflight, fake or live");
const key=process.env.OPENAI_API_KEY;
delete process.env.OPENAI_API_KEY; // No credentials inherited by git, PostgreSQL, build or Chrome.
const projectDate=process.env.YJ_L1_PROJECT_STANDARD_VERIFIED_ON;
const blockers=()=>preflight(key,projectDate);
const liveDir=join(userInfo().homedir,".nine-cloud-yingjie","yj-p02-l1");
const liveFile=join(liveDir,"approval.sqlite");
let db,temp;
const receipt=out?await open(out,"wx",0o600):null;
const report={mode,keyConfigured:Boolean(key?.trim()),model:modelId,pricingCheckedBeijing:priceDate,
  inputBound:prepare({action}).inputBound,ceilingNanoUsd,reserveNanoUsd,realPossibleSends:0,realImageCalls:0,
  actualUsage:null,estimatedCostUsd:null};
function gate() {
  const failures=blockers();
  if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==="0")failures.push("TLS_POLICY_NOT_VERIFIED");
  if(failures.length)throw Error(failures.join(","));
}
try{
  if(mode!=="fake" && existsSync(liveFile)) {
    db=new SingleApproval(liveFile);
    if(db.snapshot())throw Error("APPROVAL_LOCKED");
  }
  if(mode!=="fake")gate();
  if(mode==="preflight")report.status="READY_FOR_LOCAL_GATES";
  else{
    const live=mode==="live";
    if(live && !receipt)throw Error("NEW_RECEIPT_PATH_REQUIRED");
    if(live){await mkdir(liveDir,{recursive:true,mode:0o700});db??=new SingleApproval(liveFile);}
    else{temp=await mkdtemp(join(tmpdir(),"luna-rehearsal-"));db=new SingleApproval(join(temp,"fake.sqlite"));}
    const {journey}=await import("./journey.mjs");
    report.history=await journey({live,ledger:db,key:live?key:"local-placeholder",gate:live?gate:()=>{}});
    report.status=live?"LUNA_ONE_CALL_PASS":"OFFLINE_PASS";
  }
}catch(e){
  const reason=String(e.message);
  const known=/^(API_KEY_NOT_CONFIGURED|PROJECT_MODEL_STANDARD_ACCESS_UNCONFIRMED|BUDGET_GATE_NOT_VERIFIED|TLS_POLICY_NOT_VERIFIED|APPROVAL_LOCKED|NEW_RECEIPT_PATH_REQUIRED)(,(API_KEY_NOT_CONFIGURED|PROJECT_MODEL_STANDARD_ACCESS_UNCONFIRMED|BUDGET_GATE_NOT_VERIFIED|TLS_POLICY_NOT_VERIFIED))*$/;
  report.reasons=known.test(reason)?reason.split(","):["LOCAL_VERIFICATION_INCOMPLETE"];
  report.status=mode==="fake"?"OFFLINE_FAIL":"LIVE_BLOCKED";
  if(mode==="fake")console.error(e.stack);
  process.exitCode=mode==="fake"?1:2;
}finally{
  const snapshot=db?.snapshot();
  if(snapshot){
    report.reservation=snapshot;
    if(mode!=="fake" && snapshot.state!=="not-sent"){
      report.realPossibleSends=1;
      report.actualUsage=snapshot.usage??null;
      const cost=snapshot.usage?.estimatedNanoUsd;
      report.estimatedCostUsd=cost==null?null:cost/1e9;
      if(report.status!=="LUNA_ONE_CALL_PASS"){
        const stopped={REJECTED_STOP:"REJECTED_STOP",FAIL:"FAIL",ACKNOWLEDGED:"ACKNOWLEDGED_HISTORY_UNVERIFIED"};
        report.status=stopped[snapshot.state]??"UNKNOWN_STOP";
      }
    }
  }
  db?.close();
  if(temp)await rm(temp,{recursive:true,force:true});
  const text=JSON.stringify(report,null,2)+"\n";
  try {await receipt?.writeFile(text);}finally{await receipt?.close();}
  console.log(text);
}
