import {Reservations} from "../../provider-readiness/reservations.mjs";
import {OpenAIImageProvider,fixtureCredential} from "../index.mjs";
import {answer} from "./fixture.mjs";

if(process.permission?.has("net")!==false)throw Error("network-must-be-denied");
const ledger=new Reservations(process.argv[2]);
process.send("ready");
process.once("message",async({ctx,claim,grant,scenario})=>{
  let calls=0;
  try{
    const p=new OpenAIImageProvider({mode:"mock",resolve:()=>ctx,budgetGate:ledger,authorizeOutbound:()=>grant,
      credentialsProvider:()=>fixtureCredential,transport:async()=>{
        calls++;
        if(scenario==="crash")process.exit(73);
        if(scenario==="lost")throw Error("indeterminate");
        const r=answer({usage:{input_tokens:3,output_tokens:6,total_tokens:9}});
        r.headers.set("x-request-id","req_mock");return r;
      }});
    let result;
    if(scenario==="prepare"){
      const transmit=await p.prepare(claim,{}); // I1's separate synthetic-unit ledger only.
      const command=new Promise(resolve=>process.once("message",resolve));
      process.send("prepared");
      if(await command!=="committed")throw Error("not-committed");
      result=await transmit();
    }else result=await p.send(claim);
    process.send({result,calls,networkPermission:process.permission.has("net")});
  }finally{ledger.close();process.disconnect();}
});
