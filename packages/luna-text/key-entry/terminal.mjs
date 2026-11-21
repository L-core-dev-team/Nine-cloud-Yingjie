import {pathToFileURL} from "node:url";
import {inspect,execute} from "../ui-pilot.mjs";

// Accept a single hidden line; reject a multi-line paste before it can dispatch.
function readLine(input,limit,signal){
  return new Promise((resolve,reject)=>{
    const bytes=Buffer.alloc(limit);let length=0;
    function stop(error){
      input.off("data",data);input.off("end",closed);input.off("error",closed);
      signal.removeEventListener("abort",closed);
      if(error){bytes.fill(0);reject(error);}
      else resolve(bytes.subarray(0,length));
    }
    function closed(){stop(Error("CANCELLED"));}
    function data(chunk){
      try{
        for(const [index,b] of chunk.entries()){
          if(b===3 || b===27)return closed();
          if(b===13 || b===10){
            if(chunk.subarray(index+1).some(byte=>byte!==13 && byte!==10))return stop(Error("INVALID_INPUT"));
            return stop();
          }
          if(b===8 || b===127){if(length)bytes[--length]=0;continue;}
          if(b<32 || b>126 || length===limit)return stop(Error("INVALID_INPUT"));
          bytes[length++]=b;
        }
      }finally{chunk.fill(0);}
    }
    if(signal.aborted)return closed();
    input.on("data",data);input.once("end",closed);input.once("error",closed);
    signal.addEventListener("abort",closed,{once:true});
  });
}
export async function terminal({input,output,inspect,execute,signal}){
  if(!input.isTTY || !output.isTTY)throw Error("PRIVATE_TERMINAL_REQUIRED");
  const reasons=inspect(false,false).filter(reason=>!["API_KEY_NOT_CONFIGURED","PROJECT_MODEL_STANDARD_ACCESS_UNCONFIRMED"].includes(reason));
  if(reasons.length){output.write("LIVE_BLOCKED · "+reasons.join(", ")+"\n");return;}
  let secret;
  input.setRawMode(true);
  try{
    output.write("九霄 · 映界 | GPT-6 Luna\n仅发送合成酒馆文字，最多一次，总预算 USD 0.10。\n若已核实本项目可用 Luna 和 Standard 美元费率，请输入 API Key，按回车即开始测试。输入不回显，Esc 取消。\n");
    secret=await readLine(input,512,signal);
    if(secret.length<12 || secret.includes(32))throw Error("INVALID_INPUT");
    const takeKey=()=>{
      signal.throwIfAborted();if(!secret)throw Error("KEY_UNAVAILABLE");
      try{return secret.toString("ascii");}finally{secret.fill(0);secret=null;}
    };
    input.pause();input.setRawMode(false);
    output.write("正在核对原单次许可并运行。请保留窗口，结果未知时不会补发。\n");
    const result=await execute({takeKey,signal,verified:true});
    output.write("结果 · "+result.status+"\n");
    return result;
  }finally{secret?.fill(0);input.pause();input.setRawMode(false);}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  delete process.env.OPENAI_API_KEY;
  if(process.execArgv.length || ["NODE_DEBUG","NODE_DEBUG_NATIVE","NODE_OPTIONS","SSLKEYLOGFILE","NODE_V8_COVERAGE"]
    .some(n=>process.env[n]))throw Error("UNTRACED_TERMINAL_REQUIRED");
  process.report.reportOnFatalError=false;process.report.reportOnSignal=false;process.report.reportOnUncaughtException=false;
  const controller=new AbortController();
  for(const s of ["SIGINT","SIGTERM","SIGHUP"])process.once(s,()=>controller.abort());
  const timeout=setTimeout(()=>controller.abort(),15*60_000);
  try{await terminal({input:process.stdin,output:process.stdout,inspect,execute,signal:controller.signal});}
  catch(error){
    const messages={CANCELLED:"已取消输入。",INVALID_INPUT:"密钥输入格式无效。请输入单行密钥。",
      PRIVATE_TERMINAL_REQUIRED:"请在本机交互式终端中运行。"};
    console.log(messages[error.message]??"已停止。请查看本机脱敏回执。");process.exitCode=1;
  }
  finally{clearTimeout(timeout);}
}
