import {bindMethod,classify,sentences} from "./extract.mjs";

const method="zh-visible-clause/2";
const guest="(?:掌柜|[蓝赭绿紫青白黑红]衣客)";
const exit=new RegExp("^(?:(?:刚还在|刚才在)(?:柜台边|门边)的)?("+guest+")"+"(?:推门出去了|走出去了)(?:，(?:厅里又安静下来|堂里静了下来))?$");
const absent=new RegExp("^"+guest+"(?:并没有|没有|并未)(?:推门出去|走出大堂)$");
const plan=new RegExp("^"+guest+"(?:打算|计划)(?:推门出去|走出大堂)$");
const indirectEvent=new RegExp("^(?:听说|你记得昨夜|你梦见|明天|昨夜)(?:"+guest+"(?:推门出去了|走出大堂|走进大堂)|众人告辞|只剩掌柜独自守店|掌柜(?:会)?(?:将|把)三盏灯笼(?:一一|逐一)?点亮)$");
const title="[\\p{Script=Han}]{2,12}";
const rename=new RegExp("^这家酒馆(?:正式)?改名为“("+title+")”$","u");
const enter=new RegExp("^你(?:走进|来到)(东村|西村)的("+title+")$","u");
const back=new RegExp("^你回到(东村|西村)的("+title+")，眼前景物与离开时一样$","u");
const grouping="堂里的人纷纷起身告辞";
const remaining=/^(?:门一合，|你环视堂内，)?只剩掌柜(?:独自守店|一人)$/;
const lamps=/^(?:窗纸上|窗外)的日色(?:已经|渐渐)褪尽，掌柜(?:将|把)三盏灯笼(?:一一|逐一)点亮$/;
const locality=/^(?:他出去了|后来走了两人|堂内仿佛只剩掌柜|堂里的人纷纷起身告辞|你从窗缝望去，看不清谁走了|一个看不清面孔的人走进大堂)$/;
const note=operation=>({basis:"current-story",playerKnown:true,operation});
const fields=["people","features","viewpoint","perspective","timeOfDay","lighting"];

function recognize(s,known) {
  const hit=(rule,...ops)=>({rule,ops});
  if(/^([蓝赭绿紫青白黑红]衣客|掌柜)说：“[^“”]*”$/.test(s))return hit("quoted-speech");
  if(indirectEvent.test(s) || plan.test(s))return hit("noncurrent");
  if(absent.test(s))return hit("negated-event");
  if(s==="掌柜仍在堂里")return hit("observed-member",{type:"add",field:"people",values:["掌柜"]});
  let m=s.match(rename);
  if(m)return hit("rename",{type:"rename",name:m[1]});
  const revisiting=back.test(s);
  m=s.match(back)??s.match(enter);
  if(m){
    const matches=[...known.values()].filter(({scene})=>scene.parentSceneId===m[1] &&
      (scene.name===m[2] || scene.aliases?.includes(m[2])));
    if(matches.length===1)return hit(revisiting?"return":"survey-again",{type:"visit",sceneId:matches[0].scene.sceneId,confirmedContinuity:true});
    if(revisiting || matches.length || m[2]!=="青石酒馆")return null;
  }
  m=s.match(exit);
  if(m)return hit("named-exit",{type:"remove",field:"people",values:[m[1]]});
  if(remaining.test(s))return hit("exhaustive-roster",{type:"set",field:"people",values:["掌柜"]});
  if(lamps.test(s))return hit("observed-dusk-lamps",{type:"set",field:"timeOfDay",value:"傍晚"},{type:"set",field:"lighting",value:"灯笼亮起"});
  return classify(s,known);
}

function passages(narrative){
  return sentences(narrative)?.flatMap(chunk=>{
    const speech=chunk.value.match(/^(?:(?:掌柜|[蓝赭绿紫青白黑红]衣客)说：)?“[^“”]*[。！？]”(?=\S)/u);
    if(!speech)return [chunk];
    return [{...chunk,value:speech[0],length:speech[0].length,question:false},
      {...chunk,value:chunk.value.slice(speech[0].length),start:chunk.start+speech[0].length,length:chunk.length-speech[0].length}];
  });
}

