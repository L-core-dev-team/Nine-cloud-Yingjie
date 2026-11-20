import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

export const upstream = resolve(process.env.NINE_CLOUD_ROOT);
if (execFileSync("git", ["-C",upstream,"rev-parse","HEAD"],{encoding:"utf8"}).trim() !==
    "cd25360c7929e10f8b2b0fad342fedd943d4f323") throw Error("wrong-upstream");
export const requireApi = createRequire(join(upstream,"apps/api/package.json"));
const { Pool } = requireApi("pg");
const state = JSON.parse(readFileSync(join(upstream,".cards-local/state.json"),"utf8"));
if (!state.installed || !Number.isInteger(state.port)) throw Error("local-demo-not-installed");
const address = { host:"127.0.0.1",port:state.port,connectionTimeoutMillis:3000 };
export function cardRuntime() {
  return { secret:state.secret, pool:new Pool({ ...address,user:"cards_demo_app",password:state.appPassword,
    database:"jiuxiao_test_cards_demo" }) };
}
export function statePool(database) {
  if (!/^yj04_test_[a-f0-9]{32}$/.test(database)) throw Error("wrong-test-database");
  return new Pool({ ...address, user:"cards_local",password:state.password,database });
}
// Create only a new, randomly named test database. Cleanup only after its own CREATE succeeded.
export async function withDatabase(fn) {
  const database = "yj04_test_" + randomUUID().replaceAll("-","");
  const admin = new Pool({ ...address,user:"cards_local",password:state.password,database:"postgres" });
  let pool;
  try {
    await admin.query("CREATE DATABASE " + database);
    pool = statePool(database);
    await pool.query(readFileSync(new URL("../schema.sql",import.meta.url),"utf8"));
    await fn(pool,database);
  } finally {
    try {
      if (pool) { await pool.end(); await admin.query("DROP DATABASE " + database); }
    } finally { await admin.end(); }
  }
}
