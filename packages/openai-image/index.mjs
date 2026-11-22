import {AttemptSchema,requestKey} from "../contracts/dist/index.js";
import {isDeepStrictEqual} from "node:util";
import {MockImageMoney} from "./money.mjs";
import {Reservations} from "../provider-readiness/reservations.mjs";
import {sha256} from "../image-tasks/files.mjs";
import {buildFrame,model} from "./prompt.mjs";
import {imageRequest,parseImage} from "./protocol.mjs";

export const entry="i1-openai-images-mock";
export const fixtureCredential="i1-offline-fixture";
const diagnostics=new Set(["deadline","http-5xx","redirected","missing-body","response-too-large","invalid-json",
  "unconfirmed-response","wrong-output","invalid-image","invalid-base64","invalid-png","wrong-dimensions",
  "invalid-request-id","invalid-usage","wrong-response-origin"]);
const capability=Object.freeze({schemaVersion:"0.1",entry,origin:"mock",verifiedAt:"2026-11-22T00:00:00Z",
  generate:"supported",referenceEdit:"supported",query:"unknown",cancel:"unknown",idempotency:"unknown"});

export class OpenAIImageProvider {
  constructor({mode,transport,credentialsProvider,resolve,authorizeOutbound,budgetGate,moneyGate,modelConfig,timeoutMs=30000}={}) {
    if(modelConfig!==undefined && modelConfig!==model)throw Error("unsupported-model");
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0||timeoutMs>120000)throw Error("invalid-deadline");
    this.offline=mode==="mock";
    this.capability=this.offline?capability:{...capability,origin:"offline",verifiedAt:null,generate:"unknown",referenceEdit:"unknown"};
    Object.assign(this,{transport,credentialsProvider,resolve,authorizeOutbound,budgetGate,moneyGate,timeoutMs});
  }
  send(claim){
    if(claim.plan?.action==="generate")return this.generate(claim);
    if(claim.plan?.action==="edit")return this.edit(claim);
    return Promise.resolve({state:"refused",reason:"no-call"});
  }
  generate(claim){return this.#exchange("generate",claim);}
  edit(claim){return this.#exchange("edit",claim);}

  async #exchange(operation,claim){
    // A mock callback cannot accidentally open a socket, even if the host miswires it.
    if(!this.offline || process.permission?.has("net")!==false)return {state:"refused",reason:"LIVE_DISABLED"};
    if(this.moneyGate || claim.plan?.action!==operation)return {state:"refused",reason:"local-gate"};
    try{return await (await this.prepare(claim))();}
    catch(error){
      if(error.message==="already-claimed")return {state:"unknown",reason:"prior-reservation"};
      return {state:"refused",reason:"local-gate"};
    }
  }

  // Only an already-built request can cross the boundary. Preparation never calls transport.
  async prepare(claim,db){
    if(!this.offline || process.permission?.has("net")!==false)throw Error("LIVE_DISABLED");
    const a=AttemptSchema.parse(claim.attempt),operation=claim.plan.action;
    const pending=a.outcome.state==="not-sent" && a.outcome.reason==="gate-pending";
    if(a.requestKey!==requestKey(claim.plan) || a.localWait!=="active" ||
      !(db?pending:a.outcome.state==="waiting" && a.sentAt) || !isDeepStrictEqual(a.capability,capability))
      throw Error("invalid-claim");
    if(typeof this.transport!=="function" || await this.credentialsProvider()!==fixtureCredential)throw Error("fixture-only");
    const ctx=await this.resolve(claim,db);
    const frame=buildFrame(claim,ctx),{binding,bindingSha256}=frame;
    const controller=new AbortController();
    const request=imageRequest(frame,fixtureCredential,controller.signal);
    let finish;
    if(this.moneyGate!==undefined){
      if(!(this.moneyGate instanceof MockImageMoney) || !db)throw Error("missing-transaction");
      await this.moneyGate.reserve(db,claim,frame,ctx);
    }else{
      if(!(this.budgetGate instanceof Reservations))throw Error("no-permit");
      const grant=await this.authorizeOutbound(binding),source=claim.plan.target.source;
      if(grant?.provider!==entry || grant.owner!==source.ownerId || grant.sessionId!==source.sessionId ||
         grant.mode!=="mock" || !Array.isArray(grant.images) || !grant.images.includes(bindingSha256) ||
         (operation==="edit" && (grant.externalImageProcessing!==true || !Array.isArray(grant.references) || !grant.references.includes(binding.reference.sha256))))
        throw Error("outbound-not-cleared");
      const identity=sha256(JSON.stringify([entry,binding.scope,binding.eventKey]));
      this.budgetGate.reserve(grant,operation,identity);
      finish=state=>this.budgetGate.finish(identity,state);
    }
    let used=false;
    return onResponse=>{
      if(used)throw Error("already-claimed");
      used=true;return this.#deliver(request,controller,frame,finish,onResponse);
    };
  }
  async #deliver(request,controller,frame,finish,onResponse){
    let timer;
    try{
      const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{
        controller.abort();reject(Error("deadline"));
      },this.timeoutMs);});
      const response=await Promise.race([deadline,(async()=>{
        const raw=await this.transport(request);
        controller.signal.throwIfAborted();
        await onResponse?.();
        if(raw.url && raw.url!==request.url)throw Error("wrong-response-origin");
        return parseImage(raw,controller.signal);
      })()]);
      finish?.(response.state);
      return {...response,origin:"mock",bindingSha256:frame.bindingSha256,promptSha256:frame.binding.promptSha256};
    }catch(error){
      return {state:"unknown",reason:"transport-unconfirmed",diagnostic:diagnostics.has(error?.message)?error.message:"transport-interrupted"};
    }
    finally{clearTimeout(timer);controller.abort();}
  }
}
