import { statePool } from "./local-db.mjs";
import { fixtureEvent, scenes, scope } from "./tavern.mjs";
import { consume, latest } from "../store.mjs";

const [database,mode,number]=process.argv.slice(2);
const pool=statePool(database);
try {
  if (mode === "read") {
    console.log(JSON.stringify(await latest(pool,scope)));
  } else {
    const revision=Number(number);
    let target=pool;
    if (mode === "crash") {
      // Terminate the OS process after the journal INSERT, before updating the stream/checkpoint.
      target={connect:async()=>{
        const client=await pool.connect();
        return {release:()=>client.release(),query:(sql,args)=>{
          if (sql.startsWith("UPDATE yingjie_scene.stream")) process.exit(61);
          return client.query(sql,args);
        }};
      }};
    }
    console.log(await consume(target,fixtureEvent(revision),async()=>{
      if (mode === "race") await new Promise(resolve=>setTimeout(resolve,180));
      return scenes[revision-1];
    }));
  }
} finally { await pool.end(); }
