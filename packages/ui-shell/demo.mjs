import { requireApi,withDatabase } from "../scene-state/test/local-db.mjs";
import { withHost } from "./test/host.mjs";
import { createPlayers } from "./test/player.mjs";
import { prepareTavern } from "../world-assets/test/tavern.mjs";
import {walkthroughModel} from "../first-play/story.mjs";
import {catalog} from "../world-assets/index.mjs";

// Local interactive demo on the same mounted host and disposable database as the browser test.
await withDatabase(pool=>withHost(pool,async({origin,codes})=>{
  const browser=await requireApi("playwright").chromium.launch({executablePath:process.env.CHROME_PATH,headless:false});
  try {
    const context=await browser.newContext();
    const {cardId}=await createPlayers(context,origin,codes);
    const {id}=await prepareTavern(context,origin,pool,cardId);
    const page=await context.newPage();
    const closed=page.waitForEvent("close",{timeout:0});
    await page.goto(origin+"/cards/session/"+id);
    console.log("进入映界后提交任意文字。演示文字服务按回合给出固定正文，画面由已保存正文自动选择。关闭标签页结束。");
    await closed;
  } finally {await browser.close();}
},{assets:catalog.slice(0,1)},{model:walkthroughModel}));
