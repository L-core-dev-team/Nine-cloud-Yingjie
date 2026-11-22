// Isolated first-turn survey. Inputs come from syncCardHistory after ordinary-card authorization.
import {SourceSchema} from "../contracts/dist/index.js";
import {hash} from "../scene-state/store.mjs";
import {bindMethod, sentences} from "./extract.mjs";
import {extractContinuity} from "./continuity.mjs";

const method = "scene-evidence/1";
const fields = ["place", "viewpoint", "perspective", "people", "features", "timeOfDay", "lighting"];
// This private synthetic index resolves identity only. It supplies no visual facts.
const places = [
  {sceneId:"east", name:"青石酒馆", parentSceneId:"东村"},
  {sceneId:"west", name:"青石酒馆", parentSceneId:"西村"},
  {sceneId:"north-observatory", name:"观星楼", parentSceneId:"北城"}
];
const member = "(?:掌柜|[蓝赭绿紫青白黑红]衣客|值守人|学徒)";
const roster = new RegExp("^(环顾屋内，在场的只有|屋内可见)(" + member + "(?:、" + member + ")*)$","u");
const structure = /^眼前固定的(柜台|双窗|石阶|星盘座)和(柜台|双窗|石阶|星盘座)清晰可见$/u;
const note = operation => ({basis:"current-story", playerKnown:true, operation});
const abandon = reason => [note({type:"unknown",reason,unresolvedPlaces:true})];

function recognize(value) {
  let m = /^你走进(东村|西村|北城)的(青石酒馆|观星楼)$/u.exec(value);
  if (m) {
    const place = places.find(p => p.parentSceneId === m[1] && p.name === m[2]);
    if (place) return {rule:"indexed-arrival", values:{place:{...place}}};
  }
  m = /^你站在(正门|后门|石阶上)，向(北|南|东|西)望去$/u.exec(value);
  if (m) return {rule:"player-position-and-direction", values:{viewpoint:m[1],perspective:"玩家向"+m[2]+"所见"}};
  m = roster.exec(value);
  if (m) {
    const names = m[2].split("、");
    if (new Set(names).size === names.length) return {rule:m[1]==="屋内可见"?"observed-members":"exclusive-roster",
      precision:m[1]==="屋内可见"?"partial":"complete", values:{people:names}};
  }
  m = structure.exec(value);
  if (m && m[1] !== m[2]) return {rule:"visible-fixed-structures",values:{features:m.slice(1)}};
  m = /^此刻已是(清晨|正午|傍晚)$/u.exec(value);
  if (m) return {rule:"explicit-time",values:{timeOfDay:m[1]}};
  m = /^(日光|灯光)照亮屋内$/u.exec(value);
  if (m) return {rule:"observed-light",values:{lighting:m[1]}};
}

function rejectedScope(value,question) {
  if (question) return "ambiguous";
  if (/梦见|想起|记得|昨夜/u.test(value)) return "memory-or-dream";
  if (/打算|计划|明天/u.test(value)) return "plan";
  if (/听说|据说|[“”]/u.test(value)) return "reported";
  if (/并非|没有|不在/u.test(value)) return "negative";
  if (/隐藏|秘密|未揭示/u.test(value)) return "unrevealed";
  if (/也许|好像|下落不明/u.test(value)) return "ambiguous";
  return "unknown";
}

function extract(input) {
  const {narrative,state} = input;
  const source = SourceSchema.parse(input.source);
  if (source.kind !== "card-history") throw Error("completed-card-history-required");
  const audit = {method,source,revision:source.revision,textBasis:"trimmed-completed-history",
    narrativeSha256:hash(narrative),evidence:[]};
  if (source.revision !== 1 || state.places.length || state.current) {
    // Baseline /2 understands tavern continuity. Never bootstrap another scene via its create path.
    const previous = extractContinuity(input);
    const supported = state.places.length && state.places.every(p => ["east","west"].includes(p.scene.sceneId));
    const allowed = supported && previous.observations.every(({operation:op}) =>
      op.type !== "create" && (op.type !== "visit" || state.places.some(p => p.scene.sceneId === op.sceneId)));
    return {audit:{...audit,phase:"continuation",continuityMethod:previous.audit.method,evidence:previous.audit.evidence},
      observations:allowed ? previous.observations : abandon("outside-reviewed-continuity")};
  }

  const coverage = Object.fromEntries(fields.map(f => [f,{precision:"unknown"}]));
  Object.assign(audit,{phase:"initial",fields:coverage});
  const blockers = new Set();
  const clauses = sentences(narrative);
  if (!clauses?.length) blockers.add("unparsed");
  for (const {value,start,length,question} of clauses ?? []) {
    const hit = !question && recognize(value);
    const scope = hit ? "explicit-current" : rejectedScope(value,question);
    const index = audit.evidence.length;
    audit.evidence.push({start,length,rule:hit?.rule ?? "excluded-clause",scope,playerKnown:Boolean(hit)});
    if (!hit) {
      blockers.add("unverified-scope:"+scope);
      continue;
    }
    for (const [field,observed] of Object.entries(hit.values)) {
      if (field === "place" && index !== 0) blockers.add("arrival-after-observations");
      if (coverage[field].precision !== "unknown") blockers.add("repeated-field:"+field);
      else coverage[field] = {precision:hit.precision ?? "complete",value:observed,evidenceIndex:index};
    }
  }
  // A quoted preface, a second location or conflicting claims can change the scope
  // of otherwise recognizable clauses. Preserve their spans, not affirmative facts.
  if (blockers.size) {
    for (const item of audit.evidence) if (item.scope === "explicit-current") {
      item.scope = "unresolved-context";
      item.playerKnown = false;
    }
    for (const field of fields) coverage[field] = {precision:"unknown"};
  }
  for (const field of fields) if (coverage[field].precision !== "complete") blockers.add("incomplete:"+field);
  audit.blockers = [...blockers];
  audit.status = blockers.size ? "not-ready" : "ready";
  if (blockers.size) return {audit,observations:abandon("incomplete-or-ambiguous-initial-survey")};
  const operations = [{type:"create",...coverage.place.value,fixedFeatures:coverage.features.value}];
  for (const field of fields.slice(1)) {
    const {value} = coverage[field];
    operations.push(Array.isArray(value) ? {type:"set",field,values:value} : {type:"set",field,value});
  }
  return {audit,observations:operations.map(note)};
}

export const extractSceneEvidence = bindMethod(extract,method,{replayOnly:true});
