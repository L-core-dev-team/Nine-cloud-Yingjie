import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";

export const digest = value => createHash("sha256").update(value).digest("hex");
const positive = value => Number.isSafeInteger(value) && value > 0;

// Private rehearsal file. Units are synthetic integers, never a currency or a provider quote.
export class Reservations {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA busy_timeout = 3000;
      CREATE TABLE IF NOT EXISTS approval (id TEXT PRIMARY KEY, binding TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reservation (
        identity TEXT PRIMARY KEY, approval TEXT NOT NULL, units INTEGER NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('unknown','returned','failed','refused'))
      );
    `);
  }

  reserve(grant, operation, identity) {
    const {id, owner, sessionId, expiresAt, maxCalls, perCall, total, concurrent, units} = grant;
    const upper = units?.[operation];
    if (![maxCalls, perCall, total, concurrent, upper].every(positive) || upper > perCall)
      throw Error("missing-or-exceeded-limit");
    if (!id || !owner || !sessionId || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now())
      throw Error("invalid-or-expired-grant");
    const binding = digest(JSON.stringify([owner, sessionId, expiresAt, maxCalls, perCall, total, concurrent,
      units.text, units.generate, units.edit,grant.actions,grant.images,grant.references]));
    const db = this.db;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("INSERT OR IGNORE INTO approval VALUES (?,?)").run(id,binding);
      if (db.prepare("SELECT binding FROM approval WHERE id=?").get(id).binding !== binding)
        throw Error("changed-grant");
      if (db.prepare("SELECT 1 FROM reservation WHERE identity=?").get(identity)) throw Error("already-claimed");
      const usage=db.prepare("SELECT count(*) AS calls,coalesce(sum(units),0) AS used,count(*) FILTER (WHERE state='unknown') AS held FROM reservation WHERE approval=?").get(id);
      if (usage.calls >= maxCalls || upper > total-usage.used) throw Error("budget-exhausted");
      if (usage.held >= concurrent) throw Error("slot-held");
      // Commit before the fake boundary. A crash at either side conservatively leaves unknown.
      db.prepare("INSERT INTO reservation VALUES (?,?,?,'unknown')").run(identity,id,upper);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }

  finish(identity,state) {
    if (!["returned","failed","refused"].includes(state)) throw Error("unconfirmed-outcome");
    const result=this.db.prepare("UPDATE reservation SET state=? WHERE identity=? AND state='unknown'").run(state,identity);
    if (result.changes !== 1) throw Error("reservation-mismatch");
  }

  summary() {
    return this.db.prepare("SELECT state,count(*) AS calls,sum(units) AS reservedUnits FROM reservation GROUP BY state ORDER BY state").all();
  }

  close() { this.db.close(); }
}
