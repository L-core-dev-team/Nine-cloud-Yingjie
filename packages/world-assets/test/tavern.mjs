import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { digest } from "../sources.mjs";
import { catalogId } from "../index.mjs";
import { cardScope } from "../../scene-state/store.mjs";

export function book(name) {
  return {name,entries:[
    {constant:true,content:name+"记载东村青石酒馆的柜台。"},
    {constant:true,content:"传闻远山藏有宝物，明日有陌生剑客到来。"}
  ]};
}

// Called only for the fresh synthetic account created by createPlayers. Grants never come from HTTP JSON.
export async function prepareTavern(context,origin,pool,baseCard,makeBook=book) {
  const api=async(method,path,data)=>{
    const response=await context.request.fetch(origin+"/api/card-import"+path,{method,data,headers:{Origin:origin}});
    assert.ok(response.ok(),path+" HTTP "+response.status());
    return response.status()===204?null:response.json();
  };
  const importBook=doc=>api("POST","/imports",{kind:"worldbook",filename:"fixture.json",rightsConfirmed:true,
    bytesBase64:Buffer.from(JSON.stringify(doc)).toString("base64")});
  const embedded=makeBook("卡内图志"),linked=makeBook("酒馆结构录"),global=makeBook("东村地志");
  const link=await importBook(linked),snap=await importBook(global);
  const card=await api("POST","/cards/"+baseCard+"/versions",{changes:{character_book:embedded},links:[{uri:"fixture-book",importId:link.id}]});
  await api("PUT","/worldbooks/"+snap.id+"/global",{enabled:true});
  const id=randomUUID(),session=await api("POST","/sessions",{id,cardId:card.id});
  const scope=cardScope(session.owner_id,id);
  async function grant(id,doc,scopeKey=scope){
    const imported=await api("GET","/imports/"+id);
    await pool.query(`INSERT INTO yingjie_world.binding
      (scope,card_id,import_id,import_sha,book_sha,entry_sha,scene_id,parent_id,catalog,tags,fixed_features,basis)
      VALUES($1,$2,$3,$4,$5,$6,'east','东村',$7,ARRAY['东村酒馆'],ARRAY['柜台'],'YJ-07 synthetic fixture only')
      ON CONFLICT DO NOTHING`,[scopeKey,card.id,id,imported.sha256,digest(doc),digest(doc.entries[0]),catalogId]);
  }
  await grant(card.import_id,embedded);await grant(link.id,linked);await grant(snap.id,global);
  return {id,scope,card,owner:session.owner_id,link,snap,api,importBook,grant,embedded,linked,global};
}
