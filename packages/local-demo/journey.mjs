import assert from "node:assert/strict";
import {sha256} from "../image-tasks/files.mjs";

export function extend(route) {
  const dialogs=["你与掌柜闲谈茶价。","掌柜说：“明天山里也会下雨。”","你端起茶盏。","你继续听掌柜讲茶经。","蓝衣客说：“昨夜远山有灯。”"];
  return [...route,...dialogs.map(text=>[text,"east",7,5,"unknown"]),
    ["你从窗缝望去，看不清谁走了。","east",null,null,"verify-scene"],
    ["檐前的雨像垂下的珠帘，衣影只一晃便融进了灯色。",null,null,null,"not-ready"]];
}
export async function ledgerCounts(pool){
  const result={};
  for(const table of ["scene.event","image.task","image.attempt","image.asset","history.review_event"])
    result[table]=(await pool.query("SELECT count(*)::int AS n FROM yingjie_"+table)).rows[0].n;
  return result;
}
export async function verifyTurn({page,pool,scope,revision,text,sends}){
  assert.ok((await page.locator("body").innerText()).includes(text),"saved narrative missing from original card UI");
  const event=(await pool.query("SELECT source FROM yingjie_scene.event WHERE scope=$1 AND revision=$2",[scope,revision])).rows[0];
  assert.equal(event.source.evidence,"completed-history");
  assert.equal(event.source.revision,revision);
  return {...await ledgerCounts(pool),mockSends:sends,bodyHash:sha256(Buffer.from(text))};
}
