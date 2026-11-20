import { requireApi,withDatabase } from "../scene-state/test/local-db.mjs";
import { withHost } from "./test/host.mjs";
import { createPlayers } from "./test/player.mjs";
import { prepareTavern } from "../world-assets/test/tavern.mjs";
import { script } from "../image-tasks/demo.mjs";

// Local interactive demo on the same mounted host and disposable database as the browser test.
await withDatabase(pool=>withHost(pool,async({origin,codes})=>{
  const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:false});
  try {
    const context=await browser.newContext();
    const {cardId}=await createPlayers(context,origin,codes);
    const {id,owner}=await prepareTavern(context,origin,pool,cardId);
    const page=await context.newPage();
    const closed=page.waitForEvent("close",{timeout:0});
    await page.addInitScript(({owner,id})=>{
      const key="yj-demo-view:"+owner+":"+id;
      if(!sessionStorage.getItem(key))sessionStorage.setItem(key,JSON.stringify({id:crypto.randomUUID(),serial:0,enabled:true,preset:true}));
    },{owner,id});
    await page.goto(origin+"/cards/session/"+id);
    console.log("在角色卡页面选择「进入映界」。依次输入下列行动，关掉该标签页结束演示。");
    console.log(script.slice(0,6).map(row=>row[0]).join(" → "));
    await closed;
  } finally {await browser.close();}
}));
