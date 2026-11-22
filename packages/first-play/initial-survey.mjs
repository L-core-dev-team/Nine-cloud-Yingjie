// Opt-in shadow replay. An initial observation can be explicit without establishing a place.
import {extractContinuity} from "./continuity.mjs";
import {bindMethod,sentences} from "./extract.mjs";

const method="zh-visible-clause/3";
const room="(?:堂内|堂里|堂中|厅内|店内|屋内)";
const lighting=new RegExp("^"+room+"(?:日光|阳光)(?:明亮|充足|明朗)$","u");
const feature="(?:柜台|双窗|两扇窗(?:户)?)";
const features=new RegExp("^("+feature+")(?:和|与|、)("+feature+")(?:都|均|皆)?(?:清晰可见|清楚可见|可见)$","u");
const person="(?:掌柜|[蓝赭绿紫青白黑红]衣客)";
const people=new RegExp("^("+person+"(?:(?:、|和|与)"+person+"){0,7})(?:都|均|皆)?在"+room+"$","u");

function localFact(value){
  if(lighting.test(value))return {rule:"observed-indoor-daylight",field:"lighting",values:["日光"]};
  const scene=features.exec(value);
  if(scene && scene.slice(1).includes("柜台") && scene.slice(1).some(v=>v.includes("窗")))
    return {rule:"visible-counter-and-windows",field:"observedFeatures",values:["柜台","双窗"]};
  const members=people.exec(value);
  if(members){
    const names=members[1].split(/[、和与]/u);
    if(new Set(names).size===names.length)return {rule:"observed-present-members",field:"observedPeople",values:names};
  }
  return null;
}
function extract(input){
  const previous=extractContinuity(input);
  const inherited={...previous,audit:{...previous.audit,method}};
  if(input.state.current || input.state.places.length ||
     previous.observations[0]?.operation.reason!=="unsupported-clause")return inherited;
  const evidence=[],facts=[];
  for(const sentence of sentences(input.narrative)??[]){
    if(sentence.question)return inherited;
    let start=sentence.start;
    for(const part of sentence.value.split("，")){
      const value=part.trim(),fact=localFact(value);
      if(!fact)return inherited; // Discard the whole tentative survey on mixed or unsupported scope.
      const span={start:start+part.indexOf(value),length:value.length,rule:fact.rule};
      evidence.push(span);
      facts.push({field:fact.field,values:fact.values,evidenceIndex:evidence.length-1});
      start+=part.length+1;
    }
  }
  if(!facts.length)return inherited;
  return {audit:{method,evidence,partialFacts:facts},observations:[{basis:"current-story",playerKnown:true,
    operation:{type:"unknown",reason:"incomplete-initial-survey",unresolvedPlaces:true}}]};
}
export const extractInitialSurvey=bindMethod(extract,method,{replayOnly:true});
