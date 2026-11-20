import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { upstream } from "../../scene-state/test/local-db.mjs";

// Bootstrap disposable players through the upstream authentication and ordinary card routes.
export async function createPlayers(context,origin,codes) {
    const post=async(client,path,data)=>{
      const r=await client.post(origin+path,{data,headers:{Origin:origin}});
      assert.ok(r.ok(),path+" HTTP "+r.status());return r.json();
    };
    const login=async client=>{
      const email="yj56-"+randomUUID()+"@example.invalid";
      await post(client,"/api/auth/code",{email});
      return post(client,"/api/auth/verify",{email,code:codes.get(email)});
    };
    await login(context.request);
    const prefix="/api/card-import";
    const preview=await post(context.request,prefix+"/imports",{kind:"card",filename:"cards-demo.json",rightsConfirmed:true,
      bytesBase64:(await readFile(join(upstream,"docs/examples/cards-demo.json"))).toString("base64")});
    const card=await post(context.request,prefix+"/cards",{importId:preview.id,source:"local-test",notes:"YJ-05/06",links:[]});
    const first=randomUUID(),second=randomUUID();
    for(const id of [first,second])await post(context.request,prefix+"/sessions",{id,cardId:card.id});
    return {first,second,login};
}
