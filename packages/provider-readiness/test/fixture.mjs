import {randomUUID} from "node:crypto";
import {catalog} from "../../world-assets/index.mjs";
import {requestKey} from "../../contracts/dist/index.js";
import {visualDigest} from "../offline.mjs";

export function sampleGrant(owner="synthetic-owner",sessionId=randomUUID()) {
  return {id:randomUUID(),owner,sessionId,expiresAt:Date.now()+300000,provider:"p01-local-fake",
    maxCalls:6,perCall:4,total:18,concurrent:1,units:{text:1,generate:4,edit:3},
    actions:["进入酒馆","迎接旅人","观察雨幕"],images:catalog.map(a=>visualDigest({...a.facts,sceneId:a.sceneId})),
    references:[catalog[0].reviewedSha256]};
}
export function target(grant,index) {
  return {schemaVersion:"0.1",source:{schemaVersion:"0.1",kind:"card-history",evidence:"completed-history",
    ownerId:grant.owner,sessionId:grant.sessionId,key:randomUUID(),revision:index+1},sceneId:"east",
    visualVersion:"V"+(index+1),...structuredClone(catalog[index].facts)};
}
export function claimFor(provider,plan,referenceBytes) {
  const stamp=new Date().toISOString();
  return {plan,referenceBytes,attempt:{schemaVersion:"0.1",attemptId:randomUUID(),requestKey:requestKey(plan),
    capability:provider.capability,sentAt:stamp,observedAt:stamp,outcome:{state:"waiting"},localWait:"active",
    model:null,usage:null,cost:null,seed:null,providerRequestId:null}};
}
