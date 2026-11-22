import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {crc32,deflateSync} from "node:zlib";
import {walkthrough} from "../../first-play/story.mjs";
import {cardScope} from "../../scene-state/store.mjs";
import {claimFor} from "../../provider-readiness/test/fixture.mjs";
import {Reservations} from "../../provider-readiness/reservations.mjs";
import {OpenAIImageProvider,entry,fixtureCredential} from "../index.mjs";
import {buildFrame,replaySaved,model} from "../prompt.mjs";

export const original=readFileSync(new URL("../../../docs/reports/evidence/YJ-02/I0.png",import.meta.url));
export const originalHash="7a70683b203dc817fd5567130ba53601f84b990d344eac971bd89faf9d10f4ee";
const arrival=readFileSync(new URL("../../../docs/reports/evidence/YJ-02/I1.png",import.meta.url));
const arrivalHash="004fabce7d1bacae36346e556db0d8017d0fde96e4e6ca99bc59c2a47c808aeb";
export function png(width=1536,height=864){
  const chunk=(name,data)=>{
    const b=Buffer.alloc(12+data.length);b.writeUInt32BE(data.length);b.write(name,4);data.copy(b,8);
    b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;
  };
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=1;
  const rows=height*(Math.ceil(width/8)+1);
  return Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",header),
    chunk("IDAT",deflateSync(Buffer.alloc(Math.min(rows,2*1024*1024)))),chunk("IEND",Buffer.alloc(0))]);
}
export const output=png();
export const answer=(extra={})=>Response.json({model,data:[{b64_json:output.toString("base64")}],...extra});
export function fixture({operation="generate",file=":memory:",session=randomUUID(),keys=[randomUUID(),randomUUID(),randomUUID()],grantId=randomUUID()}={}){
  const owner="synthetic",rows=[walkthrough[0],walkthrough[2],walkthrough[6]].map((n,i)=>({
    narrative:n,action:"PRIVATE-FIXTURE-ACTION",resulting_revision:i+1,key:keys[i]}));
  const index=operation==="generate"?0:operation==="edit"?1:2;
  const history=rows.slice(0,index+1),views=replaySaved(owner,session,history),result=views.at(-1);
  const first=views[Math.max(0,index-1)].visual,id="a215e1ab-6436-419c-a1db-823c08716f00";
  const referenceHash=index===2?arrivalHash:originalHash,referenceBytes=index===2?arrival:original;
  const asset={schemaVersion:"0.1",assetId:id,attemptId:id,target:first,requestKey:"synthetic-reviewed-record",reference:null,
    sha256:referenceHash,width:1672,height:941,format:"png",storageKey:referenceHash+".png",invalidated:false,
    review:{id:"fixture-inspection",status:"accepted",assessment:"matches",basis:"YJ-02",reason:"matching-reviewed-elements"}};
  const ctx={authorized:true,enabled:true,scope:cardScope(owner,session),revision:history.length,result,history,asset,
    latestAcceptedId:id,referenceActive:true,visibleTags:["柜台","PRIVATE-BOOK"]};
  const plan={schemaVersion:"0.1",target:result.visual,action:index?"edit":"generate",reason:"PRIVATE-REASON"};
  if(index)Object.assign(plan,{reference:{assetId:id,sha256:referenceHash,reviewId:asset.review.id,visualVersion:first.visualVersion},
    preservePeople:first.people,preserveFeatures:first.features,change:"PRIVATE-CHANGE"});
  const ledger=new Reservations(file),requests=[];
  const f={ctx,plan,ledger,requests,respond:async()=>answer()};
  const provider=new OpenAIImageProvider({mode:"mock",transport:async req=>{requests.push(req);return f.respond(req);},
    credentialsProvider:()=>fixtureCredential,resolve:()=>ctx,authorizeOutbound:()=>f.grant,budgetGate:ledger});
  const claim=claimFor(provider,plan,index?referenceBytes:undefined);
  const frame=buildFrame(claim,ctx);
  f.grant={mode:"mock",provider:entry,id:grantId,owner,sessionId:session,expiresAt:Date.now()+60000,
    images:[frame.bindingSha256],references:index?[referenceHash]:[],externalImageProcessing:Boolean(index),
    maxCalls:1,perCall:1,total:1,concurrent:1,units:{generate:1,edit:1}};
  return Object.assign(f,{claim,provider,frame});
}
