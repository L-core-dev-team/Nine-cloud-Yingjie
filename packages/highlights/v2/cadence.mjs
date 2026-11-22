// Trusted host passes one as-of task/permission snapshot for each source revision.
// Planning a shot consumes no grant. Never manufacture a missing grant or original.
import { reviewAssetUse } from "../../first-play/visual-consistency.mjs";
export function suggest(candidate, checked, visual, context, receipt, snapshot, proposed) {
    const review = checked.reviews[receipt.source.revision - 1];
    const base = { method: "highlight-cadence/1", action: "text-only", send: false, intent: ({
            "visible-arrival": "到场动作", "rights-transfer": "归属改变", "inner-change": "克制情绪", "choice-only": "选择"
        })[candidate.frame] ?? "结果", reason: "moment-not-independently-visible" };
    if (context.enabled !== true)
        return { ...base, reason: "display-disabled" };
    if (candidate.kind === "turn")
        return { ...base, action: "defer", reason: "await-consequence" };
    if (candidate.frame !== "visible-arrival")
        return base;
    if (!review?.imageEligible || !visual)
        return { ...base, reason: "visual-" + (review?.reason ?? "missing") };
    if (candidate.roles.scene !== visual.sceneId || ![candidate.roles.actor, candidate.roles.other].every(p => visual.people.includes(p)))
        return { ...base, reason: "visual-roles-mismatch" };
    const bound = snapshot && snapshot.scope === context.scope && snapshot.revision === receipt.source.revision &&
        snapshot.sourceKey === receipt.source.key && snapshot.narrativeSha256 === receipt.narrativeSha256;
    if (!bound || snapshot.planningAllowed !== true || snapshot.enabled !== true)
        return { ...base, reason: "planning-permission-unverified" };
    if (snapshot.task !== "idle")
        return { ...base, reason: "existing-or-unknown-task" };
    if (snapshot.operation !== "generate") {
        const r = snapshot.reference;
        if (snapshot.operation !== "edit" || !r || r.scope !== context.scope || r.scene !== visual.sceneId ||
            r.accepted !== true || r.active !== true || r.permitted !== true || !/^[a-f0-9]{64}$/.test(r.sha256) ||
            r.sha256 !== r.observedSha256 || r.sha256 !== r.stored?.asset?.sha256 || r.plan?.action !== "edit" ||
            !reviewAssetUse({ review, turns: checked.turns.slice(0, receipt.source.revision), reviews: checked.reviews.slice(0, receipt.source.revision) }, r.plan, r.stored).imageEligible)
            return { ...base, reason: "reference-not-authorized" };
    }
    const target = JSON.stringify([context.scope, visual.sceneId, visual.visualVersion, review.lightSource ?? null]);
    if (proposed.has(target))
        return { ...base, action: "suppress-duplicate", reason: "same-reviewed-visual-target" };
    proposed.add(target);
    return { ...base, action: "director-review", reason: "current-confirmed-arrival", visualVersion: visual.visualVersion,
        sceneId: visual.sceneId, reviewSha256: review.reviewSha256, live: "LIVE_BLOCKED_COST_BOUND" };
}
