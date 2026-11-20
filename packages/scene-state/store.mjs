import { createHash } from "node:crypto";
import { eventKey, SourceSchema } from "../contracts/dist/index.js";
import { project } from "./project.mjs";

export const hash = text => createHash("sha256").update(text, "utf8").digest("hex");
export const cardScope = (owner, session) => JSON.stringify(["card-history", owner, session.toLowerCase()]);

function scopeOf(source) {
  if (source.kind === "card-history") return cardScope(source.ownerId, source.sessionId);
  if (source.kind === "synthetic-fixture") return JSON.stringify([source.kind, source.fixtureId]);
  throw Error("source-not-adapted");
}

export async function recordConflict(db, identity, reason) {
  await db.query("INSERT INTO yingjie_scene.conflict VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [...identity, reason]);
}

// Internal storage boundary. Never expose it as a client-controlled read endpoint.
export async function checkpoint(pool, scope) {
  const q = await pool.query("SELECT revision FROM yingjie_scene.stream WHERE scope=$1", [scope]);
  return q.rows[0]?.revision ?? 0;
}

export async function latest(pool, scope) {
  const q = await pool.query("SELECT revision,result FROM yingjie_scene.event WHERE scope=$1 ORDER BY revision DESC LIMIT 1", [scope]);
  return q.rows[0] ?? { revision: 0, result: { status: "not-ready", reason: "no-history" } };
}

export async function consume(pool, input, extract) {
  const source = SourceSchema.parse(input.source);
  const scope = scopeOf(source), key = eventKey(source), revision = input.revision;
  if (!Number.isSafeInteger(revision) || revision < 1 || (source.kind === "card-history" && source.revision !== revision))
    throw Error("invalid-revision");
  const digest = hash(JSON.stringify([key, revision, input.action, input.rawNarrative]));
  const identity = [scope, revision, key, digest];
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("INSERT INTO yingjie_scene.stream(scope) VALUES($1) ON CONFLICT DO NOTHING", [scope]);
    const { rows: [stream] } = await db.query("SELECT revision,state FROM yingjie_scene.stream WHERE scope=$1 FOR UPDATE", [scope]);
    const { rows: prior } = await db.query("SELECT revision,event_key,input_hash FROM yingjie_scene.event WHERE scope=$1 AND (revision=$2 OR event_key=$3)", identity.slice(0,3));
    let reason;
    if (prior.length) {
      if (prior.length === 1 && prior[0].revision === revision && prior[0].event_key === key && prior[0].input_hash === digest) {
        await db.query("COMMIT");
        return "duplicate";
      }
      reason = "event-conflict";
    } else if (revision !== stream.revision + 1) {
      reason = revision > stream.revision ? "revision-gap" : "stale-revision";
    }
    if (reason) {
      await recordConflict(db, identity, reason);
      await db.query("COMMIT");
      return reason;
    }
    const narrative = input.rawNarrative.trim();
    const extracted = await extract({ source, narrative, action: input.action.trim(), state:stream.state });
    const observations = Array.isArray(extracted) ? extracted : extracted?.observations;
    const before = new Map(stream.state.places.map(p => [p.scene.sceneId, p.version]));
    const result = project(stream.state, source, observations);
    const accepted = observations.filter(note => note.basis === "current-story" && note.playerKnown === true);
    const versions = stream.state.places.filter(p => p.version > (before.get(p.scene.sceneId) ?? 0))
      .map(p => ({ previous: before.get(p.scene.sceneId) || null, visual: p.visual }));
    await db.query(`INSERT INTO yingjie_scene.event(scope,revision,event_key,input_hash,raw_text_hash,normalized_text_hash,source,observations,versions,result)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [...identity, hash(input.rawNarrative), hash(narrative), source,
        JSON.stringify(accepted), JSON.stringify(versions), result]);
    if (extracted?.audit) {
      await extract.record(db,{scope,revision,audit:extracted.audit});
    }
    await db.query("UPDATE yingjie_scene.stream SET revision=$2,state=$3 WHERE scope=$1", [scope, revision, stream.state]);
    await db.query("COMMIT");
    return "applied";
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
