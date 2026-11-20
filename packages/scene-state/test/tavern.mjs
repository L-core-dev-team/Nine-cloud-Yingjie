import { schemaVersion } from "../../contracts/dist/index.js";

const fact = (operation, basis="current-story", playerKnown=true) => ({basis,playerKnown,operation});
const set = (field,value) => fact(Array.isArray(value) ? {type:"set",field,values:value} : {type:"set",field,value});
const visit = sceneId => fact({type:"visit",sceneId,confirmedContinuity:true});
const create = (sceneId,parentSceneId) => fact({type:"create",sceneId,parentSceneId,name:"青石酒馆",fixedFeatures:["柜台"]});
const travel = {type:"leave",reason:"离开"};
export const fixtureId="yj04-tavern";
export const scope=JSON.stringify(["synthetic-fixture",fixtureId]);
export const scenes = [
  [create("east","东村"),set("people",["掌柜","蓝衣客","赭衣客"]),set("features",["柜台","双窗"]),
    set("timeOfDay","日间"),set("lighting","日光"),set("viewpoint","正门"),set("perspective","玩家所见")],
  [fact(travel,"rumor"),fact(travel,"memory"),fact(travel,"plan"),fact(travel,"current-story",false),
    fact({type:"add",field:"features",values:["光点"]},"image-detail")],
  [fact({type:"add",field:"people",values:["绿衣客","紫衣客"]})],
  [fact(travel)],
  [visit("east")],
  [set("timeOfDay","傍晚"),set("lighting","灯笼亮起")],
  [fact({type:"rename",name:"老周的店"})],
  [create("west","西村")],
  [fact({type:"visit",name:"青石酒馆",confirmedContinuity:true})],
  [fact({type:"visit",name:"青石酒馆",parentSceneId:"东村",confirmedContinuity:true})],
  [fact({type:"remove",field:"people",values:["绿衣客"]})],
  []
];
export function fixtureEvent(revision) {
  return { source:{ schemaVersion,kind:"synthetic-fixture",fixtureId,eventId:"stage-"+revision },
    revision,action:"合成样例",rawNarrative:"  场景样例 "+revision+"  " };
}
