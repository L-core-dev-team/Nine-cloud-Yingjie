import {TestPool} from "../../openai-image/test/sqlite-pool.mjs";

// SQLite adaptation of chooseFrame's PostgreSQL latest-attempt LATERAL join.
// Preserve the original scope, scene, version, pending/unknown, and latest-attempt filters.
export class StoryPool extends TestPool {
  async query(text, args = []) {
    if (!text.includes("JOIN LATERAL")) return super.query(text, args);
    if (!text.includes("SELECT t.plan->'target' AS target")) throw Error("unsupported-planner-sql");
    const rows = this.db.prepare(`SELECT t.plan->'target' AS target,
        a.record->'outcome'->>'state' AS outcome, asset.record->'review'->>'status' AS review
      FROM task t JOIN attempt a ON a.id = (
        SELECT latest.id FROM attempt latest WHERE latest.task = t.id ORDER BY ordinal DESC LIMIT 1
      ) LEFT JOIN asset ON asset.id = a.id
      WHERE t.scope = ? AND t.plan->'target'->>'sceneId' = ? AND t.plan->'target'->>'visualVersion' = ?
        AND (a.record->'outcome'->>'state' IN ('waiting','unknown') OR asset.record->'review'->>'status' = 'pending')
      ORDER BY CAST(t.plan->'target'->'source'->>'revision' AS INTEGER) DESC`).all(...args);
    for (const row of rows) row.target = JSON.parse(row.target);
    return {rows, rowCount: rows.length};
  }
}
