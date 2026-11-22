import {crc32} from "node:zlib";
import {output} from "../../openai-image/test/fixture.mjs";

// Same blank pixels, two distinguishable original files: no visual-quality claim.
const marker=Buffer.from("fixture\0s2-edit"),chunk=Buffer.alloc(marker.length+12);
chunk.writeUInt32BE(marker.length);chunk.write("tEXt",4);marker.copy(chunk,8);
chunk.writeUInt32BE(crc32(chunk.subarray(4,-4)),chunk.length-4);
export const initialPng=output;
export const editedPng=Buffer.concat([output.subarray(0,33),chunk,output.subarray(33)]);
