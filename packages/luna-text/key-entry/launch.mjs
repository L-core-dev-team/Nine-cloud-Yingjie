import {serve} from "./server.mjs";
import {inspect,execute} from "../ui-pilot.mjs";
delete process.env.OPENAI_API_KEY;
// A traced or preloaded Node process is unsuitable for entering a credential.
if(process.execArgv.length || ["NODE_DEBUG","NODE_DEBUG_NATIVE","NODE_OPTIONS","SSLKEYLOGFILE","NODE_V8_COVERAGE"]
  .some(name=>process.env[name]))throw Error("KEY_ENTRY_REQUIRES_UNTRACED_NODE");
process.report.reportOnFatalError=false;
process.report.reportOnSignal=false;
process.report.reportOnUncaughtException=false;
const page=await serve({inspect,execute});
// This invite authorizes one local browser. Never pipe it into shared logs.
console.log(JSON.stringify({url:page.url,expiresAt:new Date(page.expiresAt).toISOString()}));
for(const event of ["SIGINT","SIGTERM"])process.once(event,page.close);
