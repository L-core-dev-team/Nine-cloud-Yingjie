import {readFileSync} from "node:fs";
import {spawn} from "node:child_process";
import {serve} from "../key-entry/server.mjs";
import {inspect,verifyModel,execute} from "./pilot.mjs";
import {prompt} from "./request.mjs";

delete process.env.OPENAI_API_KEY;
if(process.execArgv.length || ["NODE_DEBUG","NODE_DEBUG_NATIVE","NODE_OPTIONS","SSLKEYLOGFILE","NODE_V8_COVERAGE",
  "NODE_EXTRA_CA_CERTS"].some(name=>process.env[name]))throw Error("KEY_ENTRY_REQUIRES_UNTRACED_NODE");
process.report.reportOnFatalError=process.report.reportOnSignal=process.report.reportOnUncaughtException=false;
const html=readFileSync(new URL("./index.html",import.meta.url),"utf8").replace("{{PROMPT}}",prompt);
const page=await serve({inspect,verifyModel,execute,html});
if(process.platform==="win32" && process.argv[2]==="--open"){
  // Send only the single-use invite to the default browser, never the project key.
  const opener=spawn("rundll32.exe",["url.dll,FileProtocolHandler",page.url],{stdio:"ignore",windowsHide:true});
  opener.once("error",()=>{page.close();console.error("本机浏览器启动失败。");});
  console.log("L4 输入页已交给本机浏览器。请保持此窗口开启。");
}else console.log(JSON.stringify({url:page.url,expiresAt:new Date(page.expiresAt).toISOString()}));
for(const event of ["SIGINT","SIGTERM"])process.once(event,page.close);
