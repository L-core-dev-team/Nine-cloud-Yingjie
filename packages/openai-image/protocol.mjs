import {staticPng} from "./png.mjs";
import {model,specification} from "./prompt.mjs";

export const maxPngBytes=16*1024*1024;
export const maxJsonBytes=4*Math.ceil(maxPngBytes/3)+65536;

export function imageRequest(frame,token,signal) {
  const fields={...specification,prompt:frame.prompt};
  const edit=frame.binding.operation==="edit";
  const path=edit?"edits":"generations";
  let body;
  const headers={Authorization:"Bearer "+token};
  if(edit){
    body=new FormData();
    for(const [name,value] of Object.entries(fields))body.set(name,String(value));
    body.set("image[]",new Blob([frame.referenceBytes],{type:"image/png"}),"reference.png");
  }else{
    headers["Content-Type"]="application/json";
    body=JSON.stringify(fields);
  }
  return new Request("https://api.openai.com/v1/images/"+path,{method:"POST",body,headers,signal,redirect:"error",credentials:"omit"});
}

async function readBounded(response,signal) {
  if(!response.body)throw Error("missing-body");
  if(Number(response.headers.get("content-length"))>maxJsonBytes)throw Error("response-too-large");
  const reader=response.body.getReader(),chunks=[];
  const cancel=()=>{void reader.cancel().catch(()=>{});};
  signal.addEventListener("abort",cancel,{once:true});
  let size=0;
  try{
    for(;;){
      signal.throwIfAborted();
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxJsonBytes)throw Error("response-too-large");
      chunks.push(Buffer.from(value));
    }
    signal.throwIfAborted();
    try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks,size)));}
    catch{throw Error("invalid-json");}
  }catch(error){cancel();throw error;}
  finally{signal.removeEventListener("abort",cancel);reader.releaseLock();}
}

function usageTokens(usage){
  if(usage==null)return null;
  const {input_tokens:i,output_tokens:o,total_tokens:t}=usage;
  if(![i,o,t].every(n=>Number.isSafeInteger(n)&&n>=0) || i+o!==t)throw Error("invalid-usage");
  return {unit:"tokens",quantity:t};
}

export async function parseImage(response,signal) {
  if(response.redirected)throw Error("redirected");
  if([400,401,403,422,429].includes(response.status)){
    void response.body?.cancel().catch(()=>{});
    return {state:[401,403].includes(response.status)?"refused":"failed",reason:"http-"+response.status};
  }
  if(response.status>=500)throw Error("http-5xx");
  if(response.status!==200 || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type")??""))
    throw Error("unconfirmed-response");
  const data=await readBounded(response,signal);
  if(data.error || (data.model!==undefined && data.model!==model) ||
     (data.output_format!==undefined && data.output_format!=="png") ||
     (data.quality!==undefined && data.quality!==specification.quality) ||
     (data.size!==undefined && data.size!==specification.size) || !Array.isArray(data.data) || data.data.length!==1)throw Error("wrong-output");
  const item=data.data[0],b64=item?.b64_json;
  if(!item || Object.hasOwn(item,"url") || typeof b64!=="string" || !b64.length ||
     b64.length%4 || b64.length>4*Math.ceil(maxPngBytes/3))throw Error("invalid-image");
  const bytes=Buffer.from(b64,"base64");
  if(bytes.toString("base64")!==b64)throw Error("invalid-base64");
  let info;
  try{info=staticPng(bytes);}catch{throw Error("invalid-png");}
  const {width,height}=info;
  if(width+"x"+height!==specification.size)throw Error("wrong-dimensions");
  const id=response.headers.get("x-request-id");
  if(id!==null && !/^[A-Za-z0-9_-]{1,160}$/.test(id))throw Error("invalid-request-id");
  return {state:"returned",bytes,metadata:{model:data.model??null,
    providerRequestId:id?{value:id,source:"provider-response"}:null,usage:usageTokens(data.usage),cost:null}};
}
