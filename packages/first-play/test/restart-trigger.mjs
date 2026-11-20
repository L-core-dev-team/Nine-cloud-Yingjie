// Called only by the local browser integration test against its own disposable PG database.
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {cardRuntime,statePool,upstream} from "../../scene-state/test/local-db.mjs";
import {latest} from "../../scene-state/store.mjs";
import {ImageTasks} from "../../image-tasks/index.mjs";
import {Originals} from "../../image-tasks/files.mjs";
import {TavernProvider} from "../../image-tasks/demo.mjs";
import {WorldAssets} from "../../world-assets/index.mjs";
import {assessFixture} from "../../image-tasks/fixture-review.mjs";
import {chooseFrame} from "../planner.mjs";
import {classifyTrigger,readTriggerEvent} from "../trigger.mjs";
const [database,scope,root]=process.argv.slice(2);
const pool=statePool(database),cards=cardRuntime();
try{
  const {selectWorldbookEntries}=await import(pathToFileURL(join(upstream,"apps/api/dist/card-import/worldbook.js")));
  const world=new WorldAssets(cards.pool,pool,selectWorldbookEntries,{assets:[]});
  const provider=new TavernProvider(),tasks=new ImageTasks(pool,new Originals(root),provider,{assess:assessFixture});
  const ctx={authorized:true,scope,...await latest(pool,scope)};
  ctx.trigger=classifyTrigger(ctx.result,await readTriggerEvent(pool,scope,ctx.revision));
  const pick=await chooseFrame(tasks,world,ctx,true);
  console.log(JSON.stringify({action:pick.action,hold:pick.hold,hasPlan:Boolean(pick.plan),calls:provider.calls}));
}finally{await pool.end();await cards.pool.end();}
