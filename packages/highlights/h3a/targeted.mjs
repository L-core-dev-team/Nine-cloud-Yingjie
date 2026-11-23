import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { session } from "../../first-play/test/s2-host.mjs";
import { replayHighlights2R } from "../h2r/replay.mjs";
import { replayHighlights3A } from "./replay.mjs";
assert.equal(process.permission?.has("net"), false);
const read = p => JSON.parse(readFileSync(p, "utf8")), folder = "docs/reports/evidence/YJ-P04-H3A/";
const pre = read(folder + "pre-fix.json").replay.results;
const old = pre.map(s => ({ id: s.label, texts: s.texts, old: s, expected: s.expected }));
const freeze = read(folder + "new-corpus-freeze.json");
const fresh = freeze.files.flatMap(f => {
    const buf = readFileSync(f.file);
    assert.equal(createHash("sha256").update(buf).digest("hex"), f.sha256);
    return buf.toString("utf8").trimEnd().split("\n").map(JSON.parse);
});
const isRight = c => ["durable-right", "rights-transfer"].includes(c.frame);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const all = [], failures = [];
let prefixes = 0, spans = 0;
for (const s of [...old, ...fresh]) {
    const host = session("h3a-case-" + s.id);
    const contexts = s.texts.map(text => ({ ...host.append(text), replayOnly: true }));
    const final = contexts.at(-1), run = replayHighlights3A(final);
    const baseline = replayHighlights2R(final), newPeaks = run.candidates.filter(isRight), got = newPeaks.map(c => c.revision);
    const reg = run.rounds.filter(r => r.audit.registered.length).map(r => r.revision);
    const issues = [];
    const check = (label, ok) => { if (!ok)
        issues.push(label); };
    check("peak-revisions", s.old ? Boolean(got.length) === s.expected : same(got, s.peaks));
    if (s.register)
        check("registry-revisions", same(reg, s.register));
    if (s.causeRevision)
        check("source-of-effective-disposition", newPeaks.at(-1)?.cause.revision === s.causeRevision);
    if (s.revokedAt)
        check("new-as-of-retracts-old-peak", run.rounds[s.revokedAt - 1].audit.edges.some(e => e.relation === "challenges"));
    if (s.active)
        check("active-ranking", same(run.rounds.at(-1).ranking.map(id => newPeaks.find(c => c.id === id)?.revision).sort((a, b) => a - b), s.active));
    if (s.account)
        check("account-and-beneficiary-distinguished", newPeaks.at(-1)?.roles.account?.endsWith("公账") && newPeaks.at(-1).roles.beneficiary === null);
    if (s.blockedAt)
        check("no-right-committed", !run.rounds[s.blockedAt - 1].audit.changes.settled?.some(change => change.after));
    if (s.id === "temporary-bookkeeping-while-disputed" || s.id === "counterfeit-reported-with-different-wording") {
        const audit = run.rounds.at(-1).audit;
        check("registry-preserved", audit.registered.some(e => e.status === "asserted"));
        check("reason-and-rebuttal", audit.judgments.some(e => e.causalSupport === "unknown" && e.against.length && e.substantiveRight !== "effective"));
        const nominal = s.id === "temporary-bookkeeping-while-disputed";
        check("distinct-document-and-entitlement-verdicts", audit.judgments.some(j =>
            j.documentValidity === (nominal ? "signed" : "invalidated") && j.registryState === "recorded" &&
            j.substantiveRight === (nominal ? "contested" : "unknown") && j.causalSupport === "unknown"));
        check("no-duplicate-or-title-commit", !audit.changes.duplicates && !audit.changes.titles);
    }
    const proof = {}, key = e => e.revision + "@" + e.start + ":" + e.end;
    function compact(data) {
        if (!data || typeof data !== "object")
            return data;
        if (data.quote !== undefined && data.revision) {
            const e = data, j = e.revision - 1;
            assert.equal(e.scope, final.scope);
            assert.equal(e.session, final.sessionId);
            assert.equal(e.sourceKey, final.receipts[j].source.key);
            assert.equal(e.sha256, final.receipts[j].narrativeSha256);
            assert.equal(s.texts[j].slice(e.start, e.end), e.quote);
            if (s.spans) assert.ok(s.spans[j].some(([a,b]) => a <= e.start && e.end <= b));
            spans++;
            proof[key(e)] = e;
            return key(e);
        }
        if (Array.isArray(data))
            return data.map(compact);
        return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, compact(v)]));
    }
    for (const ctx of contexts) {
        const cut = replayHighlights3A(ctx), n = ctx.revision;
        assert.deepEqual(cut.rounds, run.rounds.slice(0, n));
        assert.deepEqual(cut.candidates, run.candidates.filter(c => c.revision <= n));
        assert.deepEqual(cut.edges, run.edges.filter(e => e.learnedAt <= n));
        prefixes++;
    }
    const rounds = run.rounds.map(r => ({ revision: r.revision, cadence: r.cadence, ranking: r.ranking, importance: r.narrativeImportance,
        audit: compact(r.audit) }));
    assert.ok(rounds.every(r => r.cadence.send === false));
    const row = { id: s.id, old: Boolean(s.old), expected: s.old ? s.expected : s.peaks, got, baseline: baseline.candidates.filter(isRight).map(c => c.revision),
        reg, issues, rounds, proof };
    all.push(row);
    if (issues.length)
        failures.push({ id: s.id, issues, got, reg, expected: row.expected });
}
console.log(JSON.stringify({ prefixes, spans, failures, all }));
if (failures.length)
    process.exitCode = 1;
