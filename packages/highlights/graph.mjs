// Typed antecedents and local argument binding. A remote goal may supply background;
// immediate outcomes and subjectless clauses must be attached to one local event.
const sameAction = (a, b) => a === b || ["交回", "归还", "交还"].includes(a) && ["交回", "归还", "交还"].includes(b)
    || ["保住", "守住", "保全", "守护"].includes(a) && ["保住", "守住", "保全", "守护"].includes(b);
const edge = (relation, from, to) => ({ relation, from: from.id, to: to.id });
const prior = (events, type, predicate) => events.findLast(e => e.type === type && predicate(e.roles));
const follows = (a, b) => a && b && a.evidence.revision === b.evidence.revision && b.ordinal === a.ordinal + 1;
const join = (e, f) => follows(e, f) && e.sentence === f.sentence;
const identity = parts => JSON.stringify(parts);
const weights = { choice: 2, opposition: 1, lastingOutcome: 3, pairedReversal: 3, resolvedObstacle: 2, plantedProof: 3 };
function proposal(kind, topic, anchor, moment, parts, links, signals, framing, explanation) {
    return { kind, topic, anchor: anchor.id, moment: moment.id, fingerprint: identity([kind, anchor.id, topic]),
        events: [...new Map(parts.map(e => [e.id, e])).values()], links, signals,
        score: signals.reduce((total, key) => total + weights[key], 0), framing, explanation };
}
export function connectTurn(history, current, scene, earlierCandidates) {
    const proposals = [];
    const edges = [];
    for (const [i, e] of current.entries()) {
        const before = current[i - 1], next = current[i + 1], after = current[i + 2];
        const r = e.roles;
        // Only earlier clauses are eligible antecedents. No same-revision lookahead for setup.
        const past = history.concat(current.slice(0, i));
        function withdrawn(goal) {
            return past.slice(past.indexOf(goal) + 1).some(v => v.type === "abandon" && v.roles.actor === goal.roles.actor &&
                v.roles.object === goal.roles.object && sameAction(v.roles.verb, goal.roles.verb));
        }
        function disproved(obstacle) {
            return obstacle.type === "conflict" && past.slice(past.indexOf(obstacle) + 1).some(v =>
                v.type === "retract-conflict" && v.roles.actor === obstacle.roles.actor && v.roles.object === obstacle.roles.object);
        }
        if (e.type === "retract-conflict") {
            const priorClaim = prior(past, "conflict", v => v.actor === r.actor && v.object === r.object);
            if (priorClaim) edges.push(edge("correction", priorClaim, e));
        }
        if (e.type === "purpose" && before?.type === "plant" && join(before, e))
            edges.push(edge("setup", before, e));
        if (e.type === "opening" && before?.type === "use" && join(before, e))
            edges.push(edge("consequence", before, e));
        if (e.type === "choice" && before?.type === "cost" && join(before, e)) {
            const actor = before.roles.actor;
            const goal = prior(past, "goal", g => g.actor === actor && g.object === r.object && sameAction(g.verb, r.verb));
            if (!goal || withdrawn(goal))
                continue;
            const obstacle = past.slice(past.indexOf(goal) + 1).findLast(v => v.roles.object === r.object && (v.type === "conflict" && v.roles.actor !== actor ||
                v.type === "prohibition" && v.roles.actor === actor && sameAction(v.roles.verb, r.verb)));
            if (!obstacle || disproved(obstacle))
                continue;
            const parts = [goal, obstacle, before, e], links = [edge("setup", goal, e), edge("turning-point", obstacle, e), edge("cost-of-choice", before, e)];
            const paid = next?.type === "restitution" && follows(e, next) && next.roles.object === r.object && sameAction(r.verb, "归还");
            if (paid) {
                parts.push(next);
                links.push(edge("consequence", e, next));
            }
            proposals.push(proposal(paid ? "quiet" : "turn", r.object, goal, paid ? next : e, parts, links, paid ? ["choice", "opposition", "lastingOutcome"] : ["choice", "opposition"], paid ? "visible-result" : "choice-only", paid ? "此前受阻的归还已经完成，当事人放弃了另一项权益。" : "人物为受阻的目标付出明确代价；结果尚未写明。"));
        }
        if (e.type === "withdrawal" && before?.type === "engagement" && join(before, e) && next?.type === "passage" && follows(e, next)) {
            const conflict = prior(past, "conflict", v => v.actor === r.actor && v.object === r.object);
            if (!conflict || disproved(conflict))
                continue;
            const goal = prior(past.slice(0, past.indexOf(conflict)), "goal", g => g.object === r.object && g.actor !== r.actor && sameAction(g.verb, "守住"));
            if (!goal || withdrawn(goal))
                continue;
            proposals.push(proposal("battle", r.object, goal, next, [goal, conflict, before, e, next], [edge("setup", goal, conflict), edge("turning-point", conflict, e), edge("consequence", e, next)], ["opposition", "resolvedObstacle", "lastingOutcome"], "visible-result", "同一方从原先封住的地点撤出，紧随的通行结果完成了此前目标。"));
        }
        if (e.type === "restitution" && !proposals.some(candidate => candidate.moment === e.id)) {
            // A delayed result may complete a previously costly choice. Require a unique
            // actor's open objective. This link establishes fulfillment, not exclusive causation.
            const relevant = earlierCandidates.filter(c => c.topic === r.object);
            const open = relevant.filter(c => c.kind === "turn" && !relevant.some(o => o.arc === c.arc && o.kind === "quiet"));
            if (open.length === 1) {
                const decision = open[0], goal = past.find(v => v.id === decision.arc);
                const choice = past.find(v => v.id === decision.moment);
                if (goal && choice && sameAction(goal.roles.verb, "归还") && !withdrawn(goal)) {
                    const basis = new Set(decision.evidence.map(v => v.revision + "@" + v.start));
                    proposals.push(proposal("quiet", r.object, goal, e, [...past.filter(v => basis.has(v.id)), e], [...decision.links, edge("consequence", choice, e)], ["choice", "opposition", "lastingOutcome"], "visible-result", "此前唯一仍待落实的归还选择有了同一物件的明确结果。"));
                }
            }
        }
        if (e.type === "release" && next?.type === "bond" && follows(e, next)) {
            const old = prior(past, "estranged", g => g.actor === r.actor && g.other === r.other);
            if (!old)
                continue;
            proposals.push(proposal("emotion", identity([r.actor, r.other]), old, next, [old, e, next], [edge("turning-point", old, e), edge("consequence", e, next)], ["pairedReversal", "opposition"], "inner-change", "同一对人物的旧态度发生逆转，后文确认双方关系已经改变。"));
        }
        if (e.type === "affect" && next?.type === "approach" && follows(e, next) && next.roles.actor === r.actor) {
            const target = next.roles.object;
            const fear = prior(past, "fear", v => v.actor === r.actor && v.object === target);
            const avoid = fear && prior(past.slice(past.indexOf(fear) + 1), "avoid", v => v.actor === r.actor && v.object === target);
            if (!avoid)
                continue;
            proposals.push(proposal("emotion", target, fear, next, [fear, avoid, e, next], [edge("setup", fear, avoid), edge("turning-point", avoid, e), edge("consequence", e, next)], ["pairedReversal", "opposition"], "inner-change", "同一人面对过去一再回避的事物，正文明确写出心境变化，并记录了方向相反的行动。"));
        }
        if (e.type === "use" && next?.type === "opening" && join(e, next) && after?.type === "discovery" && follows(next, after)) {
            const plant = prior(past, "plant", v => v.actor === r.actor && v.object === r.object);
            if (!plant)
                continue;
            const purpose = past[past.indexOf(plant) + 1];
            if (purpose?.type !== "purpose" || !join(plant, purpose) || purpose.roles.target !== next.roles.target)
                continue;
            proposals.push(proposal("quiet", next.roles.target, plant, after, [plant, purpose, e, next, after], [edge("setup", plant, purpose), edge("payoff", purpose, next), edge("consequence", next, after)], ["plantedProof", "lastingOutcome"], "visible-result", "先前留下的凭物由同一人用于约定的目标；被封存的东西重新出现。"));
        }
        if (e.type === "arrival" && scene?.visual?.people.includes(r.actor)) {
            const name = scene.scene.name;
            const waiting = prior(past, "await", v => v.other === r.actor && v.target === name && scene.visual.people.includes(v.actor));
            const promise = waiting && prior(past, "promise", v => v.actor === r.actor && v.other === waiting.roles.actor && v.target === name);
            if (!promise)
                continue;
            proposals.push(proposal("quiet", name, promise, e, [promise, waiting, e], [edge("setup", waiting, e), edge("payoff", promise, e)], ["plantedProof", "lastingOutcome"], "visible-arrival", "正文确认约定的人实际到场；已核对地点和双方在场名单。"));
        }
    }
    return { proposals, edges };
}
