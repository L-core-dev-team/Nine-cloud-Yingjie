import {setImmediate as nextTick} from "node:timers/promises";
import {AssetSchema,AttemptSchema,DecisionSchema,eventKey,referenceEligibility,requestKey} from "../contracts/dist/index.js";
import {visibleSpecification} from "../first-play/consistency.mjs";
import {catalog} from "../world-assets/index.mjs";
import {walkthrough} from "../first-play/story.mjs";
import {pngInfo,sha256} from "../image-tasks/files.mjs";
import {readFile} from "node:fs/promises";
import {digest} from "./reservations.mjs";

const entry="p01-local-fake";
const replies=new Map([["进入酒馆",walkthrough[0]],["迎接旅人",walkthrough[2]],["观察雨幕","檐前的雨丝把人影织成了一层雾。"]]);
const capability=Object.freeze({schemaVersion:"0.1",entry,origin:"mock",verifiedAt:"2026-11-21T00:00:00Z",
  generate:"supported",referenceEdit:"supported",query:"unknown",cancel:"unknown",idempotency:"unknown"});

export function visualDigest(visual) {
  const spec=visibleSpecification(visual);
  spec.people.sort(); spec.features.sort();
  return digest(JSON.stringify(spec));
}

// resolve reads server-owned permission, current target and reference records. Never use card or HTTP fields for it.
// The only destination is the in-process synthetic fixture below; there is no transport, URL or key option.
export function offlineAdapters({resolve,ledger,scenario="return"}) {
  if (!["return","failed","refused","lost"].includes(scenario)) throw Error("unsupported-fake-scenario");
  const observations=[];
  function admitted(ctx,owner,sessionId) {
    const grant=ctx?.grant;
    if (!grant || ctx.authorized!==true || grant.provider!==entry || grant.owner!==owner || grant.sessionId!==sessionId)
      throw Error("not-authorized");
    return grant;
  }

  async function exchange(grant, operation, key, payload, reply, signal) {
    signal?.throwIfAborted();
    const identity=digest(JSON.stringify([operation==="text"?"text":"image",grant.owner,grant.sessionId,key]));
    ledger.reserve(grant,operation,identity);
    // Observations contain the actual allowlisted payload except reference bytes (record their digest only).
    const {referenceBytes,...fields}=payload;
    observations.push(referenceBytes?{...fields,referenceSha256:sha256(referenceBytes)}:fields);
    await nextTick();
    if (scenario==="lost" || signal?.aborted) throw Error("transport-unconfirmed");
    if (scenario==="failed" || scenario==="refused") {
      ledger.finish(identity,scenario);
      return {state:scenario};
    }
    const result=await reply();
    ledger.finish(identity,"returned");
    return {state:"returned",result};
  }

  async function model(input,signal,call) {
    if (typeof call?.key!=="string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(call.key) || !call.owner || !call.sessionId) throw Error("missing-server-call");
    const ctx=await resolve();
    const grant=admitted(ctx,call.owner,call.sessionId);
    const action=input.action;
    if (!replies.has(action) || !Array.isArray(grant.actions) || !grant.actions.includes(action)) throw Error("text-not-cleared");
    // Only the explicitly cleared action is sent. No raw messages, instructions, book, persona or history.
    const response=await exchange(grant,"text",call.key.toLowerCase(),{operation:"text",action},()=>replies.get(action),signal);
    if (response.state!=="returned") throw Error("fake-"+response.state);
    return response.result;
  }

  const provider={capability,async send(claim) {
    const plan=DecisionSchema.parse(claim.plan),attempt=AttemptSchema.parse(claim.attempt);
    if (!["generate","edit"].includes(plan.action) || attempt.requestKey!==requestKey(plan) ||
        attempt.capability.entry!==entry || attempt.capability.origin!=="mock" || attempt.outcome.state!=="waiting" || !attempt.sentAt)
      throw Error("invalid-claim");
    const target=plan.target, source=target.source;
    if (source.kind!=="card-history") throw Error("completed-history-required");
    const ctx=await resolve(plan);
    const grant=admitted(ctx,source.ownerId,source.sessionId);
    if (!ctx.visual || ctx.visual.source.kind!=="card-history" || ctx.visual.source.ownerId!==source.ownerId ||
        ctx.visual.source.sessionId!==source.sessionId || ctx.visual.source.key!==source.key ||
        ctx.visual.source.revision!==source.revision || ctx.visual.visualVersion!==target.visualVersion ||
        visualDigest(ctx.visual)!==visualDigest(target)) throw Error("stale-visual");
    const approved=Array.isArray(grant.images) && grant.images.includes(visualDigest(target));
    const fixture=catalog.find(a=>visualDigest({...a.facts,sceneId:a.sceneId})===visualDigest(target));
    if (!approved || !fixture) throw Error("visual-not-cleared");
    const payload={operation:plan.action,visual:visibleSpecification(target)};
    if (plan.action==="edit") {
      if (ctx.referenceActive!==true || !ctx.asset || !Buffer.isBuffer(claim.referenceBytes))
        throw Error("reference-ineligible");
      const asset=AssetSchema.parse(ctx.asset),bytes=Buffer.from(claim.referenceBytes);
      const observedSha256=sha256(bytes);
      const permit=ctx.referencePermit;
      if (!Array.isArray(grant.references) || !grant.references.includes(observedSha256) || permit?.assetId!==asset.assetId || permit.sha256!==observedSha256 || permit.use!=="edit")
        throw Error("reference-not-cleared");
      if (referenceEligibility(asset,plan,{source,authorized:true,observedSha256})!=="eligible") throw Error("reference-ineligible");
      const info=pngInfo(bytes);
      if (asset.target.source.kind!=="card-history" || asset.target.source.revision>=source.revision ||
          info.width!==asset.width || info.height!==asset.height || info.format!==asset.format) throw Error("reference-ineligible");
      payload.referenceBytes=bytes;
      payload.preservePeople=[...plan.preservePeople];
      payload.preserveFeatures=[...plan.preserveFeatures];
    } else if (claim.referenceBytes!=null) throw Error("unexpected-reference");
    const response=await exchange(grant,plan.action,eventKey(source),payload,async()=>{
      const bytes=await readFile(new URL("../../docs/reports/evidence/"+fixture.file,import.meta.url));
      if (sha256(bytes)!==fixture.reviewedSha256) throw Error("fixture-mismatch");
      return bytes;
    });
    return response.state==="returned"?{state:"returned",bytes:response.result}:response;
  }};
  return {model,provider,observations};
}
