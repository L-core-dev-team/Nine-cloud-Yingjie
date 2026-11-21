import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { clusterDir } from "./local-db.mjs";

const tests = process.argv.length>2 ? process.argv.slice(2) : ["live-card.test.mjs","persistence.test.mjs"].map(f=>fileURLToPath(new URL(f,import.meta.url)));
const bin = process.env.CARD_DEMO_POSTGRES_BIN;
const data = join(clusterDir,"postgres");
function ctl(...args) {
  const exe = join(bin,process.platform==="win32" ? "pg_ctl.exe" : "pg_ctl");
  const r = spawnSync(exe,["-D",data,...args],{windowsHide:true,stdio:"ignore",timeout:60000});
  if (r.error) throw r.error;
  return r.status;
}
// Only one wrapper may manage pg_ctl for a given cluster while its child tests are running.
const lockName="yj-pg-"+createHash("sha256").update(data).digest("hex").slice(0,24);
const lockPath=process.platform==="win32"?"\\\\.\\pipe\\"+lockName:join(tmpdir(),lockName+".sock");
const lease=createServer(socket=>socket.end());
if(bin)await new Promise((resolve,reject)=>{
  lease.once("error",error=>reject(error.code==="EADDRINUSE"?Error("validation-owner-active"):error));
  lease.listen(lockPath,resolve);
});
let started=false;
try {
  if (bin) {
    const status=ctl("status");
    if (status===3) {
      const cfg=JSON.parse(readFileSync(join(clusterDir,"state.json"),"utf8"));
      if (!Number.isInteger(cfg.port) || cfg.port<1 || cfg.port>65535) throw Error("invalid-local-port");
      if (ctl("-l",join(clusterDir,"postgres.log"),"-o","-h 127.0.0.1 -p "+cfg.port,"-w","start")!==0)
        throw Error("local-postgres-start-failed");
      started=true;
    } else if (status!==0) throw Error("local-postgres-status-failed");
  }
  const r=spawnSync(process.execPath,["--test",...tests],{windowsHide:true,stdio:"inherit"});
  if (r.error) throw r.error;
  process.exitCode=r.status ?? 1;
} finally {
  try{if (started && ctl("-m","fast","-w","stop")!==0) throw Error("local-postgres-stop-failed");}
  finally{if(bin)await new Promise(resolve=>lease.close(resolve));}
}
