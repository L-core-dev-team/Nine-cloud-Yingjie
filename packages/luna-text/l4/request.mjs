import {digest} from "../../provider-readiness/reservations.mjs";
import {beijingDate,modelId,outputLimit,reserveNanoUsd} from "../adapter.mjs";

export const approvalId="YJ-P02-L4-single-luna-scene";
export const priceDate="2026-11-22";
export const action="在酒馆正门观察眼前的场景";
export const prompt="开发自编合成剧情。你走进东村的青石酒馆，站在正门朝北观察。眼前固定的柜台和双窗清晰可见。正午的日光照入堂内。你看遍全堂，确认在场的只有掌柜、蓝衣客和赭衣客。玩家行动："+action+"。请用约150至300个汉字，以玩家当下所见自然续写。只呈现已揭示的地点、视角、陈设、时段、光照和成员。未知留白，不改变既定事实，不附字段、推理或图像指令。";
const body=JSON.stringify({model:modelId,service_tier:"default",reasoning:{effort:"none"},max_output_tokens:outputLimit,
  store:false,truncation:"disabled",tools:[],stream:false,background:false,input:prompt});
export const requestSha256=digest(body);
export const inputBound=Buffer.byteLength(body)+128;
// Global Standard direct endpoint. Budget stays below the grant even at the highest cache-write rate.
export const ceilingNanoUsd=inputBound*250+outputLimit*500;
export const grant=Object.freeze({approvalId,priceDate,model:modelId,limit:1,reserveNanoUsd,ceilingNanoUsd,
  purpose:"synthetic-tavern-text",requestSha256,expires:"2026-11-22T23:59:59.999+08:00"});
export function prepare(input){
  if(input?.action!==action)throw Error("ACTION_NOT_CLEARED");
  if(requestSha256!=="37c06b167d46be0774edc403ed18738517ffe7b676c738679da6c2d0f0eb0124")throw Error("REQUEST_NOT_CLEARED");
  if(inputBound>=1024 || ceilingNanoUsd>reserveNanoUsd)throw Error("BUDGET_GATE_NOT_VERIFIED");
  return {body,inputBound,requestSha256};
}
export function preflight(hasKey,verified,now=new Date()){
  const reasons=[];
  if(!hasKey)reasons.push("API_KEY_NOT_CONFIGURED");
  if(!verified)reasons.push("PROJECT_MODEL_STANDARD_ACCESS_UNCONFIRMED");
  if(beijingDate(now)!==priceDate)reasons.push("BUDGET_GATE_NOT_VERIFIED");
  prepare({action});
  return reasons;
}
