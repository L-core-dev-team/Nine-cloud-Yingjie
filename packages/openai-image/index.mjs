import {AttemptSchema,requestKey} from "../contracts/dist/index.js";
import {isDeepStrictEqual} from "node:util";
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
  constructor({mode,transport,credentialsProvider,resolve,authorizeOutbound,budgetGate,modelConfig,timeoutMs=30000}={}) {
    if(modelConfig!==undefined && modelConfig!==model)throw Error("unsupported-model");
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0||timeoutMs>120000)throw Error("invalid-deadline");
    this.offline=mode==="mock";
    this.capability=this.offline?capability:{...capability,origin:"offline",verifiedAt:null,generate:"unknown",referenceEdit:"unknown"};
    Object.assign(this,{transport,credentialsProvider,resolve,authorizeOutbound,budgetGate,timeoutMs});
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
    let frame,request,identity;
    const controller=new AbortController();
    try{
      if(claim.plan.action!==operation || !(this.budgetGate instanceof Reservations))throw Error("no-permit");
      const a=AttemptSchema.parse(claim.attempt);
      if(a.requestKey!==requestKey(claim.plan) || a.localWait!=="active" || a.outcome.state!=="waiting" ||
        !isDeepStrictEqual(a.capability,capability) || !a.sentAt)throw Error("invalid-claim");
      const token=await this.credentialsProvider();
      if(token!==fixtureCredential)throw Error("fixture-only");
      const ctx=await this.resolve(claim);
      frame=buildFrame(claim,ctx);
      const {binding,bindingSha256}=frame;
      const grant=await this.authorizeOutbound(binding);
      const source=claim.plan.target.source;
      if(grant?.provider!==entry || grant.owner!==source.ownerId || grant.sessionId!==source.sessionId ||
         grant.mode!=="mock" || !Array.isArray(grant.images) || !grant.images.includes(bindingSha256) ||
         (operation==="edit" && (grant.externalImageProcessing!==true || !Array.isArray(grant.references) || !grant.references.includes(binding.reference.sha256))))
        throw Error("outbound-not-cleared");
      request=imageRequest(frame,token,controller.signal);
      identity=sha256(JSON.stringify([entry,binding.scope,binding.eventKey]));
      this.budgetGate.reserve(grant,operation,identity);
    }catch(error){
      if(error.message==="already-claimed")return {state:"unknown",reason:"prior-reservation"};
      return {state:"refused",reason:"local-gate"};
    }
    let timer;
    try{
      const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{
        controller.abort();reject(Error("deadline"));
      },this.timeoutMs);});
      const response=await Promise.race([deadline,(async()=>{
        const raw=await this.transport(request);
        controller.signal.throwIfAborted();
        if(raw.url && raw.url!==request.url)throw Error("wrong-response-origin");
        return parseImage(raw,controller.signal);
      })()]);
      this.budgetGate.finish(identity,response.state);
      return {...response,origin:"mock",bindingSha256:frame.bindingSha256,promptSha256:frame.binding.promptSha256};
    }catch(error){
      return {state:"unknown",reason:"transport-unconfirmed",diagnostic:diagnostics.has(error?.message)?error.message:"transport-interrupted"};
    }
    finally{clearTimeout(timer);controller.abort();}
  }
}
