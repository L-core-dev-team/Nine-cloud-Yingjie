import {catalog,binding} from "./pictures.mjs";
import {hash} from "../data.mjs";

export const policyVersion="p05-native-art/2";
const ferry="loc_luhuadu", ridge="loc_wangqitai", berm="subloc_ferry_berm";
const opening="渡槽淤了半尺，水发黄。\n船吃水太深，蹭着淤泥靠不上岸。\n岸边踩倒的芦花没人扶。";
const southern="你到了望气台。\n从望气台往南看。\n压在山脊上的那片白，不是云。";
const stones="石堆散了。渡槽口露出一段黑黢黢的水面。\n远处有桨声。一下，又一下。";
const battle={
  clear:"鸦群炸开，又落回石头上。\n石堆松了一层。",
  clear_wounded:"鸦群散开。有一只擦着你肩膀，落回石头。\n石堆松了。"
};
// Only these fixed upstream presentation hints are compatible with the cropped pictures.
function matches(text,base,allowed=["手在抖"]){
  if(text===base)return true;
  if(!text.startsWith(base+"\n"))return false;
  const lines=text.slice(base.length+1).split("\n");
  return lines.every(s=>allowed.includes(s)) && new Set(lines).size===lines.length;
}
export function sceneEvidence(save,receipt){
  const fields=["targetId","method","result","clueId","outcome","questId","npcId","from","to","toward","reason"];
  return {ferry:save.state.facts.ferryState,obstacle:save.state.facts.obstacleState,
    outcome:receipt.decision.outcome,events:receipt.decision.events.map(({type,payload})=>({
      type,...Object.fromEntries(fields.filter(f=>typeof payload[f]==="string").map(f=>[f,payload[f]]))
    }))};
}
function choose(store,h,action){
  const {events,ferry:water,obstacle,outcome}=h.sceneEvidence;
  const [first={},second={}]=events, {location,sub}=h.native;
  const clear=water==="clear" && obstacle==="cleared",silt=water==="aground" && obstacle==="blocked";
  const observation=(asset,reason)=>({asset,reason,sourceRevision:h.revision,basis:"当回合正文与原生行动相符"});
  const hide=reason=>({asset:null,reason,sourceRevision:null,basis:"本回合无适用画面"});
  const success=outcome==="success";
  if(action.kind==="observe" && first.type==="observe.result" && first.targetId==="obj_ferry" &&
     first.method==="scan" && first.result==="found" && first.clueId==="clue_ferry_stuck" &&
     events.length===1 && success && matches(h.text,opening)){
    if(water==="clear" || obstacle==="cleared")return hide("清障状态与旧淤船观察正文冲突");
    if(location===ferry && sub===null && silt)return observation("I01","渡口父地点的首次淤船线索与未清障状态相符");
  }
  if(action.kind==="combat" && first.type==="combat.resolved" && first.targetId==="npc_shuiyuya" &&
     Object.hasOwn(battle,first.outcome) && success && second.type==="quest.completed" &&
     second.questId==="quest_first_clearance" && events.length===2 && clear && location===ferry && sub===berm &&
     matches(h.text,battle[first.outcome]+"\n"+stones))return observation("I02","作业位清障结算与散石露水正文相符");
  if(action.kind==="move" && events.length===1 && first.type==="move.arrived" && first.to===ridge &&
     success && location===ridge && sub===null && matches(h.text,southern))
    return observation("I03","当次抵达望气台，正文确认向南及山脊白色区域");
  const talk=action.kind==="talk" && first.type==="talk.occurred" && first.npcId==="npc_cenjiu" &&
    first.outcome==="idle" && matches(h.text,"嗯。芦花今年开得晚。",["手在抖","肩上怎么了","你要是走南边那条路，替我看一眼。什么也没有最好。"]);
  const reward=action.kind==="quest" && first.type==="quest.reward_claimed" && first.questId==="quest_first_clearance" &&
    success && h.native.quest?.rewardClaimed===true && matches(h.text,"任务奖励已领取，折桂坪已解锁。");
  if(events.length===1 && (talk || reward)){
    const prev=binding(store,h.scope,h.revision-1);
    const orig=prev?.sourceRevision && binding(store,h.scope,prev.sourceRevision);
    if(orig?.asset && orig.scope===h.scope && orig.ownerHash===h.ownerHash && orig.saveHash===h.saveHash &&
       orig.branch===h.branch && prev.scope===h.scope && orig.asset===prev.asset &&
       orig.sourceRevision===orig.revision && orig.sha===catalog.assets[orig.asset]?.sha256 &&
       prev.location===location && prev.sub===sub && orig.location===location && orig.sub===sub &&
       ((orig.asset==="I01" && silt)||(orig.asset==="I02" && clear)) &&
       store.get("shown:"+orig.key+":current"))
      return {asset:orig.asset,reason:talk?"闲谈未改变原视野":"领奖未改变原视野",sourceRevision:orig.revision,basis:"上次所见"};
  }
  return hide(first.type==="move.blocked"?"移动受阻，未重新观察":first.result==="none"?"重复观察未获得新线索":"本次行动没有相容的可见依据");
}
export function bindScene(store,h,choice){
  const {scope,revision,ownerHash,saveHash,branch,requestKey,bodySha,canonicalReceiptSha:receipt}=h;
  const valid=h.source==="deterministic" && branch==="root" && h.ruleVersion===catalog.rules &&
    h.canonVersion===catalog.canon && hash(h.text)===bodySha && /^[0-9a-f]{64}$/.test(receipt);
  const selected=valid?choose(store,h,choice):{asset:null,sourceRevision:null,reason:"来源或版本不符",basis:"本回合无适用画面"};
  const sha=catalog.assets[selected.asset]?.sha256??null;
  const row={version:policyVersion,scope,revision,ownerHash,saveHash,branch,requestKey,bodySha,receipt,
    location:h.native.location,sub:h.native.sub,sha,...selected};
  row.key=hash(row);
  store.set("picture:"+scope+":"+revision,JSON.stringify(row));
  return row;
}
