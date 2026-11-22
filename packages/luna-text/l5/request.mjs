import {digest} from "../../provider-readiness/reservations.mjs";
import {endpoint,modelId,outputLimit} from "../adapter.mjs";

export const action="从正门记录合成酒馆的当前所见";
const prompt="仅用于 L5 合成酒馆演练。玩家走进东村的青石酒馆，站在正门向北望去。环顾全堂，只有掌柜、蓝衣客、赭衣客。正午日光照着固定的柜台和双窗。请用自然中文写出玩家眼前的情形，未揭示的事情留白，不补写新人物、暗处或图像指令。";
const requestSha256="81668ce88063ac40c0f1c01af0eb1b2c03a4f97c5d5e16346215418971187046";
export const approvalId="YJ-P02-L5-single-luna-scene";
export const fixtureKey="l5-local-fixture-only";
export function prepare(input) {
  if(input?.action!==action)throw Error("ACTION_NOT_CLEARED");
  const body=JSON.stringify({model:modelId,service_tier:"default",reasoning:{effort:"none"},
    max_output_tokens:outputLimit,store:false,truncation:"disabled",tools:[],stream:false,background:false,input:prompt});
  const inputBound=Buffer.byteLength(body)+128;
  if(endpoint!=="https://api.openai.com/v1/responses" || digest(body)!==requestSha256 || inputBound>=1024)throw Error("REQUEST_NOT_CLEARED");
  return {body,inputBound,requestSha256};
}
export function fixtureGrant(runHash,expiresAt) {
  if(!/^[a-f0-9]{64}$/.test(runHash) || !Number.isSafeInteger(expiresAt))throw Error("INVALID_FIXTURE");
  return Object.freeze({approvalId,record:"L5-OFFLINE-FIXTURE/1",mode:"mock-only",liveApproved:false,
    model:modelId,endpoint,purpose:"synthetic-tavern-text",actionHash:digest(action),runHash,expiresAt,
    scope:"one-authenticated-card-owner-session-action",requestSha256,maxOutputTokens:outputLimit,
    limit:1,reserveNanoUsd:0,ceilingNanoUsd:0});
}
