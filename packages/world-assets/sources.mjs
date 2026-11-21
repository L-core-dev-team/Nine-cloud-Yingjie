import { sha256 } from "../image-tasks/files.mjs";
import { cardScope } from "../scene-state/store.mjs";
import { SceneSchema, VisualSchema } from "../contracts/dist/index.js";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const digest = value => sha256(JSON.stringify(canonical(value)));

// Read only ordinary sessions at their current saved revision. Import payloads are projected
// only for this curator's permitted IDs. A later global setting is never consulted here.
const associated = `
  WITH session AS (
    SELECT s.* FROM card_import.sessions s WHERE s.owner_id=$1 AND s.id=$2 AND s.revision=$3
      AND NOT EXISTS (SELECT 1 FROM card_import.group_participants p
                      WHERE p.owner_id=s.owner_id AND p.session_id=s.id)
  ), refs AS (
    SELECT s.owner_id,s.card_id,c.import_id,'embedded' AS kind FROM session s
      JOIN card_import.cards c ON (c.owner_id,c.id)=(s.owner_id,s.card_id)
    UNION ALL
    SELECT s.owner_id,s.card_id,l.import_id,'linked' FROM session s
      JOIN card_import.links l ON (l.owner_id,l.card_id)=(s.owner_id,s.card_id)
    UNION ALL
    SELECT s.owner_id,s.card_id,w.import_id,'snapshot' FROM session s
      JOIN card_import.session_worldbooks w ON (w.owner_id,w.session_id)=(s.owner_id,s.id)
  )
  SELECT DISTINCT r.card_id,r.kind,i.id,i.sha256,i.error IS NOT NULL AS invalid,
    CASE WHEN i.kind='card' THEN
      (CASE WHEN jsonb_typeof(i.parsed->'document'->'data')='object' THEN i.parsed->'document'->'data' ELSE i.parsed->'document' END) ? 'character_book'
      ELSE true END AS has_book,
    CASE WHEN (r.card_id,i.id,i.sha256) IN (SELECT * FROM unnest($4::uuid[],$5::uuid[],$6::text[])) THEN
      CASE WHEN i.kind='card' THEN (CASE WHEN jsonb_typeof(i.parsed->'document'->'data')='object' THEN i.parsed->'document'->'data' ELSE i.parsed->'document' END)->'character_book'
           ELSE i.parsed->'document' END END AS book
    FROM refs r JOIN card_import.imports i ON (i.owner_id,i.id)=(r.owner_id,r.import_id)
    WHERE i.kind=CASE WHEN r.kind='embedded' THEN 'card' ELSE 'worldbook' END
    ORDER BY r.kind,i.id`;

export async function readSources(cards,projection,ctx,liveRevision=ctx.revision) {
  if (!ctx.authorized) throw Error("account-inaccessible");
  const scene=SceneSchema.parse(ctx.result.scene), visual=VisualSchema.parse(ctx.result.visual);
  const src=visual.source;
  if (src.kind!=="card-history" || scene.source.kind!==src.kind || src.revision!==ctx.revision ||
      cardScope(src.ownerId,src.sessionId)!==ctx.scope ||
      cardScope(scene.source.ownerId,scene.source.sessionId)!==ctx.scope || scene.sceneId!==visual.sceneId)
    throw Error("session-mismatch");
  const bindings=(await projection.query("SELECT * FROM yingjie_world.binding WHERE scope=$1",[ctx.scope])).rows;
  const ids=bindings.map(row=>row.import_id);
  // Only actual session.card_id can grant access. A stale grant to a previous card cannot open its document.
  const cardIds=bindings.map(row=>row.card_id);
  const { rows }=await cards.query(associated,
    [src.ownerId,src.sessionId,liveRevision,cardIds,ids,bindings.map(row=>row.import_sha)]);
  if (!rows.some(r=>r.kind==="embedded")) throw Error("session-inaccessible");
  return {bindings:bindings.filter(b=>b.card_id===rows[0].card_id),sources:rows.filter(r=>r.has_book)};
}

// Image hints accept a deliberately small, deterministic subset. The host supplies Nine-cloud's
// own selector for validation; selected positions/orders never become persistent resource IDs.
export function approvedEntries(book,selectEntries) {
  if (!book || typeof book!=="object" || !book.entries || typeof book.entries!=="object")
    return {reason:"invalid-book"};
  const entries=Object.values(book.entries);
  if (!entries.length) return {reason:"empty-book"};
  const fields=["content","constant","keys","enabled"];
  if (Object.keys(book).some(k=>!["name","description","entries"].includes(k)) ||
      entries.some(e=>!e || typeof e!=="object" || Object.keys(e).some(k=>!fields.includes(k)) ||
        e.constant!==true || typeof e.content!=="string" || !e.content.trim() ||
        (e.enabled!==undefined && typeof e.enabled!=="boolean") ||
        (e.keys!==undefined && (!Array.isArray(e.keys) || e.keys.length))))
    return {reason:"unsupported-rule"};
  try {
    selectEntries([book],[],"",undefined,false);
    return {entries:entries.filter(e=>e.enabled!==false)};
  } catch { return {reason:"unsupported-rule"}; }
}
