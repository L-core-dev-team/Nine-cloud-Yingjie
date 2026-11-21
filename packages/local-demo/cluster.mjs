import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { once } from "node:events";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

export const upstream = resolve(process.env.NINE_CLOUD_ROOT || ".");
const pinned = "cd25360c7929e10f8b2b0fad342fedd943d4f323";
if (execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], {encoding:"utf8"}).trim() !== pinned)
  throw Error("NINE_CLOUD_ROOT must point to the pinned Nine-cloud checkout");
const {Pool} = createRequire(join(upstream,"apps/api/package.json"))("pg");
const database = "jiuxiao_test_cards_demo";
function tool(name, args) {
  if (!process.env.CARD_DEMO_POSTGRES_BIN) throw Error("set CARD_DEMO_POSTGRES_BIN to the native PostgreSQL bin directory");
  execFileSync(join(process.env.CARD_DEMO_POSTGRES_BIN,name), args, {windowsHide:true,stdio:"ignore",timeout:60000});
}
export function start(dir, state) {
  tool("pg_ctl", ["-D",join(dir,"postgres"),"-l",join(dir,"postgres.log"),"-o","-h 127.0.0.1 -p "+state.port,"-w","start"]);
}
export function stop(dir) { tool("pg_ctl", ["-D",join(dir,"postgres"),"-m","fast","-w","stop"]); }
export function admin(state, db=database) {
  return new Pool({host:"127.0.0.1",port:state.port,user:"cards_local",password:state.password,database:db,connectionTimeoutMillis:4000});
}
// Fresh directory, new cluster and new roles. Never connect to the developer's installed card DB.
export async function fresh() {
  const dir=await mkdtemp(join(tmpdir(),"yj13-demo-"));
  const sock=net.createServer();sock.listen(0,"127.0.0.1");await once(sock,"listening");
  const port=sock.address().port;await new Promise(r=>sock.close(r));
  const key=()=>randomBytes(32).toString("hex");
  const state={format:"yj13-local-v1",id:randomUUID(),port,password:key(),appPassword:key(),secret:key(),installed:false};
  const password=join(dir,"init-password");
  await writeFile(password,state.password,{mode:0o600});
  try {tool("initdb",["-D",join(dir,"postgres"),"-U","cards_local","-A","scram-sha-256","--encoding=UTF8","--no-locale","--pwfile="+password]);}
  finally { await unlink(password); }
  start(dir,state);
  try {
    const maintenance=admin(state,"postgres");
    try {await maintenance.query("CREATE DATABASE "+database);} finally {await maintenance.end();}
    const pool=admin(state),client=await pool.connect();
    try {
      await client.query("BEGIN");
      const migrations=join(upstream,"packages/db/drizzle");
      for(const name of (await readdir(migrations)).filter(s=>/^\d{4}_.*\.sql$/.test(s)).sort())
        await client.query(await readFile(join(migrations,name),"utf8"));
      await client.query("CREATE ROLE jiuxiao_card_runtime NOLOGIN; CREATE ROLE jiuxiao_card_erasure NOLOGIN");
      await client.query("CREATE ROLE cards_demo_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '"+state.appPassword+"'");
      await client.query("GRANT jiuxiao_card_runtime TO cards_demo_app");
      for (const name of ["card-access.sql","card-local-auth.sql"])
        await client.query(await readFile(join(upstream,"packages/db/permissions",name),"utf8"));
      await client.query("COMMIT");
    } finally {client.release();await pool.end();}
    state.installed=true;
    await writeFile(join(dir,"state.json"),JSON.stringify(state),{mode:0o600});
    return {dir,state};
  } catch(error) {stop(dir);throw error;}
}
export async function counters(state) {
  const pool=admin(state);
  try {
    const query=async(sql)=>(await pool.query(sql)).rows;
    return {ip:await query("SELECT CASE WHEN ip IN ('127.0.0.1','::1','unidentified') THEN ip ELSE 'other' END AS identity,count FROM auth_ip_mail_limits ORDER BY count DESC"),
      challenges:(await query("SELECT count(*)::int AS accounts,coalesce(max(window_count),0) AS max_per_email FROM auth_challenges"))[0],
      globalSent:(await query("SELECT coalesce(sum(sent),0)::int AS n FROM auth_mail_limits"))[0].n};
  } finally {await pool.end();}
}
