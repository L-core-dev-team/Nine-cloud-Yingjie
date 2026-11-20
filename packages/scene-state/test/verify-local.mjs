import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { upstream } from "./local-db.mjs";

const tests = ["live-card.test.mjs","persistence.test.mjs"].map(f=>fileURLToPath(new URL(f,import.meta.url)));
const bin = process.env.CARD_DEMO_POSTGRES_BIN;
const data = join(upstream,".cards-local","postgres");
function ctl(...args) {
  const exe = join(bin,process.platform==="win32" ? "pg_ctl.exe" : "pg_ctl");
  const r = spawnSync(exe,["-D",data,...args],{windowsHide:true,stdio:"ignore",timeout:60000});
  if (r.error) throw r.error;
  return r.status;
}
let started=false;
try {
  if (bin) {
    const status=ctl("status");
    if (status===3) {
      const cfg=JSON.parse(readFileSync(join(upstream,".cards-local","state.json"),"utf8"));
      if (!Number.isInteger(cfg.port) || cfg.port<1 || cfg.port>65535) throw Error("invalid-local-port");
      if (ctl("-l",join(upstream,".cards-local","postgres.log"),"-o","-h 127.0.0.1 -p "+cfg.port,"-w","start")!==0)
        throw Error("local-postgres-start-failed");
      started=true;
    } else if (status!==0) throw Error("local-postgres-status-failed");
  }
  const r=spawnSync(process.execPath,["--test",...tests],{windowsHide:true,stdio:"inherit"});
  if (r.error) throw r.error;
  process.exitCode=r.status ?? 1;
} finally {
  if (started && ctl("-m","fast","-w","stop")!==0) throw Error("local-postgres-stop-failed");
}
