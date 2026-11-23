import { hash } from "../../scene-state/store.mjs";

export const kinds = ["collective", "disposition", "relationship", "payoff", "relief", "agency", "petition"];
export const roles = ["actor", "recipient", "group", "asset", "account"];
export function sourceRow(ctx, i) {
    const r = ctx.receipts[i];
    return Object.freeze({ scope: ctx.scope, session: ctx.sessionId, revision: i+1,
        sourceKey: r.source.key, narrativeSha256: r.narrativeSha256, text: ctx.history[i].narrative });
}
export function sentences(row) {
    return [...row.text.matchAll(/[^。！？；\n]+[。！？；]?/gu)].map(m => ({
        scope: row.scope, session: row.session, revision: row.revision, sourceKey: row.sourceKey,
        narrativeSha256: row.narrativeSha256, start: m.index, end: m.index+m[0].length, quote: m[0]
    }));
}
export function proposal(view, type, spans, entities = {}) {
    const {scope,session,revision} = view.at(-1);
    return { id: hash(JSON.stringify([scope, session, revision, type, spans, entities])), scope, session,
        asOfRevision: revision, learnedAt: revision, type, entities, spans };
}
function requireThat(ok, reason) { if (!ok) throw Error(reason); }
function fields(obj, keys) {
    return obj && typeof obj === "object" && !Array.isArray(obj) &&
        Object.keys(obj).sort().join("|") === keys.slice().sort().join("|");
}
// Wire data is JSON, never an object with executable accessors. Validate the entire
// response before publishing any review items. Sentence boundaries use UTF-16.
export function validateBatch(raw, view) {
    requireThat(typeof raw === "string" && raw.length <= 65536, "wire-limit");
    let batch;
    try { batch = JSON.parse(raw); } catch { throw Error("invalid-json"); }
    requireThat(Array.isArray(batch) && batch.length <= 16, "invalid-batch");
    const last=view.at(-1), ids=new Set();
    for (const c of batch) {
        requireThat(fields(c, ["id","scope","session","asOfRevision","learnedAt","type","entities","spans"]), "candidate-fields");
        requireThat(typeof c.id === "string" && /^[a-zA-Z0-9_-]{1,96}$/u.test(c.id) && !ids.has(c.id), "duplicate-or-invalid-id");
        ids.add(c.id);
        requireThat(c.scope===last.scope && c.session===last.session && c.asOfRevision===last.revision && c.learnedAt===last.revision, "candidate-context");
        requireThat(kinds.includes(c.type) && c.entities && typeof c.entities==="object" && !Array.isArray(c.entities), "hypothesis-shape");
        requireThat(Array.isArray(c.spans) && c.spans.length>0 && c.spans.length<=8, "span-count");
        for (const e of c.spans) {
            requireThat(fields(e,["scope","session","revision","sourceKey","narrativeSha256","start","end","quote"]), "span-fields");
            const row=Number.isSafeInteger(e.revision) && view[e.revision-1];
            requireThat(row && e.scope===row.scope && e.session===row.session && e.sourceKey===row.sourceKey && e.narrativeSha256===row.narrativeSha256, "span-source");
            requireThat(sentences(row).some(s=>s.start===e.start && s.end===e.end && s.quote===e.quote), "span-boundary-or-quote");
        }
        c.spans.sort((a,b)=>a.revision-b.revision || a.start-b.start);
        requireThat(c.spans.at(-1).revision===last.revision, "missing-current-anchor");
        requireThat(c.spans.every((s,i)=>i===0 || s.revision!==c.spans[i-1].revision || s.start>=c.spans[i-1].end), "overlap");
        for (const [key,value] of Object.entries(c.entities))
            requireThat(roles.includes(key) && typeof value==="string" && value.length>0 && value.length<=40 && c.spans.some(s=>s.quote.includes(value)), "ungrounded-entity");
        const anchorNames=Object.values(c.entities).filter(v=>c.spans.some(s=>s.revision===last.revision && s.quote.includes(v)));
        for (const prior of c.spans.filter(s=>s.revision<last.revision))
            requireThat(anchorNames.some(v=>prior.quote.includes(v)), "unbound-prior-context");
    }
    return batch.sort((a,b)=>a.id.localeCompare(b.id,"en"));
}
