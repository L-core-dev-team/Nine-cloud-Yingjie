import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
import {resolve,relative} from "node:path";
import {randomUUID} from "node:crypto";
import {loadB2Rules} from "../native-reader-b2/runtime.mjs";

const pin="f1fe6ea561c5ef4d1ec670b7a406625ce5df774c";
export async function openNative(config,folder,store,{provision=true}={}) {
  const {Pool}=createRequire(resolve(config.upstream,"package.json"))("pg");
  const options={host:"127.0.0.1",port:config.pgPort,database:"postgres",user:"p05_admin",password:config.admin};
  const admin=new Pool(options);
  try {
    const row=(await admin.query("SELECT current_setting('data_directory') d,current_user u,host(inet_server_addr()) h")).rows[0];
    if(relative(resolve(folder,"pgdata"),row.d)||row.u!=="p05_admin"||row.h!=="127.0.0.1")throw Error("cluster mismatch");
    if(!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='p05_app'")).rowCount){
      if(!provision)throw Error("existing initialized cluster required");
      const c=await admin.connect();
      try {
        await c.query("BEGIN");
        const git=file=>execFileSync("git",["-C",config.upstream,"show",pin+":"+file],{encoding:"utf8"});
        for(const {tag} of JSON.parse(git("packages/db/drizzle/meta/_journal.json")).entries){
          if(!/^\d{4}_[a-z0-9_]+$/.test(tag))throw Error("unexpected migration");
          await c.query(git("packages/db/drizzle/"+tag+".sql"));
        }
        if(!/^[a-f0-9]{64}$/.test(config.app))throw Error("bad role secret");
        await c.query("CREATE ROLE p05_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '"+config.app+"'");
        await c.query("GRANT SELECT,INSERT,UPDATE ON auth_accounts,auth_challenges,auth_mail_limits,auth_ip_mail_limits,game_saves,npc_memory_journals TO p05_app");
        await c.query("GRANT SELECT,INSERT,DELETE ON auth_sessions TO p05_app");
        await c.query("GRANT DELETE ON auth_mail_limits,auth_ip_mail_limits,auth_challenges TO p05_app");
        await c.query("GRANT SELECT,INSERT ON turn_requests,turn_events,npc_authorized_observation_outbox,npc_memory_observation_supersessions TO p05_app");
        await c.query("GRANT SELECT ON cloud_archive_trash TO p05_app");
        await c.query("COMMIT");
      }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
    }
  }finally{await admin.end()}
  const pool=new Pool({...options,user:"p05_app",password:config.app});
  const core=await loadB2Rules(config.runtime);
  const svc=name=>core.load("apps/api/dist/services/"+name+".js");
  const {EmailAuthService}=await svc("email-auth");
  const {PostgresEmailAuthRepository}=await svc("postgres-email-auth");
  const {AuthoritativeGameService}=await svc("authoritative-game");
  const {PostgresCloudSaveRepository}=await svc("postgres-cloud-save-repository");
  const {createPostgresServerTurnRepository}=await svc("postgres-server-turn");
  const {ServerTurnService}=await svc("server-turn");
  const labels=await svc("approved-player-actions");
  const hints=await svc("p1-narrative-hints");
  const email="reader@p05.invalid";let code;
  const auth=new EmailAuthService(new PostgresEmailAuthRepository(pool,config.secret),async(address,value)=>{
    if(address!==email)throw Error("synthetic mailbox only");code=value;
  },config.secret);
  const games=new AuthoritativeGameService(new PostgresCloudSaveRepository(pool,true),core.runtime);
  const repo=createPostgresServerTurnRepository(pool,true);
  const turns=new ServerTurnService(repo,core.runtime.rules,undefined,20000,core.runtime.narrativeFallback);
  async function login(){
    let token=store.get("session");
    if(token && await auth.resolve(token))return token;
    if(await auth.requestCode(email,"127.0.0.1")!=="sent")throw Error("native login temporarily limited");
    const who=await auth.verify(email,code);code=null;
    if(!who?.token)throw Error("native auth failed");
    token=who.token;store.set("session",token);return token;
  }
  async function saveFor(owner){
    if(!store.get("save")){
      if(!store.get("createKey"))store.set("createKey",randomUUID());
      const created=await games.create(owner,store.get("createKey"),{memoryMode:"continue"});
      if(!created.save)throw Error("native create failed");
      store.set("save",created.save.saveId);
    }
    const game=await games.read(owner,store.get("save"));
    if(!game?.save)throw Error("unauthorized save");
    return game.save;
  }
  return {auth,login,saveFor,repo,turns,core,hints,labels,pool};
}

export function publicState(save,labels){
  const f=save.state.facts,location=save.state.locationId;
  const name=id=>labels.approvedLabel(id)??id;
  const actions=[];
  const add=(id,label,kind,payload)=>actions.push({id,label,kind,payload});
  if(location==="loc_luhuadu"){
    add("scan","察看渡口","observe",{targetId:"obj_ferry",method:"scan"});
    if(f.currentSublocationId!=="subloc_ferry_berm")add("berm","走到"+name("subloc_ferry_berm"),"move",{destinationId:"subloc_ferry_berm"});
    if(f.npcPresence.includes("npc_cenjiu"))add("chat","与"+name("npc_cenjiu")+"闲谈","talk",{npcId:"npc_cenjiu",utterance:"今日过得如何？"});
  }
  for(const edge of f.locationGraph.filter(e=>e.from===location && e.state!=="locked" && ["loc_luhuadu","loc_wangqitai"].includes(e.to))){
    add(edge.to,"前往"+name(edge.to),"move",{destinationId:edge.to});
  }
  for(const a of labels.approvedPlayerActions(save)){
    if(a.kind==="combat")add(a.id,a.label,"combat",{targetId:a.id.split(":")[1]});
    else if(a.intent)add(a.id,a.label,a.intent.kind,a.intent.payload);
  }
  return {location,place:name(location),sub:f.currentSublocationId,quest:f.questState,known:f.knownLocations,
    revision:save.revision,actions};
}
