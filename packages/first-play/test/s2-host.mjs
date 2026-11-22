import {fromCardHistory} from "../../contracts/dist/index.js";
import {hash,cardScope} from "../../scene-state/store.mjs";
import {createSceneRegistry} from "../scene-registry.mjs";
import {createEvidenceReplay} from "../scene-evidence-v2.mjs";

export const registry=createSceneRegistry([
  {sceneId:"amber",parentSceneId:"琥洲",name:"照影堂",aliases:["琥光堂"]},
  {sceneId:"reed",parentSceneId:"芦湾",name:"听潮台",aliases:["潮台"]},
  {sceneId:"north-yard",parentSceneId:"雪原",name:"候星庭",aliases:["星庭"]},
  {sceneId:"south-yard",parentSceneId:"沙洲",name:"候星庭",aliases:["南星庭"]},
  {sceneId:"pine-gate",parentSceneId:"松岭",name:"宗门山门",aliases:["听松门"]},
  {sceneId:"cloud-walk",parentSceneId:"南峰",name:"云海栈道",aliases:["云廊"]},
  {sceneId:"amber-tavern",parentSceneId:"琥洲",name:"听雨酒馆",aliases:["雨廊酒肆"]}
]);
export function session(label,directory=registry){
  const owner="s2-synthetic",sessionId="00000000-0000-4000-a000-"+hash(label).slice(0,12);
  const history=[],receipts=[],replay=createEvidenceReplay({owner,sessionId,registry:directory,replayOnly:true});
  let current;
  return {append(narrative,action="继续观察"){
    const revision=history.length+1,row={narrative,action,key:"00000000-0000-4000-b000-"+hash(label+"-"+revision).slice(0,12),resulting_revision:revision};
    const source=fromCardHistory(owner,sessionId,row).source;
    const receipt={method:"scene-evidence/2",registryDigest:directory.digest,source,narrativeSha256:hash(narrative)};
    current=replay.append(row,receipt);history.push(row);receipts.push(receipt);
    return this.context();
  },context(){return {owner,sessionId,registry:directory,scope:cardScope(owner,sessionId),authorized:true,enabled:true,
    history:[...history],receipts:[...receipts],revision:history.length,...current};}};
}
export function editPlan(target,asset){
  return {schemaVersion:"0.1",action:"edit",reason:"observed-change",target,
    reference:{assetId:asset.assetId,reviewId:asset.review.id,sha256:asset.sha256,visualVersion:asset.target.visualVersion},
    preservePeople:target.people.filter(p=>asset.target.people.includes(p)),preserveFeatures:target.features.filter(f=>asset.target.features.includes(f)),
    change:"仅更新正文明确改变的在场人物和可见事实"};
}
