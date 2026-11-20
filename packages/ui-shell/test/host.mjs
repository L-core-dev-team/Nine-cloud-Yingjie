import { once } from "node:events";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { upstream, requireApi, cardRuntime } from "../../scene-state/test/local-db.mjs";
import { yingjiePlugin } from "../mount.mjs";
import { Originals } from "../../image-tasks/files.mjs";
import { ImageTasks } from "../../image-tasks/index.mjs";
import { TavernProvider,script } from "../../image-tasks/demo.mjs";
import { mountDemoRoutes } from "../../image-tasks/routes.mjs";

const load=path=>import(pathToFileURL(join(upstream,"apps/api/dist",path)));
export async function withHost(pool,run) {
  const dir=await mkdtemp(join(tmpdir(),"yingjie-host-"));
  const runtime=cardRuntime();
  let server;
  try {
    const { build }=await import(pathToFileURL(join(upstream,"node_modules/vite/dist/node/index.js")));
    const root=join(upstream,"apps/web"), output=join(dir,"web");
    await build({root,configFile:false,publicDir:false,plugins:[yingjiePlugin(root)],logLevel:"error",
      build:{outDir:output,minify:false},esbuild:{jsx:"automatic"}});
    const { createApp }=await load("app.js");
    const { EmailAuthService }=await load("services/email-auth.js");
    const { PostgresEmailAuthRepository }=await load("services/postgres-email-auth.js");
    const { localCardOptions }=await load("card-import/local-runtime.js");
    const codes=new Map();
    const auth=new EmailAuthService(new PostgresEmailAuthRepository(runtime.pool,runtime.secret),
      async (email,code)=>{codes.set(email,code);},runtime.secret);
    const cards=localCardOptions(runtime.pool,{NODE_ENV:"test",CARD_LOCAL_MODE:"synthetic",DATABASE_URL:"postgresql://127.0.0.1/jiuxiao_test_cards_demo"});
    const fallback=cards.model;
    cards.model=(input,...args)=>script.find(step=>step[0]===input.action)?.[1]??fallback(input,...args);
    let app;
    server=requireApi("@hono/node-server").serve({hostname:"127.0.0.1",port:0,fetch:req=>app.fetch(req)});
    await once(server,"listening");
    const origin="http://127.0.0.1:"+server.address().port;
    app=createApp(undefined,undefined,{service:auth,origin},undefined,cards);
    await pool.query(await readFile(new URL("../../image-tasks/schema.sql",import.meta.url),"utf8"));
    const tasks=new ImageTasks(pool,new Originals(join(dir,"originals")),new TavernProvider());
    mountDemoRoutes(app,tasks,origin);
    app.get("/compliance/beian-police.png",async c=>{
      c.header("Content-Type","image/png");return c.body(await readFile(join(root,"public/compliance/beian-police.png")));
    });
    const index=await readFile(join(output,"index.html"),"utf8");
    app.get("/cards/session/:id",c=>c.html(index));
    app.get("/assets/:file",async c=>{
      const file=c.req.param("file");
      if(!/^[\w.-]+\.(js|css)$/.test(file))return c.notFound();
      c.header("Content-Type",file.endsWith(".css")?"text/css":"text/javascript");
      return c.body(await readFile(join(output,"assets",file)));
    });
    await run({origin,codes,tasks});
  } finally {
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    await runtime.pool.end();
    await rm(dir,{recursive:true,force:true});
  }
}
