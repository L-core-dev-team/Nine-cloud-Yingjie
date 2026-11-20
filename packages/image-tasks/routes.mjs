import { syncCardHistory } from "../scene-state/index.mjs";
import { cardScope } from "../scene-state/store.mjs";
import { annotate,demoPlan,reviewFixture } from "./demo.mjs";

// Local integration host. Bind only alongside the trusted Nine-cloud app. Nothing accepts owner IDs, plans or paths from JSON.
export function mountDemoRoutes(app,tasks,origin) {
  const path="/api/yingjie/:session";
  async function context(c) {
    const id=c.req.param("session");
    if(!/^[a-f0-9-]{36}$/i.test(id))throw Error("invalid-session");
    const cookie=c.req.header("Cookie")??"", hint=c.req.header("x-jiuxiao-account");
    const request=(p,options={})=>app.request(p,{...options,headers:{Cookie:cookie,...options.headers}});
    const identity=await request("/api/auth/session");
    if(!identity.ok)throw Error("account-inaccessible");
    const owner=(await identity.json()).account.id;
    if(hint && owner!==hint)throw Error("account-inaccessible");
    const snapshot=await syncCardHistory({pool:tasks.pool,sessionId:id,request,signal:new AbortController().signal,extract:annotate});
    let action="";
    if(snapshot.result.status==="ready") {
      const r=await request("/api/card-import/sessions/"+id+"/history?after="+(snapshot.revision-1),{headers:{"x-jiuxiao-account":owner}});
      if(!r.ok)throw Error("session-inaccessible");
      const row=(await r.json())[0];
      if(row?.key!==snapshot.result.visual.source.key)throw Error("stale-target");
      action=row.action;
    }
    return {authorized:true,scope:cardScope(owner,id),...snapshot,action};
  }
  const handle=async c=>{
    try {
      if(c.req.method==="POST" && c.req.header("origin")!==origin) return c.body(null,403);
      const permit=c.req.query("view"),serial=Number(c.req.query("seq"));
      if(!/^[a-f0-9-]{36}$/i.test(permit??"") || !Number.isSafeInteger(serial) || serial<0)return c.body(null,400);
      const ctx=await context(c);
      if(c.req.method==="POST") {
        const {enabled}=await c.req.json();
        await tasks.permit(ctx,permit,serial,enabled);
        if(enabled && ctx.result.status==="ready") {
          let task=await tasks.taskFor(ctx);
          if(!task){
            await tasks.submit(ctx,permit,serial,await demoPlan(tasks,ctx));
            task=await tasks.taskFor(ctx);
          }
          if(task && task.request_key){
            void tasks.dispatch(()=>context(c),task.id,permit,serial).then(async status=>{
              if(status==="returned")await reviewFixture(tasks,await context(c),task);
            }).catch(()=>{/* A durable claim will expire to unknown; pending assets remain unavailable. */});
          }
        }
      }
      const frame=await tasks.view(ctx,permit,serial);
      c.header("Cache-Control","private, no-store");
      if(c.req.param("asset")){
        if(frame.state!=="display" || frame.asset.assetId!==c.req.param("asset"))return c.body(null,404);
        const fresh=await context(c);
        if(fresh.revision!==ctx.revision || fresh.result.status!=="ready" || !await tasks.allowed(tasks.pool,fresh,permit,serial))return c.body(null,404);
        c.header("Content-Type","image/png");c.header("X-Content-Type-Options","nosniff");
        return c.body(frame.bytes);
      }
      return c.json({state:frame.state,revision:ctx.revision,
        scene:ctx.result.scene?.name??null,version:ctx.result.visual?.visualVersion??null,
        people:ctx.result.visual?.people.length??null,assetId:frame.asset?.assetId??null});
    } catch(error) {
      c.header("Cache-Control","no-store");
      const forbidden=["account-inaccessible","session-inaccessible","session-mismatch","group-not-adapted","mode-unverified"];
      return c.json({state:"unavailable"},forbidden.includes(error.message)?403:409);
    }
  };
  app.get(path,handle);app.post(path,handle);app.get(path+"/original/:asset",handle);
}
