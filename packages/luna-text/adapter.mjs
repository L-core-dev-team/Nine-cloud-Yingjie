import {digest} from "../provider-readiness/reservations.mjs";
import {walkthrough} from "../first-play/story.mjs";

export const action = "继续观察酒馆";
export const modelId = "gpt-6-luna";
export const endpoint = "https://api.openai.com/v1/responses";
export const priceDate = "2026-11-21";
export const inputLimit = 8000, outputLimit = 1200;
// Nano-USD per token, Standard short context. Never rely on a cache discount.
const inputRate = 100, outputRate = 500;
export const reserveNanoUsd = 100_000_000;
export const ceilingNanoUsd = inputLimit * inputRate + outputLimit * outputRate;
export function beijingDate(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Shanghai"}).format(now);
}
export function preflight(key, projectChecked, now = new Date()) {
  const blockers = [];
  if (!key?.trim()) blockers.push("API_KEY_NOT_CONFIGURED");
  if (projectChecked !== priceDate) blockers.push("PROJECT_MODEL_STANDARD_ACCESS_UNCONFIRMED");
  if (beijingDate(now) !== priceDate || ceilingNanoUsd > reserveNanoUsd) blockers.push("BUDGET_GATE_NOT_VERIFIED");
  return blockers;
}
export function prepare(input) {
  if (input?.action !== action) throw Error("ACTION_NOT_CLEARED");
  const body = JSON.stringify({model:modelId,service_tier:"default",reasoning:{effort:"none"},
    max_output_tokens:outputLimit,store:false,truncation:"disabled",tools:[],stream:false,background:false,
    input:"根据这段合成场景，仅以简短中文描述当下可见情形。"+walkthrough[0]+"玩家行动："+action+"。"});
  // Byte-level BPE cannot use more tokens than bytes of the encoded plain text.
  // Count the entire serialized envelope, plus a framing allowance, for this one fixed input.
  const inputBound = Buffer.byteLength(body) + 128;
  if (inputBound >= 1024 || inputBound > inputLimit) throw Error("BUDGET_GATE_NOT_VERIFIED");
  const requestSha256=digest(body);
  // Updating the shared walkthrough or request parameters cannot silently change the grant.
  if (requestSha256!=="e4199b370fa95e71c18cedd8c4e7c30965ada8ecdcc2978c473c5a3b0f61aad4")
    throw Error("REQUEST_NOT_CLEARED");
  return {body,inputBound,requestSha256};
}
function account(usage,standardLuna) {
  if (!usage) return null;
  const {input_tokens:i,output_tokens:o,total_tokens:t}=usage;
  const r=usage.output_tokens_details?.reasoning_tokens ?? null;
  if (![i,o,t].every(x=>Number.isSafeInteger(x) && x>=0) || t!==i+o ||
      (r!==null && (!Number.isSafeInteger(r)||r<0||r>o))) return null;
  const knownPrice=standardLuna && i<1024 && o<=outputLimit;
  return {inputTokens:i,outputTokens:o,reasoningTokens:r,estimatedNanoUsd:knownPrice?i*inputRate+o*outputRate:null};
}

// The live caller supplies the pinned upstream HTTPS transport and the server-only grant.
// The upstream service alone commits the returned narrative.
export function cardModel({ledger,transport,key,takeKey=()=>key,gate=()=>{},cancelSignal,prepareRequest=prepare,hashResponseId=false}) {
  return async (input, signal, call) => {
    const prepared=prepareRequest(input);
    gate(); signal.throwIfAborted();cancelSignal?.throwIfAborted();
    ledger.claim(call,prepared);
    let phase="UNKNOWN_STOP", httpStatus=null, responseId=null, usage=null, narrative;
    let responseModel=null,responseTier=null;
    try {
      const response=await transport(endpoint,{method:"POST",redirect:"error",credentials:"omit",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+takeKey()},
        signal:AbortSignal.any([signal,AbortSignal.timeout(45_000),...(cancelSignal?[cancelSignal]:[])]),body:prepared.body});
      httpStatus=response.status;
      if ([400,401,403,404,422,429].includes(httpStatus)) phase="REJECTED_STOP";
      if (httpStatus===200) {
        const data=await response.json();
        if (/^resp_[A-Za-z0-9_-]{1,160}$/.test(data.id)) responseId=data.id;
        if (typeof data.model==="string") responseModel=data.model===modelId?modelId:"unexpected";
        if (typeof data.service_tier==="string") responseTier=data.service_tier==="default"?"default":"unexpected";
        if(responseModel==="unexpected" || responseTier==="unexpected") phase="FAIL";
        const standardLuna=responseModel===modelId && responseTier==="default";
        usage=account(data.usage,standardLuna);
        const messages=data.output?.filter(item=>item.type==="message");
        // A reasoning item is metadata. No calls, extra modalities, refusals or partial text.
        if (standardLuna && responseId && usage && usage.inputTokens>0 && usage.inputTokens<=prepared.inputBound &&
            usage.outputTokens>0 && usage.outputTokens<=outputLimit &&
            data.status==="completed" && !data.error &&
            data.output.every(item=>["message","reasoning"].includes(item.type)) && messages.length===1) {
          const m=messages[0], parts=m.content;
          if (m.role==="assistant" && m.status==="completed" && parts?.length===1 &&
              parts[0].type==="output_text" && typeof parts[0].text==="string" &&
              parts[0].text.trim() && Buffer.byteLength(parts[0].text)<=32_000) {
            narrative=parts[0].text.trim(); phase="ACKNOWLEDGED";
          }
        }
      }
    } catch { /* Preserve possible delivery and discard untrusted error bodies. */ }
    ledger.finish(phase,{httpStatus,...(hashResponseId?{responseIdHash:responseId?digest(responseId):null}:{responseId}),responseModel,responseTier,usage,bodySha256:narrative?digest(narrative):null});
    if (phase!=="ACKNOWLEDGED") throw Error(phase);
    return narrative;
  };
}
