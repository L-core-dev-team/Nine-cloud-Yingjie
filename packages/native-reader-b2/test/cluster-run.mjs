// Internal child of launch.py. Connection secrets are passed through a private pipe.
import {randomBytes,randomInt} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
import {relative,resolve,dirname,basename} from "node:path";
import {tmpdir} from "node:os";
import {loadB2Rules} from "../runtime.mjs";
import {runHistoricalPositive} from "./real-history.mjs";

async function run() {
    const [upstream,directory] = process.argv.slice(2).map(p=>resolve(p));
    const pin = "f1fe6ea561c5ef4d1ec670b7a406625ce5df774c";
    const git = (...args) => execFileSync("git",["-C",upstream,...args],{encoding:"utf8"});
    const require = createRequire(resolve(upstream,"package.json"));
    if (require("pg/package.json").version !== JSON.parse(git("show",pin+":apps/api/package.json")).dependencies.pg)
        throw Error("pg-driver-version");
    const {Pool} = require("pg");
    const core = await loadB2Rules(directory);
    let input = "";
    for await (const part of process.stdin) input += part;
    const {port,password,dataDirectory} = JSON.parse(input);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^[a-f0-9]{64}$/.test(password))
        throw Error("provisioner-required");
    const options = {host:"127.0.0.1",port,user:"b2_admin",password,connectionTimeoutMillis:4000,ssl:false};
    const name = "jiuxiao_test_b2_"+Date.now()+"_"+randomInt(1000000);
    const login = randomBytes(32).toString("hex");
    const maintenance = new Pool({...options,database:"postgres"});
    try {
        if (relative(tmpdir(),dirname(dirname(dataDirectory))) !== "" ||
            !basename(dirname(dataDirectory)).startsWith("yj-native-b2-") || basename(dataDirectory) !== "pgdata")
            throw Error("unexpected-cluster-directory");
        const target = (await maintenance.query("SELECT current_setting('data_directory') AS dir, host(inet_server_addr()) AS host, current_user AS role")).rows[0];
        if (relative(dataDirectory,target.dir) !== "" || target.host !== "127.0.0.1" || target.role !== "b2_admin")
            throw Error("unexpected-cluster");
        await maintenance.query("CREATE DATABASE "+name);
    } finally { await maintenance.end(); }
    const setup = new Pool({...options,database:name});
    const client = await setup.connect();
    try {
        await client.query("BEGIN");
        const journal = JSON.parse(git("show",pin+":packages/db/drizzle/meta/_journal.json"));
        for (const {tag} of journal.entries) {
            if (!/^\d{4}_[a-z0-9_]+$/.test(tag) || /^(0027|0028)_/.test(tag)) throw Error("unexpected-migration");
            await client.query(git("show",pin+":packages/db/drizzle/"+tag+".sql"));
        }
        await client.query("CREATE ROLE b2_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '"+login+"'");
        await client.query("GRANT SELECT,INSERT,UPDATE ON auth_accounts,auth_challenges,auth_mail_limits,auth_ip_mail_limits,game_saves,npc_memory_journals TO b2_app");
        await client.query("GRANT SELECT,INSERT,DELETE ON auth_sessions TO b2_app");
        await client.query("GRANT DELETE ON auth_mail_limits,auth_ip_mail_limits TO b2_app");
        await client.query("GRANT SELECT,INSERT ON turn_requests,turn_events,npc_authorized_observation_outbox TO b2_app");
        await client.query("GRANT SELECT,INSERT ON npc_memory_observation_supersessions TO b2_app");
        await client.query("GRANT SELECT ON cloud_archive_trash TO b2_app");
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); await setup.end(); }
    const pool = new Pool({...options,user:"b2_app",password:login,database:name});
    try {
        const report = await runHistoricalPositive(core,pool,"postgresql://127.0.0.1:"+port+"/"+name);
        console.log(JSON.stringify(report));
    } finally { await pool.end(); }
}
try { await run(); } catch(error) {
    console.error(JSON.stringify({status:"LOCAL_CHAIN_FAILED",errorClass:error.name,code:/^[A-Z0-9_]+$/.test(error.code)?error.code:null}));
    process.exitCode=1;
}
