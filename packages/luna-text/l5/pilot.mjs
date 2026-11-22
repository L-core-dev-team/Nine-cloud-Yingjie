import {existsSync,mkdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {SingleApproval} from "../ledger.mjs";
import {serve} from "../key-entry/server.mjs";
import {stageJournal} from "../key-entry/stages.mjs";
import {extract,inspectSaved} from "../l4/analysis.mjs";
import {east,prose,rejected} from "../../first-play/test/scene-evidence-fixtures.mjs";
import {reply} from "../test/fake.mjs";
import {action,fixtureGrant,fixtureKey,prepare} from "./request.mjs";
import {createRecord,readStatus} from "./audit.mjs";


const html=readFileSync(new URL("./index.html",import.meta.url));
const fixtures=new Map([["complete",prose(east)],["nonexclusive",rejected.nonexclusive]]);
async function originalCard(options) {
  const {journey}=await import("../journey.mjs");
  return journey({...options,live:false});
}
export async function openRehearsal(root,{story="complete",now=Date.now,leaseMs,lifetimeMs,delayReply,checkGate=()=>true,makeServer,runCard=originalCard}={}) {
  if(!fixtures.has(story))throw Error("UNKNOWN_FIXTURE");
  const directory=join(root,"yj-p02-l5-offline");
  mkdirSync(directory,{mode:0o700,recursive:true});
  const journal=stageJournal(join(directory,"audit"));
  const grant=fixtureGrant(journal.runHash,now()+15*60_000);
  const accepted=join(directory,"accepted.json"),dbFile=join(directory,"mock.sqlite");
  const inspect=(held,verified)=>{
    if(!held || !verified || now()>=grant.expiresAt || !checkGate())return ["CHECK_BLOCKED"];
    return existsSync(accepted)||existsSync(dbFile)||existsSync(join(directory,"result.json"))?["APPROVAL_LOCKED"]:[];
  };
  async function execute({takeKey,signal,mark,runHash}){
    let ledger;
    try{createRecord(join(directory,"started.json"),{runHash,mode:"mock-only"});}
    catch{mark("receipt-write-failed");return {status:"RECEIPT_WRITE_FAILED_BEFORE_SEND"};}
    let historyVerified=false;
    const track=stage=>{mark(stage);if(stage==="history-committed")historyVerified=true;};
    let result={status:"START_REJECTED_BEFORE_SEND"};
    try{
      mark("receipt-created");
      ledger=new SingleApproval(dbFile,grant,mark);
      const gate=()=>{
        signal.throwIfAborted();
        if(now()>=grant.expiresAt || !checkGate())throw Error("GATE_DENIED");
      };
      gate();
      const history=await runCard({ledger,takeKey,gate,cancelSignal:signal,
        pilot:{action,prepare,extract,inspectSaved,mark:track,verifyReplay:true,estimateCharge:false,async fakeReply(){
          await delayReply?.();
          const response=reply();
          response.output[0].content[0].text=fixtures.get(story);
          return response;
        }}});
      result={status:"MOCK_HISTORY_VERIFIED",revision:history.revision,scene:history.extraction,history};
    }catch{
      if(!ledger)mark("ledger-unavailable");
      else{
        try{
          const state=ledger.snapshot()?.state;
          if(state==="ACKNOWLEDGED")result.status=historyVerified?"HISTORY_COMMITTED_SCENE_UNVERIFIED":"ACKNOWLEDGED_HISTORY_UNVERIFIED";
          else if(state && state!=="not-sent")result.status="POSSIBLE_SEND_UNCONFIRMED";
        }catch{result.status="POSSIBLE_SEND_UNCONFIRMED";}
      }
    }finally{ledger?.close();}
    try{createRecord(join(directory,"result.json"),{runHash,...result});}
    catch{mark("receipt-write-failed");return {status:"RECEIPT_WRITE_FAILED"};}
    return {status:result.status,scene:result.scene,revision:result.revision};
  }
  const server=await serve({html,journal,retainAccepted:true,inspect,execute,now,lifetimeMs,leaseMs,
    makeServer,beforeAccept:()=>createRecord(accepted,{runHash:journal.runHash,grant}),
    acceptSecret:bytes=>bytes.equals(Buffer.from(fixtureKey))});
  return {...server,directory,runHash:journal.runHash,status:()=>readStatus(directory)};
}
