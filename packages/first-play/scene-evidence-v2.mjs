import {isDeepStrictEqual} from "node:util";
import {fromCardHistory} from "../contracts/dist/index.js";
import {project} from "../scene-state/project.mjs";
import {hash} from "../scene-state/store.mjs";
import {sentences} from "./extract.mjs";
import {isSceneRegistry,syntheticRegistry} from "./scene-registry.mjs";

export const sceneEvidenceV2=Object.freeze({method:"scene-evidence/2",replayOnly:true});
const fields=["place","viewpoint","perspective","people","features","timeOfDay","lighting"];
const visualFields=fields.slice(1);
const person=/^(?:掌柜|学徒|药师|茶博士|值守人|守门人|引路人|[蓝赭绿紫青白黑红]衣客|[林沈苏顾陆叶温江柳宋许赵郑唐陈周][青舟禾明宁远松竹文安平清川秋澜云溪月石]{1,2}|[林沈苏顾陆叶温江柳宋许赵郑唐陈周](?:师傅|掌柜|先生))$/u;
const feature=/^(?:柜台|双窗|牌楼|星盘座|索桥|(?:木|竹|石|铜|长|矮|雕花)(?:柱|墙|梯|阶|桥|屏|栏|桌|窗|门|廊|塔|亭))$/u;
const position="(正门|后门|石阶上|山门前|廊下|桥头|门前|栏边|台阶上|山门|栈道口|亭下)";
const direction="([东西南北])";
const views=[
  new RegExp("^[你我]站在"+position+"，向"+direction+"望去$"),
  new RegExp("^[你我]在"+position+"朝"+direction+"看去$"),
  new RegExp("^[你我]从"+position+"回望"+direction+"侧$"),
  new RegExp("^从"+position+"向"+direction+"望去的是我$")
];
const location=/^(?:[我你](?:走进|来到|踏入|回到)|此时[我你]身在)(?:([\p{Script=Han}]{1,24}?)的)?([\p{Script=Han}]{1,24})$/u;
const changeRemainder="观察位置、朝向、结构、时段和光照均未改变";
const revisitProof="我重新环顾，人物、结构、时段、光照、观察位置和朝向全与离开时相同";
const note=operation=>({basis:"current-story",playerKnown:true,operation});
const set=(field,value)=>Array.isArray(value)?{type:"set",field,values:value}:{type:"set",field,value};
const hit=(rule,values)=>({rule,values});
const excluded=reason=>({rule:"excluded",reason});
function list(text,domain,count){
  const members=text.split(/、|和|与/u);
  if(members.length>12 || new Set(members).size!==members.length || !members.every(m=>domain.test(m)) ||
     (count!==undefined && members.length!==count))return null;
  return members.sort();
}
function recognize(s,registry){
  let m=location.exec(s);
  if(m){
    const resolved=registry.resolve(m[2],m[1]);
    return resolved.place?{...hit("registered-location",{place:resolved.place.sceneId}),place:resolved.place,returning:/^[我你]回到/u.test(s)}:excluded(resolved.reason);
  }
  for(const rule of views)if((m=rule.exec(s)))return hit("player-view",{viewpoint:m[1],perspective:"玩家向"+m[2]+"所见"});
  if((m=new RegExp("^[我你]站在"+position+"$").exec(s)))return hit("player-position",{viewpoint:m[1]});
  if((m=new RegExp("^[我你]向"+direction+"望去$").exec(s)))return hit("player-direction",{perspective:"玩家向"+m[1]+"所见"});
  const rosters=[
    [/^(?:环顾(?:四周|屋内)，在场的只有)(.+)$/u], [/^(?:此地|殿中)除(.+)再无旁人$/u],
    [/^眼前只有(.+)两人$/u,2], [/^我数过，在场一共两人，分别是(.+)$/u,2]
  ];
  for(const [rule,count] of rosters)if((m=rule.exec(s))){
    const names=list(m[1],person,count);
    return names?hit("exclusive-roster",{people:names}):excluded("invalid-complete-roster");
  }
  if((m=/^(?:这里还站着|屋内可见)(.+)$/u.exec(s))){
    const names=list(m[1],person);
    return names?{...hit("nonexclusive-roster",{people:names}),precision:"partial"}:excluded("unresolved-members");
  }
  for(const rule of [/^眼前固定的(.+)清晰可见$/u,/^我看清了这里的(.+)$/u,/^面前可辨的结构有(.+)$/u,/^眼前能看清(.+)$/u]){
    if((m=rule.exec(s))){const names=list(m[1],feature);return names?hit("observed-structures",{features:names}):excluded("invalid-structure-list");}
  }
  if((m=/^(?:此刻已是|眼下正值|现在是|此时是)(清晨|黎明|正午|傍晚|夜间|黄昏)$/u.exec(s)))return hit("observed-time",{timeOfDay:m[1]});
  for(const rule of [/^(日光|月光|灯光|烛光)照亮(?:眼前|屋内)$/u,/^眼前(?:洒着|可见)(日光|月光|灯光|烛光)$/u,
    /^此刻(日光|月光|灯光|烛光)(?:照进廊间|透过竹林)$/u]){
    if((m=rule.exec(s)))return hit("observed-light",{lighting:m[1]});
  }
  if(s==="你们只聊了几句茶价" || s==="你们谈了谈茶价" || /^掌柜说：“茶价照旧[。！]?”$/u.test(s))return {rule:"incidental-chat"};
  if(s==="眼前的一切都没有变化")return {rule:"unchanged"};
  if(s===revisitProof)return {rule:"return-confirmation"};
  if(s===changeRemainder)return {rule:"other-fields-confirmed"};
  if(s==="我离开了这里" || s==="你离开了这里")return {rule:"leave"};
  if((m=/^(.+)走了进来，原来的人都还在，除此再无旁人$/u.exec(s)) && person.test(m[1]))return {rule:"member-arrival",member:m[1]};
  if((m=/^(.+)离开了这里，其余在场的人都没动，也没有新人到场$/u.exec(s)) && person.test(m[1]))return {rule:"member-exit",member:m[1]};
  for(const [reason,pattern] of [["quotation",/[“”「」『』"《》]/u],["memory-or-dream",/从前|想起|旧日|记得|梦/u],
    ["planned-or-hypothetical",/计划|打算|如果|假设/u],["reported",/听说|据说|传闻/u],["negated",/并非|没看清|不在/u],
    ["unrevealed",/隐藏|未揭示|藏着/u],["non-narrative",/[{}<>]|旧图|画像/u]]){
    if(pattern.test(s))return excluded(reason);
  }
  return excluded("unresolved-clause");
}

function inspect(state,source,text,registry){
  const evidence=[],blockers=[],coverage=Object.fromEntries(fields.map(f=>[f,{precision:"unknown",spans:[]}]));
  const audit={...sceneEvidenceV2,registryDigest:registry.digest,source,revision:source.revision,narrativeSha256:hash(text),
    offsetUnit:"UTF-16",fields:coverage,evidence,blockers};
  const locs=[],controls=[];
  let declaredFixed=[];
  const chunks=text.length<=32768?sentences(text):null;
  if(!chunks?.length){
    blockers.push("invalid-sentence-boundaries");
    evidence.push({start:0,end:text.length,rule:"invalid-sentence-boundaries",scope:"unresolved",playerKnown:false});
  }
  for(const {value,start,length,question} of (!blockers.length?chunks:[])){
    const h=question?excluded("question"):recognize(value,registry);
    const i=evidence.length;
    evidence.push({start,end:start+length,rule:h.rule,scope:h.reason??(h.rule==="incidental-chat"?"nonvisual":"current"),
      playerKnown:!h.reason && h.rule!=="incidental-chat"});
    if(h.reason){blockers.push(h.reason);continue;}
    if(h.values?.features && value.startsWith("眼前固定的"))declaredFixed=h.values.features;
    if(h.place){if(i!==0 || locs.length)blockers.push("location-after-observations");locs.push(h);}
    if(!h.values){if(h.rule!=="incidental-chat")controls.push({...h,index:i});continue;}
    for(const [field,val] of Object.entries(h.values)){
      const rec=coverage[field];
      // Two partial sightings never establish exhaustiveness. An exclusive roster can
      // corroborate a partial one only if it includes every witnessed person.
      if(field==="people" && rec.spans.length && (rec.precision==="partial" || h.precision==="partial")){
        const complete=rec.precision==="complete"?rec.value:h.precision==="partial"?null:val;
        const witnessed=[...new Set([...rec.value,...val])].sort();
        rec.spans.push(i);
        if(complete && !witnessed.every(name=>complete.includes(name)))blockers.push("conflict:people");
        else {rec.value=complete??witnessed;rec.precision=complete?"complete":"partial";}
        continue;
      }
      if(rec.spans.length && (!isDeepStrictEqual(rec.value,val) || rec.precision!==(h.precision??"complete"))){
        rec.precision="partial";rec.spans.push(i);blockers.push("conflict:"+field);continue;
      }
      rec.precision=h.precision??"complete";rec.value=val;rec.spans.push(i);
    }
  }
  function result(ops,status){
    audit.status=status;return {audit,observations:ops.map(note)};
  }
  const active=state.places.find(p=>p.scene.sceneId===state.current);
  const here=locs[0]?.place;
  const prior=here?state.places.find(p=>p.scene.sceneId===here.sceneId):active;
  const rules=controls.map(c=>c.rule).join("+");
  const surveyed=visualFields.some(f=>coverage[f].spans.length);
  function inherit(place,index,field,value){
    coverage[field]={precision:"complete",value,spans:[index],confirmedFrom:place.visual.source};
  }
  if(!blockers.length && active?.visual && !active.pending && evidence.length && evidence.every(e=>e.rule==="incidental-chat")){
    // A purely conversational turn does not resurvey a place. Keep the active frame and
    // identify the actual earlier visual; these speech spans attest only the turn's scope.
    for(const f of fields)coverage[f]={precision:"complete",basis:"inherited-active",
      value:f==="place"?active.scene.sceneId:active.facts[f],spans:[],contextSpans:evidence.map((_,i)=>i),
      confirmedFrom:active.visual.source};
    return result([],"ready");
  }
  if(!blockers.length && rules==="leave" && !here && !surveyed)
    return result([{type:"leave",reason:"visible-departure"}],"not-ready");
  if(!blockers.length && prior?.visual && !prior.pending && !surveyed){
    const stable=(!here && rules==="unchanged") || (locs[0]?.returning && rules==="return-confirmation");
    const delta=!here && ["member-arrival+other-fields-confirmed","member-exit+other-fields-confirmed"].includes(rules);
    if(stable || delta){
      const member=controls[0].member,arrives=controls[0].rule==="member-arrival";
      if(delta && prior.facts.people.includes(member)===arrives)blockers.push("inconsistent-membership-change");
      else{
        const index=controls.at(-1).index;
        if(!here)inherit(prior,index,"place",prior.scene.sceneId);
        for(const f of visualFields)inherit(prior,index,f,prior.facts[f]);
        const ops=here?[{type:"visit",sceneId:here.sceneId,confirmedContinuity:true}]:[];
        if(delta){
          const names=arrives?[...prior.facts.people,member]:prior.facts.people.filter(n=>n!==member);
          inherit(prior,controls[0].index,"people",names.sort());
          ops.push({type:arrives?"add":"remove",field:"people",values:[member]});
        }
        return result(ops,"ready");
      }
    }
  }
  if(controls.length)blockers.push("continuity-not-established");
  for(const f of fields)if(coverage[f].precision!=="complete")blockers.push("incomplete:"+f);
  if(blockers.length){
    // An unresolved sentence may rescope the whole passage. Diagnostics retain candidate spans only.
    for(const f of fields)if(coverage[f].spans.length)coverage[f].admitted=false;
    for(const item of evidence)if(item.scope==="current")item.playerKnown=false;
    const reason=blockers[0];
    if(here && active?.scene.sceneId===here.sceneId && blockers.every(b=>b.startsWith("incomplete:")))
      return result([{type:"hold",reason}],"not-ready");
    // An unlocated turn could also have invalidated a previously visited place.
    return result([{type:"unknown",reason,unresolvedPlaces:true}],"not-ready");
  }
  const entry=prior?{type:"visit",sceneId:here.sceneId,confirmedContinuity:true}:
    {type:"create",sceneId:here.sceneId,parentSceneId:here.parentSceneId,name:here.name,fixedFeatures:declaredFixed};
  return result([entry,...visualFields.map(f=>set(f,coverage[f].value)),{type:"confirm-survey"}],"ready");
}

// The only public extraction entry owns a fresh projection. Host receipts must come from an
// independently authenticated saved-history read; a hash alone does not authenticate a writer.
export function createEvidenceReplay({owner,sessionId,registry=syntheticRegistry,replayOnly}){
  if(!isSceneRegistry(registry))throw Error("unregistered-directory");
  if(replayOnly!==true || !owner || !sessionId)throw Error("isolated-replay-required");
  let state={current:null,places:[]};
  const journal=[],keys=new Set();
  return Object.freeze({...sceneEvidenceV2,append(row,receipt){
    const {source}=fromCardHistory(owner,sessionId,row);
    if(receipt?.method!==sceneEvidenceV2.method || receipt.registryDigest!==registry.digest ||
      !isDeepStrictEqual(receipt.source,source) || receipt.narrativeSha256!==hash(row.narrative))throw Error("replay-source-mismatch");
    const previous=journal[source.revision-1];
    if(previous){
      if(!isDeepStrictEqual(previous.audit.source,source) || previous.audit.narrativeSha256!==receipt.narrativeSha256)
        throw Error("conflicting-revision");
      return structuredClone(previous);
    }
    if(source.revision!==journal.length+1 || keys.has(source.key))throw Error("history-order-or-key");
    const {audit,observations}=inspect(state,source,row.narrative,registry);
    const next=structuredClone(state);
    const result=structuredClone(project(next,source,observations));
    if(result.status!==audit.status)throw Error("projection-status-mismatch");
    state=next;
    const saved={audit,result};journal.push(saved);keys.add(source.key);return structuredClone(saved);
  }});
}
