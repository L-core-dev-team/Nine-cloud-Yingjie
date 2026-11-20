// Rules operate on complete clauses in the saved ordinary-card narrative.
// Offsets refer to its trimmed UTF-16 representation (hash stored by YJ-04).
export const method="zh-visible-clause/1";
const people=/(?:掌柜|[蓝赭绿紫青白黑红]衣客)(?:(?:、|和|与)(?:掌柜|[蓝赭绿紫青白黑红]衣客))*/;
const list=(s)=>s.split(/、|和|与/);
const set=(field,value)=>Array.isArray(value)?{type:"set",field,values:value}:{type:"set",field,value};
const full=(before,after)=>new RegExp("^"+before+"("+people.source+")"+after+"$");
const roster=full("(?:此刻)?堂内只有","");
const add=full("","(?:从后门走了进来|走进大堂)");
const remove=full("","(?:离开了大堂|走出大堂)");
const doorwayArrival=full("门帘掀开，","一前一后跨进大堂");
const negated=full("","没有(?:走进大堂|离开大堂)");
const places={"东村":"east","西村":"west"};

function sentences(text) {
  const chunks=[];
  let start=0,quoted=false;
  for(let i=0;i<=text.length;i++){
    const char=text[i];
    if(char==="“") {if(quoted)return null;quoted=true;}
    if(char==="”") {if(!quoted)return null;quoted=false;}
    if(i===text.length || (!quoted && "。！？；\n".includes(char))){
      const raw=text.slice(start,i),value=raw.trim();
      if(value)chunks.push({value,start:start+raw.indexOf(value),length:value.length,question:char==="？"});
      start=i+1;
    }
  }
  return quoted?null:chunks;
}

function classify(s,known) {
  const result=(rule,...ops)=>({rule,ops});
  let m;
  if((m=s.match(/^你(?:走进|来到)(东村|西村)的青石酒馆$/))){
    const sceneId=places[m[1]];
    if(known.has(sceneId))return result("survey-again",{type:"visit",sceneId,confirmedContinuity:true});
    return result("enter",{type:"create",sceneId,parentSceneId:m[1],name:"青石酒馆",fixedFeatures:[]});
  }
  if((m=s.match(/^你回到(东村|西村)的青石酒馆，眼前景物与离开时一样$/)))
    return result("return",{type:"visit",sceneId:places[m[1]],confirmedContinuity:true});
  if(/^你(?:走出|离开)了酒馆$/.test(s))return result("leave",{type:"leave",reason:"visible-departure"});
  if((m=s.match(/^你从(正门|后门)望去，固定的(柜台和双窗|双窗和柜台)清晰可见$/)))
    return result("view",set("viewpoint",m[1]),set("perspective","玩家所见"),set("features",["柜台","双窗"]));
  if((m=s.match(roster)))return result("roster",set("people",list(m[1])));
  if((m=s.match(doorwayArrival)))return result("doorway-arrival",{type:"add",field:"people",values:list(m[1])});
  if((m=s.match(add)))return result("arrival",{type:"add",field:"people",values:list(m[1])});
  if((m=s.match(remove)))return result("departure",{type:"remove",field:"people",values:list(m[1])});
  if(/^此时是白日，日光照入堂内$/.test(s))return result("daylight",set("timeOfDay","日间"),set("lighting","日光"));
  if(/^(已是傍晚|天色已近黄昏)$/.test(s))return result("dusk",set("timeOfDay","傍晚"));
  if(/^三盏灯笼(?:亮了起来|已经亮起)$/.test(s))return result("lamps",set("lighting","灯笼亮起"));
  if(/^(?:掌柜说：)?“[^“”]*”$/.test(s))return result("quoted-speech");
  if(negated.test(s))return result("negated-event");
  if(/^你打算明天(?:离开|重返)酒馆$/.test(s))return result("intention");
  if(/^你想起上次[^，；：“”]+的情形$/.test(s))return result("memory");
  if(/^你(?:与掌柜闲谈茶价|端起茶盏|继续听掌柜讲茶经)$/.test(s))return result("conversation");
  return null;
}

export function extractSaved({source,narrative,state}) {
  if(source.kind!=="card-history" || source.evidence!=="completed-history")throw Error("completed-card-history-required");
  const evidence=[],operations=[];
  const audit={method,evidence};
  const unknown=reason=>({audit,observations:[{basis:"current-story",playerKnown:true,operation:{type:"unknown",reason}}]});
  const chunks=sentences(narrative);
  if(!chunks?.length){
    evidence.push({start:0,length:narrative.length,rule:"unparsed"});
    return unknown("unparsed-narrative");
  }
  const known=new Map(state.places.map(p=>[p.scene.sceneId,p]));
  let survey=null;
  let current=state.current,hasRoster=!!known.get(current)?.facts.people;
  for(const {value,start,length,question} of chunks){
    const found=question?null:classify(value,known);
    evidence.push({start,length,rule:found?.rule??"unsupported"});
    if(!found)return unknown("unsupported-clause");
    for(const op of found.ops){
      if(op.type==="create"){
        current=op.sceneId;known.set(current,{facts:{}});hasRoster=false;
      }else if(op.type==="visit"){
        if(found.rule==="survey-again"){
          // No inherited field may fill a gap in this re-observation.
          if(survey)return unknown("ambiguous-survey");
          survey=new Set();
        }else if(!known.has(op.sceneId) || (state.reason && state.reason!=="visible-departure"))
          return unknown("unconfirmed-return");
        current=op.sceneId;hasRoster=!!known.get(current).facts.people;
      }else if(op.type==="leave"){
        if(!current)return unknown("missing-baseline");
        current=null;
      }
      else if(!current || (["add","remove"].includes(op.type) && !hasRoster))return unknown("missing-baseline");
      if(survey && op.type==="set")survey.add(op.field);
      if(op.type==="set" && op.field==="people")hasRoster=true;
      operations.push(op);
    }
  }
  if(survey && (survey.size!==6 || operations.filter(op=>["create","visit","leave"].includes(op.type)).length!==1))
    return unknown("incomplete-survey");
  // A permanent structure can be registered at creation only if the same saved passage describes it.
  const created=operations.find(op=>op.type==="create");
  if(created && operations.filter(op=>["create","visit","leave"].includes(op.type)).length===1 &&
     operations.some(op=>op.field==="features" && op.values.includes("柜台")))created.fixedFeatures=["柜台"];
  return {audit,observations:operations.map(operation=>({basis:"current-story",playerKnown:true,operation}))};
}

// Same transaction as the state/checkpoint. Refuse to inherit an unversioned fixture projection.
extractSaved.record=async(db,{scope,revision,audit})=>{
  if(revision>1){
    const previous=await db.query("SELECT 1 FROM yingjie_play.extraction WHERE scope=$1 AND revision=$2 AND audit->>'method'=$3",
      [scope,revision-1,method]);
    if(!previous.rowCount)throw Error("incompatible-projection");
  }
  await db.query("INSERT INTO yingjie_play.extraction(scope,revision,audit) VALUES($1,$2,$3)",[scope,revision,audit]);
};
