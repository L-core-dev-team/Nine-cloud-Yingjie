import { fromCardHistory, eventKey } from "../contracts/dist/index.js";
import { cardScope, checkpoint, consume, latest, hash, recordConflict } from "./store.mjs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const unlocated = () => [{ basis:"current-story", playerKnown:true,
  operation:{ type:"unknown", reason:"no-confirmed-location-or-visible-facts" } }];

// request(path, options) is bound by the host to the existing Nine-cloud origin and current credential.
// Abort this view's signal on account/session change. Never return database state directly to the UI.
export async function syncCardHistory({ pool, request, sessionId, signal, extract = unlocated }) {
  if (!uuid.test(sessionId)) throw Error("invalid-session");
  signal.throwIfAborted();
  const id = sessionId.toLowerCase();
  const base = "/api/card-import/sessions/" + id;
  const account = await request("/api/auth/session", { signal, cache: "no-store" });
  if (!account.ok) throw Error("account-inaccessible");
  const owner = (await account.json()).account?.id;
  if (typeof owner !== "string" || !owner.trim()) throw Error("missing-authenticated-owner");
  const options = { signal, cache:"no-store", headers:{ "x-jiuxiao-account":owner } };
  async function authorize() {
    signal.throwIfAborted();
    const detail = await request(base, options);
    if (!detail.ok) throw Error("session-inaccessible");
    const row = await detail.json();
    if (row.id !== id || row.owner_id !== owner || !Number.isSafeInteger(row.revision) || row.revision < 0)
      throw Error("session-mismatch");
    const group = await request(base + "/group", options);
    if (group.ok) throw Error("group-not-adapted");
    if (group.status !== 409 || (await group.json()).error !== "NOT_GROUP_SESSION") throw Error("mode-unverified");
    signal.throwIfAborted();
    return row.revision;
  }

  const highWater = await authorize();
  const scope = cardScope(owner,id);
  let after = await checkpoint(pool,scope);
  if (after > highWater) {
    // Another consumer may already have committed a newer, legitimate revision.
    if (after > await authorize()) throw Error("history-regressed");
  }
  let applied = 0;
  while (after < highWater) {
    const response = await request(base + "/history?after=" + after, options);
    if (!response.ok) throw Error("history-inaccessible");
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length > 100 || !rows.length) throw Error("incomplete-history-page");
    for (const [index, row] of rows.entries()) {
      signal.throwIfAborted();
      const { source } = fromCardHistory(owner, id, row);
      if (source.revision > highWater) throw Error("incomplete-history-page");
      const next = rows[index + 1];
      if (source.revision <= after || (next && Number.isSafeInteger(next.resulting_revision) && next.resulting_revision <= source.revision)) {
        const key = eventKey(source);
        const digest = hash(JSON.stringify([key,source.revision,row.action,row.narrative]));
        await recordConflict(pool,[scope,source.revision,key,digest],"unordered-history-page");
        throw Error("unordered-history-page");
      }
      const result = await consume(pool, { source, revision: source.revision, action:row.action, rawNarrative:row.narrative }, extract);
      if (result !== "applied" && result !== "duplicate") throw Error(result);
      if (result === "applied") applied++;
      after = source.revision;
      if (after === highWater) break;
    }
  }
  const saved = await latest(pool,scope);
  const current = await authorize();
  if (current < saved.revision) throw Error("history-regressed");
  signal.throwIfAborted();
  return { revision: saved.revision, applied, result: current === saved.revision ? saved.result :
    { status:"not-ready", reason:"new-history-available" } };
}
