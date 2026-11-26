import { readFileSync } from "node:fs";
import { hash } from "../data.mjs";
import { staticPng } from "../../openai-image/png.mjs";

export const catalog = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url)));
const fail = (status, message) => { throw Object.assign(Error(message), {status}); };
const hex = /^[a-f0-9]{64}$/;
const pictureAt = [ "I01", null, "I02", "I02", "I03", null, null, "I03" ];

export function reviewedBytes(id, read = readFileSync) {
  const a = Object.hasOwn(catalog.assets, id) && catalog.assets[id];
  if (!a || a.review !== "accepted") fail(404,"无适用画面");
  try {
    const bytes = read(new URL("./assets/"+id+".png",import.meta.url));
    if (hash(bytes) !== a.sha256) throw Error("sha");
    const info = staticPng(bytes);
    if (info.width !== a.width || info.height !== a.height) throw Error("dimensions");
    return bytes;
  } catch { fail(404,"图片暂时不可读"); }
}

// Called inside the same transaction that stores an authenticated accepted turn.
export function bindPicture(store, entry, choice) {
  const {scope,revision:r} = entry;
  const expected = catalog.route[r-1];
  const prior = binding(store,scope,r-1);
  const onRoute = !!expected && (r===1 || prior?.onRoute===true) &&
    entry.source==="deterministic" && entry.branch==="root" &&
    entry.ruleVersion===catalog.rules && entry.canonVersion===catalog.canon &&
    hex.test(entry.canonicalReceiptSha) && entry.bodySha===hash(entry.text) &&
    choice.id===expected.id && entry.bodySha===expected.body &&
    entry.native.location===expected.location && entry.native.sub===expected.sub &&
    entry.native.quest?.status===expected.quest.status && entry.native.quest.rewardClaimed===expected.quest.rewardClaimed &&
    JSON.stringify(entry.events)===JSON.stringify(expected.events);
  const carry = r===4;
  const carried = !carry || (prior?.asset==="I02" && store.get("shown:"+prior.key+":current"));
  const asset = onRoute && carried ? pictureAt[r-1] : null;
  const sha = asset ? catalog.assets[asset].sha256 : null;
  const key = hash([catalog.version,scope,entry.ownerHash,entry.saveHash,entry.branch,r,entry.requestKey,
    entry.bodySha,entry.canonicalReceiptSha,entry.native.location,entry.native.sub,asset,sha]);
  const row = {scope,revision:r,key,onRoute,asset,sha,version:catalog.version,ownerHash:entry.ownerHash,
    saveHash:entry.saveHash,branch:entry.branch,requestKey:entry.requestKey,bodySha:entry.bodySha,
    receipt:entry.canonicalReceiptSha,location:entry.native.location,sub:entry.native.sub,
    basis:asset?(carry?"上次所见":"当回合正文与原生行动相符"):"本回合无适用画面",
    sourceRevision:asset?(carry?r-1:r):null};
  store.set("picture:"+scope+":"+r,JSON.stringify(row));
  return row;
}

export function binding(store,scope,rev) {
  return JSON.parse(store.get("picture:"+scope+":"+rev)??"null");
}
export function enabled(store,scope) { return store.get("pictures-enabled:"+scope)!=="off"; }
export function setEnabled(store,scope,value) {
  if(typeof value!=="boolean")fail(400,"图片开关无效");
  store.set("pictures-enabled:"+scope,value?"on":"off");
}
function readable(row,scope,rev) {
  const a=row && Object.hasOwn(catalog.assets,row.asset) && catalog.assets[row.asset];
  return a && row.scope===scope && row.revision===rev && row.branch==="root" &&
    hex.test(row.ownerHash) && hex.test(row.saveHash) && hex.test(row.key) &&
    hex.test(row.receipt) && hex.test(row.bodySha) && !!row.requestKey &&
    row.sha===a.sha256 && Number.isSafeInteger(row.sourceRevision) &&
    row.sourceRevision>0 && row.sourceRevision<=rev;
}
export function target(store,scope,live,mode,rev,key) {
  const row=binding(store,scope,rev);
  if (!Number.isSafeInteger(rev)||rev<1||!enabled(store,scope)||!readable(row,scope,rev)||row.key!==key||rev>live.revision ||
      !["current","history"].includes(mode)) fail(404,"无适用画面");
  if(mode==="current" && (rev!==live.revision || row.location!==live.location || row.sub!==live.sub))
    fail(409,"视野已经改变");
  return row;
}
export function describe(store,scope,revision) {
  const row=binding(store,scope,revision);
  if(!readable(row,scope,revision))return null;
  const a=catalog.assets[row.asset];
  return {key:row.key,title:a.title,basis:row.basis,asset:row.asset,sha:a.sha256};
}
export function recordDisplay(store,row,mode,outcome) {
  if(!["decoded","failed"].includes(outcome))fail(400,"状态无效");
  const k=(outcome==="decoded"?"shown:":"failed:")+row.key+":"+mode;
  if(!store.get(k)){
    let previous=false;
    if(mode==="current")for(let rev=row.revision-1;rev>0 && !previous;rev--){
      const prior=binding(store,row.scope,rev);
      previous=prior?.sha===row.sha && !!store.get("shown:"+prior.key+":current");
    }
    const state=outcome==="failed"?"load-failed":mode==="history"?"history":row.basis==="上次所见"?"retained":previous?"reused":"first-display";
    store.set(k,JSON.stringify({revision:row.revision,scope:row.scope,asset:row.asset,sha:row.sha,key:row.key,mode,state,at:new Date().toISOString()}));
  }
  return JSON.parse(store.get(k));
}
