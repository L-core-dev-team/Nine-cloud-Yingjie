import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {cardRuntime,statePool,upstream} from "../../scene-state/test/local-db.mjs";
import {latest} from "../../scene-state/store.mjs";
import {WorldAssets,catalog} from "../../world-assets/index.mjs";
import {Originals} from "../../image-tasks/files.mjs";
import {ImageTasks} from "../../image-tasks/index.mjs";
import {TavernProvider} from "../../image-tasks/demo.mjs";
import {assessFixture} from "../../image-tasks/fixture-review.mjs";
import {ImageHistory} from "../history.mjs";

const [database,scope,directory,revision,id]=process.argv.slice(2);
const pool=statePool(database),cards=cardRuntime();
try{
  const {selectWorldbookEntries}=await import(pathToFileURL(join(upstream,"apps/api/dist/card-import/worldbook.js")));
  const world=new WorldAssets(cards.pool,pool,selectWorldbookEntries,{assets:[catalog[0]]});
  const provider=new TavernProvider(),tasks=new ImageTasks(pool,new Originals(directory),provider,{assess:assessFixture});
  const history=new ImageHistory(tasks,world),ctx={authorized:true,scope,...await latest(pool,scope)};
  if(id){
    try{console.log(await history.decide(ctx,id,"invalidated","local-fixture-review"));}catch(e){if(e.message!=="stale-review")throw e;console.log(e.message);}
  }else{
    const detail=await history.detail(ctx,Number(revision));
    console.log(JSON.stringify({outcomes:detail.attempts.map(a=>a.outcome),media:detail.media.length,replacement:detail.replacement.reason,sends:provider.calls}));
  }
}finally{await pool.end();await cards.pool.end();}
