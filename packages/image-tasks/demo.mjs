import { visibleSpecification } from "../first-play/consistency.mjs";
import { assessFixture } from "./fixture-review.mjs";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { sameVisual, schemaVersion } from "../contracts/dist/index.js";
import { scenes } from "../scene-state/test/tavern.mjs";
import { unlocated } from "../scene-state/index.mjs";

const directory=new URL("../../docs/reports/evidence/",import.meta.url);
const evidence=JSON.parse(await readFile(new URL("YJ-02-image-runs.json",directory),"utf8"));
export const pictures=evidence.calls.map(call=>call.output);
export const script=[
  ["走进酒馆","你推开青石酒馆的木门。两位客人各占一桌，掌柜正在柜台后清点茶盏。",scenes[0]],
  ["与掌柜交谈","掌柜指了指远山。客人仍在原位，窗外还是白日。",scenes[1]],
  ["迎接两位旅人","绿衣和紫衣旅人沿后门过道入座。厅内共有五人。",scenes[2]],
  ["离开酒馆","你跨出酒馆，眼前的地点尚未确定。",scenes[3]],
  ["重返酒馆","你回到东村的青石酒馆。方才五人都还在，格局和光线如旧。",scenes[4]],
  ["等到傍晚","天色渐深，掌柜点亮了三盏灯笼，五人仍在堂内。",scenes[5]],
  ["继续饮茶","你端起茶盏，堂内景物如前。",[]],
  ...["失败","拒绝","未知","迟到","待审","跳过"].map(name=>["演练"+name,"酒馆内的景物如前。本轮为"+name+"样例。",[]])
];
export function annotate({narrative}) {
  return script.find(step=>step[1]===narrative)?.[2] ?? unlocated();
}
export function pictureIndex(visual) {
  const names=[...visual.people].sort().join("/");
  const initial=["掌柜","蓝衣客","赭衣客"], five=[...initial,"绿衣客","紫衣客"];
  if(visual.sceneId!=="east" || visual.viewpoint!=="正门" || visual.perspective!=="玩家所见" ||
    [...visual.features].sort().join("/")!==["柜台","双窗"].sort().join("/"))return -1;
  if(visual.timeOfDay==="日间" && visual.lighting==="日光"){
    if(names===initial.sort().join("/"))return 0;
    if(names===five.sort().join("/"))return 1;
  }
  return names===five.sort().join("/") && visual.timeOfDay==="傍晚" && visual.lighting==="灯笼亮起"?2:-1;
}

export class TavernProvider {
  calls=0;
  capability={schemaVersion,origin:"mock",entry:"yj02-local-png",verifiedAt:new Date().toISOString(),
    generate:"supported",referenceEdit:"supported",query:"unknown",cancel:"unknown",idempotency:"unknown"};
  async send({plan,referenceBytes}) {
    this.calls++;
    if(plan.action==="edit" && !referenceBytes)throw Error("reference-required");
    await delay(plan.reason==="演练迟到"?2200:180);
    if(plan.reason==="演练失败")return {state:"failed"};
    if(plan.reason==="演练拒绝")return {state:"refused"};
    if(plan.reason==="演练未知")throw Error("mock-transport-timeout");
    const pic=pictures[pictureIndex(visibleSpecification(plan.target))];
    if(!pic)return {state:"refused"};
    return {state:"returned",bytes:await readFile(new URL(pic.file,directory))};
  }
}

export async function demoPlan(tasks,ctx) {
  const target=ctx.result.visual, base={schemaVersion,target,reason:ctx.action};
  const index=pictureIndex(target);
  if(index<0 || ctx.action==="演练跳过")return {...base,action:"skip"};
  const rows=(await tasks.pool.query(`SELECT a.record FROM yingjie_image.asset a JOIN yingjie_image.attempt t ON t.id=a.id
    WHERE scope=$1 AND a.record->'review'->>'status'='accepted' AND t.record->>'localWait'='active'
    ORDER BY (a.record->'target'->'source'->>'revision')::int DESC`,[ctx.scope])).rows;
  const same=rows.find(({record})=>sameVisual(record.target,target));
  if(same && !ctx.action.startsWith("演练"))return {...base,action:"reuse",assetId:same.record.assetId};
  const parent=rows.find(({record})=>record.target.sceneId===target.sceneId &&
    record.sha256===pictures[Math.max(0,index-1)].sha256)?.record;
  if(!parent)return {...base,action:"generate"};
  return {...base,action:"edit",reference:{assetId:parent.assetId,sha256:parent.sha256,
    visualVersion:parent.target.visualVersion,reviewId:parent.review.id},preservePeople:parent.target.people,
    preserveFeatures:parent.target.features,change:ctx.action};
}

// Local fixture reviewer only. The original YJ-02 inspection applies to these exact three byte strings and facts.
export async function reviewFixture(tasks,ctx,task) {
  const entry=tasks.capability.entry;
  if(!["yj02-local-png","p01-local-fake"].includes(entry) || tasks.capability.origin!=="mock")return;
  if(task.plan.reason==="演练待审")return;
  const row=(await tasks.pool.query(`SELECT a.record FROM yingjie_image.asset a JOIN yingjie_image.attempt t ON t.id=a.id
    WHERE t.task=$1 AND a.scope=$2 AND a.record->'review'->>'status'='pending'
      AND t.record->'capability'->>'entry'=$3 AND t.record->'capability'->>'origin'='mock'`,[task.id,ctx.scope,entry])).rows[0];
  if(!row)return;
  const a=row.record,verdict=assessFixture(a.sha256,a.target);
  if(verdict.status==="pending")return;
  await tasks.review(ctx,a.assetId,{id:a.review.id,...verdict},{onlyPending:true});
}
