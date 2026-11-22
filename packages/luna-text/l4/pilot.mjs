import {action,prepare} from "./request.mjs";
import {extract,inspectSaved} from "./analysis.mjs";

export const pilot={action,prepare,extract,inspectSaved};
// This credentialed read, initiated by the owner's check button, has no request body or inference.
export async function verifyModel(key,signal,fetchModel){
  try{
    const r=await fetchModel("https://api.openai.com/v1/models/gpt-6-luna",{method:"GET",redirect:"error",
      credentials:"omit",signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),headers:{Authorization:"Bearer "+key}});
    if(!r.ok)return false;
    const info=await r.json();
    return info.id==="gpt-6-luna" && info.object==="model";
  }catch{return false;}
}
