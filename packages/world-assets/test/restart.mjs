import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { statePool,cardRuntime,upstream } from "../../scene-state/test/local-db.mjs";
import { latest } from "../../scene-state/store.mjs";
import { WorldAssets } from "../index.mjs";

const [database,scope]=process.argv.slice(2);
const pool=statePool(database),cards=cardRuntime();
try {
  const {selectWorldbookEntries}=await import(pathToFileURL(join(upstream,"apps/api/dist/card-import/worldbook.js")));
  const service=new WorldAssets(cards.pool,pool,selectWorldbookEntries);
  // Storage recovery probe; HTTP access is tested separately on the live host.
  const match=await service.resolve({authorized:true,scope,...await latest(pool,scope)});
  console.log(JSON.stringify({status:match.status,handle:match.handle,sha256:match.asset?.sha256}));
} finally { await pool.end();await cards.pool.end(); }
