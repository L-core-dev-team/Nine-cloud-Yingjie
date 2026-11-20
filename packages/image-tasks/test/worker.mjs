import { statePool } from "../../scene-state/test/local-db.mjs";
import { latest } from "../../scene-state/store.mjs";
import { ImageTasks } from "../index.mjs";
import { Originals } from "../files.mjs";
import { TavernProvider,demoPlan } from "../demo.mjs";

const [database,root,scope,view,mode]=process.argv.slice(2);
const pool=statePool(database);
const provider=new TavernProvider(),files=new Originals(root);
try {
  const ctx={...await latest(pool,scope),scope,authorized:true,action:"走进酒馆"};
  const tasks=new ImageTasks(pool,files,provider,{timeoutMs:100});
  if(mode==="claim-crash") provider.send=()=>process.exit(61);
  if(mode==="before-file")files.save=()=>process.exit(62);
  if(mode==="after-file"){
    const save=files.save.bind(files);
    files.save=async bytes=>{await save(bytes);process.exit(63);};
  }
  const id=await tasks.submit(ctx,view,0,await demoPlan(tasks,ctx));
  if(mode==="queued-crash")process.exit(60);
  const status=await tasks.dispatch(()=>ctx,id,view,0);
  console.log(JSON.stringify({status,calls:provider.calls}));
} finally {await pool.end();}
