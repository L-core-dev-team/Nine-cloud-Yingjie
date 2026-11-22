// This is narrative presence evidence only. A named witness in saved text does
// not widen scene-evidence/2's visual vocabulary or create a drawable Visual.
const fullSurvey = /^此时我身在(?<region>[\p{Script=Han}]+)的(?<place>[\p{Script=Han}]+)。我在[\p{Script=Han}]+朝[东西南北]看去。殿中除(?<people>[\p{Script=Han}、]+)再无旁人。我看清了这里的[\p{Script=Han}]+。此时是[\p{Script=Han}]+。[\p{Script=Han}]+照亮眼前。$/u;
const actualArrival = /^(?<arriver>[\p{Script=Han}]{2,4})走了进来，原来的人都还在，除此再无旁人。观察位置、朝向、结构、时段和光照均未改变。$/u;
export class Meetings {
    pending = new Map();
    settled = new Map();
    room = null;
    step(text, source, digest, events, registry, memory, actions, knownVisual) {
        const proof = { revision: source.revision, sourceKey: source.key, sha256: digest, start: 0, end: text.length, quote: text };
        const key = (a, b, place) => JSON.stringify([memory.person(a), memory.person(b), place]);
        for (const e of events.filter(v => v.type === "promise")) {
            const r = e.roles;
            const wait = events.find(v => v.type === "await" && v.roles.actor === r.other && v.roles.other === r.actor && v.roles.target === r.target);
            const place = registry.resolve(r.target).place;
            if (wait && place) {
                const k = key(r.actor, r.other, place.sceneId);
                if (this.settled.has(k) || this.pending.has(k))
                    continue;
                this.pending.set(k, { promise: e, wait, arriver: r.actor, witness: r.other, scene: place.sceneId });
            }
        }
        for (const e of actions.filter(v => v.kind === "revoke-meeting" && v.confirmed)) {
            const { actor, recipient, place } = e.roles;
            const scene = registry.resolve(place).place;
            if (scene)
                this.pending.delete(key(actor, recipient, scene.sceneId));
        }
        const m = actualArrival.exec(text);
        const survey = fullSurvey.exec(text)?.groups;
        if (!m) {
            this.room = null;
            if (survey) {
                const place = registry.resolve(survey.place, survey.region).place;
                if (place)
                    this.room = { scene: place.sceneId, people: new Set(survey.people.split("、")), evidence: [proof] };
            }
            else if (knownVisual) {
                this.room = { scene: knownVisual.sceneId, people: new Set(knownVisual.people), evidence: [proof] };
            }
            return {};
        }
        const actor = m.groups.arriver, room = this.room;
        if (!room || room.people.has(actor) || memory.ambiguous.has(actor)) {
            this.room = null;
            return {};
        }
        room.people.add(actor);
        const valid = v => v.scene === room.scene && memory.person(v.arriver) === memory.person(actor) &&
            room.people.has(v.witness) && !memory.ambiguous.has(v.witness);
        const matches = [...this.pending.entries()].filter(([, v]) => valid(v));
        if (matches.length !== 1) {
            const repeated = [...this.settled.values()].find(valid);
            room.evidence.push(proof);
            return repeated ? { repeat: repeated.moment } : {};
        }
        const [k, v] = matches[0], moment = source.revision + "@0";
        const evidence = [v.promise.evidence, v.wait.evidence, ...room.evidence, proof];
        room.evidence.push(proof);
        this.pending.delete(k);
        this.settled.set(k, { ...v, moment });
        return { candidate: { kind: "quiet", frame: "visible-arrival", arc: v.promise.id, moment,
                roles: { actor, other: v.witness, scene: room.scene }, evidence,
                links: [{ relation: "payoff", from: v.promise.id, to: moment }, { relation: "setup", from: v.wait.id, to: moment }],
                reason: "约定、等待者、登记地点和实际到场相互印证。" } };
    }
}
