import {join} from "node:path";
import {userInfo} from "node:os";
import {openRehearsal} from "./pilot.mjs";
import {readStatus,readStages} from "./audit.mjs";

const root=join(userInfo().homedir,".nine-cloud-yingjie");
const [command,...extra]=process.argv.slice(2);
if(extra.length>(command==="status"?1:0))throw Error("INVALID_ARGUMENTS");
const directory=join(root,"yj-p02-l5-offline");
if(command==="status")console.log(JSON.stringify(extra.length?readStages(directory,extra[0]):readStatus(directory)));
else if(command==="rehearse"){
  await import("../test/loopback-only.cjs");
  const page=await openRehearsal(root);
  console.log("本机一次性模拟邀请（仅在本终端显示）\n"+page.url+"\n核查编号 "+page.runHash);
}else console.log("LIVE_DISABLED · 可用命令 rehearse 或 status");