function extract({source,narrative,state}) {
  if(source.kind!=="card-history" || source.evidence!=="completed-history")throw Error("completed-card-history-required");
  const chunks=passages(narrative),evidence=[],ops=[];
  const audit={method,evidence};
  const finish=operations=>({audit,observations:operations.map(note)});
  const known=new Map(state.places.map(p=>[p.scene.sceneId,p]));
  let current=state.current,roster=known.get(current)?.facts.people,noncurrentScope=false;
  let locations=0,survey=false;
  const surveyed=new Set();
  // A mixed/unsupported journey could have changed either place. Never revive a stale place on a later visit.
  const unknown=(reason)=>finish([{type:"unknown",reason,unresolvedPlaces:true}]);
  let lastClause=false;
  const hold=reason=>current && !locations && lastClause?finish([{type:"hold",reason}]):unknown(reason);
  if(!chunks?.length){
    evidence.push({start:0,length:narrative.length,rule:"unparsed"});
    return unknown("unparsed-narrative");
  }
  for(const [i,{value,start,length,question}] of chunks.entries()){
    lastClause=i===chunks.length-1;
    let found=question?null:recognize(value,known);
    if(!question && value===grouping && remaining.test(chunks[i+1]?.value??""))found={rule:"roster-context",ops:[]};
    evidence.push({start,length,rule:found?.rule??"unsupported"});
    if(!found)return !question && i===chunks.length-1 && locality.test(value)?hold("unresolved-visible-change"):unknown("unsupported-clause");
    if(noncurrentScope && found.ops.length)return unknown("uncertain-narrative-scope");
    if(["noncurrent","memory","intention"].includes(found.rule))noncurrentScope=true;
    for(const op of found.ops){
      if(op.type==="create" || op.type==="visit"){
        if(++locations!==1 || ops.length)return unknown("ambiguous-journey");
        current=op.sceneId;
        const place=known.get(current);
        roster=place?.facts.people;
        survey=found.rule==="survey-again";
      }else if(op.type==="leave"){
        if(!current || ++locations!==1)return unknown("unconfirmed-departure");
        current=null;
      }else{
        if(!current)return unknown("missing-baseline");
        if(op.type==="remove" && !op.values.every(p=>roster?.includes(p)))return i===chunks.length-1?hold("unconfirmed-member"):unknown("unresolved-sequence");
        if(found.rule==="observed-member" && roster?.includes("掌柜"))continue;
        if(op.type==="add" && !roster)return hold("missing-roster");
        if(known.get(current)?.pending && !survey && op.field)return hold("survey-required");
        if(op.type==="set")surveyed.add(op.field);
        if(op.field==="people"){
          if(op.type==="set")roster=op.values;
          if(op.type==="add")roster=[...new Set([...roster,...op.values])];
          if(op.type==="remove")roster=roster.filter(p=>!op.values.includes(p));
        }
      }
      ops.push(op);
    }
  }
  if(survey){
    if(!fields.every(f=>surveyed.has(f)))return unknown("incomplete-survey");
    if(known.get(current)?.pending)ops.push({type:"confirm-survey"});
  }
  const created=ops.find(op=>op.type==="create");
  if(created && ops.some(op=>op.field==="features" && op.values.includes("柜台")))created.fixedFeatures=["柜台"];
  return finish(ops);
}

export const extractContinuity=bindMethod(extract,method);

// An isolated live ledger first attached to a nonempty history cannot establish that no
// earlier provider attempt was sent. Presets may still be read; dispatch needs reconciliation.
extractContinuity.prepare=async(pool,scope,highWater)=>{
  const mode=highWater===0?"fresh":"historical";
  await pool.query(`INSERT INTO yingjie_scene.stream(scope,state)
    VALUES($1,jsonb_build_object('current',NULL,'places','[]'::jsonb,'reason','no-history','imageLedger',$2::text))
    ON CONFLICT DO NOTHING`,[scope,mode]);
  const row=(await pool.query("SELECT state->>'imageLedger' AS ledger FROM yingjie_scene.stream WHERE scope=$1",[scope])).rows[0];
  return row.ledger!=="fresh";
};
