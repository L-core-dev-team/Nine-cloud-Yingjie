import {statePool} from "../../scene-state/test/local-db.mjs";
import {latest} from "../../scene-state/store.mjs";
import {ImageTasks} from "../../image-tasks/index.mjs";
import {Originals} from "../../image-tasks/files.mjs";
import {TavernProvider} from "../../image-tasks/demo.mjs";

const [database,scope,root]=process.argv.slice(2),pool=statePool(database);
try{
  const mock=new TavernProvider(),tasks=new ImageTasks(pool,new Originals(root),mock);
  const ctx={...await latest(pool,scope),scope,authorized:true},task=await tasks.taskFor(ctx);
  await tasks.recover();
  const serial=Number((await pool.query("SELECT serial FROM yingjie_image.permit WHERE id=$1",[task.permit])).rows[0].serial);
  const retry=await tasks.dispatch(()=>ctx,task.id,task.permit,serial,{retry:true});
  const {rows}=await pool.query("SELECT record FROM yingjie_image.attempt WHERE task=$1",[task.id]);
  const a=rows[0].record;
  console.log(JSON.stringify({attempts:rows.length,state:a.outcome.state,retry,sent:Boolean(a.sentAt),cost:a.cost,remote:a.providerRequestId,sends:mock.calls}));
}finally{await pool.end();}
