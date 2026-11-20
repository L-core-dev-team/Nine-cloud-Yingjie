import {chooseFrame} from "./planner.mjs";
import {reviewFixture} from "../image-tasks/demo.mjs";

export async function automaticView(c,{tasks,world,context,permit,serial,method}) {
  async function readContext(){
    const ctx=await context(c);
    if(ctx.revision){
      const audit=(await tasks.pool.query("SELECT audit->>'method' AS method, audit->>'replayOnly' AS replay FROM yingjie_play.extraction WHERE scope=$1 AND revision=$2",
        [ctx.scope,ctx.revision])).rows[0];
      if(audit?.replay || audit?.method!==method)throw Error("incompatible-projection");
    }
    return ctx;
  }
  const ctx=await readContext();
  const write=c.req.method==="POST";
  if(write)await tasks.permit(ctx,permit,serial,(await c.req.json()).enabled);
  const allowed=()=>tasks.allowed(tasks.pool,ctx,permit,serial);
  const enabled=await allowed();
  const pick=await chooseFrame(tasks,world,ctx,enabled);
  const original=c.req.param("asset") || c.req.param("preset");
  const info={action:pick.action,reason:pick.reason,hold:pick.hold??null,presetReason:pick.miss??null,enabled,
    handle:pick.preset?.handle??pick.plan?.assetId??pick.plan?.reference?.assetId??null};
  // Keep changes to a live choice (for example revocation); polling an unchanged view adds no rows.
  if(write || enabled && !original)await tasks.pool.query(`INSERT INTO yingjie_play.choice(scope,revision,permit,serial,record)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[ctx.scope,ctx.revision,permit,serial,info]);
  if(write && pick.plan){
    const submitted=await tasks.submit(ctx,permit,serial,pick.plan);
    if(submitted==="event-conflict" || submitted==="disabled")throw Error(submitted);
    const task=await tasks.taskFor(ctx);
    if(task?.request_key){
      const authorize=async()=>{
        const fresh=await readContext();
        const current=await chooseFrame(tasks,world,fresh,await allowed());
        if(!current.plan || current.action!==task.plan.action)throw Error("selection-changed");
        return fresh;
      };
      void tasks.dispatch(authorize,task.id,permit,serial).then(async status=>{
        if(status==="returned")await reviewFixture(tasks,await readContext(),task);
      }).catch(()=>{/* A possibly sent attempt is reconciled by YJ-05; an unreviewed file stays private. */});
    }
  }
  async function frame(choice,snapshot){
    if(choice.preset)return {state:"display",source:"preset",assetId:choice.preset.handle,bytes:choice.preset.bytes};
    if(!choice.plan)return {state:choice.reason==="not-ready" && snapshot.result.scene?"verify-scene":choice.hold??(["not-ready","disabled"].includes(choice.reason)?choice.reason:"skip")};
    const result=await tasks.view(snapshot,permit,serial);
    return {state:result.state,source:"tasks",assetId:result.asset?.assetId,bytes:result.bytes};
  }
  c.header("Cache-Control","private, no-store");
  const view=await frame(pick,ctx);
  if(original){
    const matches=f=>f.state==="display" && f.assetId===original && (f.source==="preset")===!!c.req.param("preset");
    if(!matches(view))return c.body(null,404);
    const fresh=await readContext();
    if(fresh.revision!==ctx.revision)return c.body(null,404);
    const checked=await frame(await chooseFrame(tasks,world,fresh,await allowed()),fresh);
    if(!matches(checked) || !await allowed())return c.body(null,404);
    c.header("Content-Type","image/png");c.header("X-Content-Type-Options","nosniff");
    return c.body(checked.bytes);
  }
  return c.json({state:view.state,source:view.source,decision:pick.action,reason:pick.reason,
    revision:ctx.revision,scene:ctx.result.scene?.name??null,version:ctx.result.visual?.visualVersion??null,
    people:ctx.result.visual?.people.length??null,assetId:view.assetId??null});
}
