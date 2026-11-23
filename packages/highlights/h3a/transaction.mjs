import { hash } from "../../scene-state/store.mjs";
const keyOf = (asset, right) => JSON.stringify([asset, right]);
const identityOK = s => typeof s === "string" && !/^(?:他|她|其|他们|她们|对方|那人|某人)$|\p{Script=Han}[和与]\p{Script=Han}|声称|打算|据说|曾经|实际上并非/u.test(s);
const tables = ["titles", "pending", "registry", "limits", "settled", "duplicates", "candidates", "aliases", "identities"];
export const emptyLedger = () => Object.fromEntries(tables.map(t => [t, new Map()]));
const ref = e => e.revision + "@" + e.start;
function bindAsset(store, word, right) {
    if (!word)
        return null;
    const found = [...store.titles.values()].filter(t => t.right === right && (t.asset === word ||
        t.asset.replace(/^[老旧新]/u, "") === word || store.aliases.get(word)?.names.includes(t.asset)));
    return found.length === 1 ? found[0] : null;
}
function matchingKeys(text, records, right) {
    const all = [...records];
    // Localize a challenge to an explicitly identified asset before narrowing by
    // right. An unqualified document reference can suspend, never confirm, claims.
    const named = all.filter(([, v]) => text.includes(v.asset) || text.includes(v.asset.replace(/^[老旧新]/u, "")));
    return (named.length ? named : all).filter(([, v]) => !right || v.right === right).map(([key]) => key);
}
function delta(before, after) {
    const changes = {};
    for (const table of tables) {
        const entries = [];
        for (const k of new Set([...before[table].keys(), ...after[table].keys()])) {
            const a = before[table].get(k), b = after[table].get(k);
            if (a !== b)
                entries.push({ key: k, before: a ?? null, after: b ?? null });
        }
        if (entries.length)
            changes[table] = entries;
    }
    return changes;
}
export function reviewRevision(before, collection, receipt, ctx, previousFocus) {
    const draft = Object.fromEntries(tables.map(t => [t, new Map(before[t])]));
    const revision = receipt.source.revision, edges = [], judgments = [], proposals = [], registered = [];
    const { observations, assertions } = collection;
    const challenges = observations.filter(f => f.kind === "challenge" || f.kind === "unresolved");
    let focus = null;
    function invalidate(key, ev, why, layer = "document") {
        const open = draft.pending.get(key);
        if (open) {
            const validity = layer === "document" ? (/待定|异议|条件/u.test(ev.quote) ? "contested" : "invalidated") : open.validity;
            edges.push({relation:"challenges-"+layer,from:ref(ev),to:ref(open.evidence),learnedAt:revision,why});
            draft.pending.set(key, { ...open, validity, against: [...open.against, ev], barriers: [...(open.barriers ?? []), layer] });
            if (layer === "document" && !/前次|前一|旧契|前份/u.test(ev.quote))
                return;
        }
        const active = draft.settled.get(key);
        if (!active)
            return;
        // Retract only as of this revision, including any descendants that relied
        // on the invalidated source. Earlier rounds own immutable snapshots.
        const lineage = [];
        for (let c = draft.candidates.get(active.id); c; c = draft.candidates.get(c.parent))
            lineage.push(c);
        const matched = lineage.filter(c => ev.quote.includes(c.roles.actor) || ev.quote.includes(c.roles.after));
        const affected = new Set((matched.length ? matched : lineage).map(c => c.id));
        for (const [id, c] of draft.candidates) {
            if (c.parent && affected.has(c.parent))
                affected.add(id);
        }
        for (const id of affected) {
            const c = draft.candidates.get(id);
            if (!c || c.status !== "active")
                continue;
            draft.candidates.set(id, { ...c, status: "contested", learnedAt: revision, against: [...c.against, ev] });
            draft.duplicates.delete(c.fingerprint);
            edges.push({ relation: "challenges", from: ref(ev), to: id, learnedAt: revision, why });
        }
        const t = draft.titles.get(key);
        if (t)
            draft.titles.set(key, { ...t, status: "unknown", evidence: ev });
        draft.settled.delete(key);
    }
    for (const [index, f] of observations.entries()) {
        const ev = f.evidence, word = f.asset, right = f.right ?? "所有权";
        const title = bindAsset(draft, word, right);
        if (f.kind === "title") {
            if (!identityOK(f.actor) || !identityOK(word))
                continue;
            const key = keyOf(word, right), old = draft.titles.get(key);
            if (old?.actor !== f.actor && old)
                invalidate(key, ev, "different-current-holder");
            if (!old || old.actor !== f.actor || old.status !== "known") {
                draft.titles.set(key, { actor: f.actor, asset: word, right, status: "known", evidence: ev });
                if (old)
                    draft.pending.delete(key);
            }
            focus = { actor: f.actor, key, evidence: ev };
            continue;
        }
        if (f.kind === "alias" && title && identityOK(f.alias)) {
            const old = draft.aliases.get(f.alias);
            draft.aliases.set(f.alias, { names: [...new Set([...(old?.names ?? []), title.asset])], evidence: ev });
            continue;
        }
        if (f.kind === "homonym") {
            draft.identities.set(f.actor, { status: "ambiguous", evidence: ev });
            for (const [k, d] of draft.pending)
                if (d.actor === f.actor || d.to === f.actor)
                    draft.pending.set(k, { ...d, identity: "ambiguous", identityProof: ev });
            continue;
        }
        if (f.kind === "identify") {
            const matches = [...draft.pending].filter(([, d]) => d.actor === f.actor && d.identity === "ambiguous");
            if (matches.length === 1) {
                const [k, d] = matches[0];
                draft.pending.set(k, { ...d, identity: "verified", identityProof: ev });
            }
            continue;
        }
        if (f.kind === "registry") {
            const record = { status: "asserted", asset: title?.asset ?? word ?? null, namedParty: f.to ?? null, right, evidence: ev, learnedAt: revision };
            registered.push(record);
            draft.registry.set(keyOf(record.asset ?? ref(ev), right), record);
            continue;
        }
        if (f.kind === "reported" || f.kind === "unresolved") {
            // An opaque intervening statement cannot authenticate a deed. Keep the
            // record and require fresh support, without erasing an established title.
            for (const k of matchingKeys(ev.quote, draft.titles, null)) {
                const d = draft.pending.get(k);
                if (d && d.validity === "signed")
                    draft.pending.set(k, { ...d, validity: "unverified", against: [...d.against, ev] });
            }
            continue;
        }
        if (f.kind === "challenge") {
            for (const k of matchingKeys(ev.quote, draft.titles, f.target === "substance" ? f.right : null)) {
                if (f.ongoing)
                    draft.limits.set(k, { evidence: ev });
                invalidate(k, ev, f.why, f.target);
            }
            if (f.target === "registry") {
                for (const [k, r] of draft.registry) {
                    if (r.asset && !matchingKeys(ev.quote, [...draft.registry].filter(([, v]) => v.asset), null).includes(k))
                        continue;
                    const update = { ...r, status: "disputed", against: ev, learnedAt: revision };
                    draft.registry.set(k, update);
                    const i = registered.indexOf(r);
                    if (i >= 0)
                        registered[i] = update;
                }
            }
            continue;
        }
        if (f.kind === "release-limit") {
            const keys = matchingKeys(ev.quote, draft.titles, null);
            if (keys.length === 1)
                draft.limits.delete(keys[0]);
            continue;
        }
        if (f.kind === "retain") {
            const keys = matchingKeys(ev.quote, draft.titles, right);
            if (keys.length === 1 && identityOK(f.actor)) {
                const t = draft.titles.get(keys[0]);
                draft.titles.set(keys[0], { ...t, actor: f.actor, status: "known", parent: null, evidence: ev });
            }
            continue;
        }
        const prev = observations.slice(0, index).findLast(o => o.kind !== "registry"), useFocus = previousFocus && ev.start === 0;
        let target = title;
        if (!word && f.kind === "sign" && useFocus)
            target = draft.titles.get(previousFocus.key);
        if (!word && f.kind === "effect" && prev?.kind === "sign" && prev.evidence.revision === revision &&
            /^[，,]\s*$/u.test(ctx.history[revision - 1].narrative.slice(prev.evidence.end, ev.start)))
            target = bindAsset(draft, prev.asset, right);
        if (!target || target.right !== right) {
            if (f.kind === "effect")
                judgments.push({ asOfRevision: revision, learnedAt: revision, statement: ev, documentValidity: "unknown",
                    registryState: registered.some(r=>r.evidence.start===ev.start) ? "recorded" : "unverified", substantiveRight: "unknown", causalSupport: "unknown", support: [], against: [], reason: "unbound-asset-or-right" });
            continue;
        }
        const key = keyOf(target.asset, right);
        if (f.kind === "sign") {
            const actor = identityOK(f.actor) ? f.actor : useFocus && ["他","她"].includes(f.actor) ? previousFocus.actor : null;
            if (target.status !== "known" || actor !== target.actor || draft.identities.has(actor) || f.to && (!identityOK(f.to) || actor === f.to))
                continue;
            const old = draft.pending.get(key);
            const competing = old?.validity === "competing" || old?.validity === "signed" && old.to !== f.to;
            draft.pending.set(key, { actor, asset: target.asset, right, to: f.to ?? null, validity: competing ? "competing" : "signed",
                identity: "bound", identityProof: (useFocus && !identityOK(f.actor) ? previousFocus.evidence : draft.aliases.get(word)?.evidence) ?? target.evidence,
                against: competing ? [old.evidence] : [], prior: target, evidence: ev });
            continue;
        }
        if (f.kind !== "effect")
            continue;
        const doc = draft.pending.get(key);
        const support = [target.evidence, draft.aliases.get(word)?.evidence, doc?.identityProof, doc?.evidence, ev].filter(Boolean);
        const proof = [...new Map(support.map(e => [ref(e), e])).values()];
        const later = challenges.filter(c => c.evidence.start >= ev.start && matchingKeys(c.evidence.quote, draft.titles, c.target === "substance" ? c.right : null).includes(key));
        for (const next of observations.slice(index + 1)) {
            if (!next.asset || bindAsset(draft, next.asset, next.right)?.asset !== target.asset || next.right !== right)
                continue;
            if (next.kind === "sign" && next.actor === f.to)
                break;
            if (next.kind === "title" && next.actor !== f.to || next.kind === "effect" && next.to !== f.to)
                later.push({ ...next, target: "substance" });
        }
        const limit = draft.limits.get(key);
        const preexisting = challenges.filter(c => c.ongoing && c.evidence.start < ev.start &&
            matchingKeys(c.evidence.quote, draft.titles, c.right).includes(key) &&
            !observations.slice(0, index).some(release => release.kind === "release-limit" && release.evidence.start > c.evidence.start &&
                matchingKeys(release.evidence.quote, draft.titles, null).length === 1 && matchingKeys(release.evidence.quote, draft.titles, null)[0] === key));
        const against = [...(doc?.against ?? []), ...later.map(c => c.evidence), ...preexisting.map(c => c.evidence), ...(limit ? [limit.evidence] : [])];
        const recorded = registered.some(r => r.evidence.start === ev.start);
        const implicitRecipient = doc && !doc.to && doc.evidence.revision === revision &&
            ctx.history[revision - 1].narrative.slice(doc.evidence.end, ev.start).match(/^[，,]\s*$/u);
        const consent = doc?.to === f.to || implicitRecipient || right === "收益权" && !doc?.to && f.account;
        const valid = target.status === "known" && doc?.validity === "signed" && doc.identity !== "ambiguous" && consent &&
            doc.actor === target.actor && identityOK(f.to) && f.to !== doc.actor && !draft.identities.has(f.to) && !against.length;
        const evaluation = { asOfRevision: revision, learnedAt: revision, statement: ev, documentValidity: doc?.validity ?? "unknown",
            registryState: later.some(c => c.target === "registry") ? "disputed" : recorded ? "recorded" : "unverified", substantiveRight: valid ? "effective" :
                limit || preexisting.length || doc?.barriers?.includes("substance") || later.some(c => c.target === "substance") ? "contested" : "unknown",
            causalSupport: valid ? "supported" : "unknown", support: proof, against,
            reason: valid ? "compatible-authorized-disposition-and-effective-result" : against.length ? "rebuttal-or-unresolved-context" : "no-compatible-valid-disposition" };
        judgments.push(evaluation);
        for(const rebuttal of new Set(against))
            edges.push({relation:"withholds-confirmation",from:ref(rebuttal),to:ref(ev),learnedAt:revision});
        if (!valid)
            continue;
        const fingerprint = JSON.stringify([key, doc.actor, f.to, ref(doc.evidence)]);
        if (draft.duplicates.has(fingerprint))
            continue;
        const id = hash(JSON.stringify(["narrative-highlight/3a", ctx.scope, receipt.source.key, fingerprint]));
        const roles = { asset: target.asset, actor: doc.actor, right, after: f.account ?? f.to, beneficiary: right === "收益权" && f.account ? null : f.to, account: f.account ?? null };
        const candidate = { id, method: "narrative-highlight/3a", replayOnly: true, revision, learnedAt: revision,
            kind: "quiet", frame: "durable-right", source: receipt.source, roles, status: "active", parent: target.parent ?? null,
            score: 9 + (revision - doc.prior.evidence.revision >= 8 ? 2 : 1), fingerprint, reason: evaluation.reason,
            evidence: proof, against: [], cause: doc.evidence, review: evaluation };
        draft.candidates.set(id, candidate);
        draft.duplicates.set(fingerprint, id);
        draft.settled.set(key, { id, asset: target.asset, right, evidence: ev });
        draft.titles.set(key, { ...target, actor: f.account ?? f.to, status: f.account ? "destination-only" : "known", parent: id, evidence: ev });
        draft.pending.delete(key);
        proposals.push(candidate);
        edges.push({ relation: "effective-under", from: ref(doc.evidence), to: id, learnedAt: revision });
    }
    return { draft, focus: assertions.length === 1 && observations.length === 1 ? focus : null,
        audit: { asOfRevision: revision, assertions, observations, registered, judgments, edges, changes: delta(before, draft) },
        candidates: proposals.filter(c => draft.candidates.get(c.id)?.status === "active") };
}
