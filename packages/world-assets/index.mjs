import { assessFixture } from "../image-tasks/fixture-review.mjs";
import { lstat,readFile } from "node:fs/promises";
import { sha256,pngInfo } from "../image-tasks/files.mjs";
import { sameVisual } from "../contracts/dist/index.js";
import { approvedEntries,digest,readSources } from "./sources.mjs";

export const catalogId="yj02-reviewed-tavern-v1";
const evidence=new URL("../../docs/reports/evidence/",import.meta.url);
const receipt=JSON.parse(await readFile(new URL("YJ-02-image-runs.json",evidence),"utf8"));
const day={timeOfDay:"日间",lighting:"日光"};
const three=["掌柜","蓝衣客","赭衣客"], five=[...three,"绿衣客","紫衣客"];
const tavernFacts={I0:{...day,people:three},I1:{...day,people:five},I2:{timeOfDay:"傍晚",lighting:"灯笼亮起",people:five}};
// Pins from the reviewed YJ-02 run. Replacing bytes requires a new review and catalog version.
const reviewed={
  I0:"7a70683b203dc817fd5567130ba53601f84b990d344eac971bd89faf9d10f4ee",
  I1:"004fabce7d1bacae36346e556db0d8017d0fde96e4e6ca99bc59c2a47c808aeb",
  I2:"9feccc88e3814af79055bd71b43ec5757f4b8b8b3460787ef349ed3de4031b3f"
};
export const catalog=receipt.calls.map(call=>({
  id:call.id, catalog:catalogId, version:"V"+(Number(call.id.slice(1))+1),
  source:"YJ-02-image-runs.json#"+call.id, license:"session-granted-synthetic-tavern-only",
  sceneId:"east", parentId:"东村", invalidated:false, format:"png",
  facts:{...tavernFacts[call.id],features:["柜台","双窗"],viewpoint:"正门",perspective:"玩家所见"},
  reviewedSha256:reviewed[call.id],file:call.output.file, sha256:call.output.sha256, size:call.output.bytes,
  pixels:call.output.pixels, review:call.visualReview
}));

function miss(reason,status="no-match") {return {status,reason};}

export function matchPlace(ctx,{sources,bindings},selector) {
  if (!ctx.authorized) throw Error("account-inaccessible");
  if (ctx.result.status!=="ready") return miss("no-current-visual","not-ready");
  if (!sources.length) return miss("no-worldbook");
  const {scene,visual}=ctx.result;
  const visibleTags=new Set([scene.name,scene.parentSceneId,...scene.aliases,...visual.features,...visual.people]);
  if([scene.name,...scene.aliases].some(name=>name.endsWith("酒馆"))){
    visibleTags.add("酒馆");visibleTags.add(scene.parentSceneId+"酒馆");
  }
  const matches=[];
  let reason="no-grant";
  for (const source of sources) {
    for (const b of bindings.filter(row=>row.import_id===source.id && row.card_id===source.card_id)) {
      if (source.sha256!==b.import_sha) {reason="book-version";continue;}
      if (source.invalid || !source.book) {reason="invalid-book";continue;}
      if (digest(source.book)!==b.book_sha) {reason="book-version";continue;}
      const selection=approvedEntries(source.book,selector);
      if (!selection.entries) {reason=selection.reason;continue;}
      if (!selection.entries.some(entry=>digest(entry)===b.entry_sha)) {reason="entry-inactive";continue;}
      if (b.scene_id!==scene.sceneId || b.parent_id!==scene.parentSceneId) {reason="different-place";continue;}
      if (!b.fixed_features.every(f=>scene.fixedFeatures.includes(f) && visual.features.includes(f))) {
        reason="structure-mismatch";continue;
      }
      matches.push({catalog:b.catalog,tags:b.tags.filter(tag=>visibleTags.has(tag)),features:b.fixed_features,
        provenance:{kind:source.kind,card:source.card_id,import:source.id,original:source.sha256,
          book:b.book_sha,entry:b.entry_sha,basis:b.basis}});
    }
  }
  if (!matches.length) return miss(reason);
  if (new Set(matches.map(m=>m.catalog)).size!==1) return miss("conflicting-place-mappings","ambiguous");
  return {status:"candidate",catalog:matches[0].catalog,
    tags:[...new Set(matches.flatMap(m=>m.tags))].sort(),
    features:[...new Set(matches.flatMap(m=>m.features))].sort(),
    sources:matches.map(m=>m.provenance).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};
}

export async function selectPreset(ctx,place,{assets=catalog,directory=new URL("YJ-02/",evidence)}={}) {
  if (!ctx.authorized) throw Error("account-inaccessible");
  if (ctx.result.status!=="ready") return miss("no-current-visual","not-ready");
  if (place.status!=="candidate") return place;
  const {scene,visual}=ctx.result;
  const locations=assets.filter(a=>a.catalog===place.catalog && a.sceneId===scene.sceneId && a.parentId===scene.parentSceneId);
  if (!locations.length) return miss("no-preset");
  const eligible=locations.filter(a=>sameVisual(visual,{
    ...a.facts,source:visual.source,sceneId:a.sceneId,visualVersion:a.version
  }));
  if (!eligible.length) return miss("visual-mismatch");
  if (eligible.length!==1) return miss("conflicting-presets","ambiguous");
  const a=eligible[0];
  if (a.license!=="session-granted-synthetic-tavern-only") return miss("asset-rights");
  if (a.invalidated || a.sha256!==a.reviewedSha256 || a.review?.decision!=="accepted" || a.review.scope!=="synthetic fixture only" ||
      a.review.people!==visual.people.length) return miss("review-ineligible");
  if (a.format!=="png" || !/^I[0-2]$/.test(a.id) || a.file!=="YJ-02/"+a.id+".png") return miss("invalid-original");
  const path=new URL(a.id+".png",directory);
  try {
    const stat=await lstat(path);
    if (!stat.isFile() || stat.size!==a.size || stat.size>16*1024*1024) return miss("invalid-original");
    const bytes=await readFile(path);
    if (sha256(bytes)!==a.sha256) return miss("invalid-original");
    const {width,height}=pngInfo(bytes);
    if (width!==a.pixels[0] || height!==a.pixels[1]) return miss("invalid-original");
    if(assessFixture(a.sha256,visual).status!=="accepted")return miss("review-ineligible");
    // Scope the display handle even for two sessions independently licensed for the same bytes.
    const handle=digest([ctx.scope,scene.sceneId,a.version,a.catalog,a.id,a.sha256,place.sources]);
    return {status:"matched",handle,place,asset:a,bytes};
  } catch(error) {
    return miss(error.code==="ENOENT"?"missing-original":"invalid-original");
  }
}

export class WorldAssets {
  constructor(cards,projection,selectEntries,storage) {
    Object.assign(this,{cards,projection,selectEntries,storage});
  }
  async resolve(ctx,liveRevision=ctx.revision,projection=this.projection) {
    if (!ctx.authorized) throw Error("account-inaccessible");
    if (ctx.result.status!=="ready") return miss(ctx.result.reason??"no-history",
      ctx.result.reason==="ambiguous-place"?"ambiguous":"not-ready");
    const sources=await readSources(this.cards,projection,ctx,liveRevision);
    const place=matchPlace(ctx,sources,this.selectEntries);
    const preset=await selectPreset(ctx,place,this.storage);
    if(preset.status==="matched" && await this.presetWithdrawn?.(ctx.scope,preset.handle,projection))
      return {...miss("review-ineligible"),withdrawn:preset.handle};
    return preset;
  }
}
