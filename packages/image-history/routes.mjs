import {ImageHistory} from "./history.mjs";

async function feedbackBody(req){
  if(!req.headers.get("content-type")?.startsWith("application/json"))throw Error("invalid-feedback");
  const reader=req.body?.getReader();if(!reader)throw Error("invalid-feedback");
  let size=0;const chunks=[];
  try{
    for(;;){const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>2048){await reader.cancel();throw Error("invalid-feedback");}chunks.push(value);}
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }catch{throw Error("invalid-feedback");}finally{reader.releaseLock();}
}

export function mountHistory(app,path,tasks,world,context,origin){
  const history=new ImageHistory(tasks,world);
  const handle=fn=>async c=>{
    c.header("Cache-Control","private, no-store");c.header("X-Content-Type-Options","nosniff");c.header("Cross-Origin-Resource-Policy","same-origin");
    try{
      if(c.req.method==="POST" && c.req.header("origin")!==origin)return c.body(null,403);
      const ctx=await context(c);
      return await fn(c,ctx);
    }catch(err){
      const status=["session-inaccessible","account-inaccessible","session-mismatch","group-not-adapted","mode-unverified"].includes(err.message)?403:
        ["media-forbidden","missing"].includes(err.message)?404:err.message==="invalid-feedback"?400:
        ["stale-review","command-conflict","decision-conflict","history-regressed","incomplete-history-page"].includes(err.message)?409:500;
      return c.json({error:status===409?"stale-or-conflicting":status===400?"invalid-request":"unavailable"},status);
    }
  };
  app.get(path+"/history",handle(async(c,ctx)=>{
    const before=c.req.query("before");
    if(before!==undefined && !/^[1-9]\d{0,8}$/.test(before))return c.body(null,400);
    return c.json(await history.list(ctx,before?Number(before):null));
  }));
  app.get(path+"/history/:rev",handle(async(c,ctx)=>c.json(await history.detail(ctx,Number(c.req.param("rev"))))));
  app.get(path+"/history/:rev/:kind/:id",handle(async(c,ctx)=>{
    const read=ctx=>history.target(ctx,Number(c.req.param("rev")),c.req.param("kind"),c.req.param("id"));
    const target=await read(ctx);if(!target.bytes)return c.body(null,404);
    const fresh=await context(c);
    if(fresh.scope!==ctx.scope)return c.body(null,403);
    const checked=await read(fresh);
    if(!checked.bytes || checked.generation!==target.generation)return c.body(null,404);
    c.header("Content-Type","image/png");return c.body(checked.bytes);
  }));
  app.get(path+"/feedback/:command",handle(async(c,ctx)=>
    c.json(await history.receipt(ctx,c.req.param("command"),c.req.header("x-yj-fingerprint")))));
  app.post(path+"/feedback",handle(async(c,ctx)=>c.json(await history.report(ctx,await feedbackBody(c.req.raw)))));
  return history;
}
