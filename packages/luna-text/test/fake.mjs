import {walkthrough} from "../../first-play/story.mjs";
import {modelId} from "../adapter.mjs";
export function reply() {
  return {id:"resp_local_fixture",model:modelId,service_tier:"default",status:"completed",
    usage:{input_tokens:125,output_tokens:58,total_tokens:183,output_tokens_details:{reasoning_tokens:0}},
    output:[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:walkthrough[0]}]}]};
}
