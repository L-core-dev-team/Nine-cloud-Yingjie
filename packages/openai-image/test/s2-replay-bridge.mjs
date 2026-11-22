import {OpenAIImageProvider} from "../index.mjs";
import {frameFromHistory} from "../prompt.mjs";
import {reviewAssetUse,reviewVisualHistory} from "../../first-play/visual-consistency.mjs";
import {MockImageMoney} from "../money.mjs";

// Only the offline story harness instantiates this version. The I1 constructor/default buildFrame
// continues to replay its own ordinary-card extractor and rejects S2-only targets.
export class S2ReplayProvider extends OpenAIImageProvider {
  buildFrame(claim,ctx){
    if(!this.offline || process.permission?.has("net")!==false || !(this.moneyGate instanceof MockImageMoney))
      throw Error("s2-mock-only");
    const checked=reviewVisualHistory(ctx);
    if(!checked.review.imageEligible)throw Error(checked.review.reason);
    if(claim.plan.action==="edit"){
      const decision=reviewAssetUse(checked,claim.plan,{asset:ctx.asset,bytes:claim.referenceBytes,active:ctx.referenceActive});
      if(!decision.imageEligible)throw Error(decision.reason);
    }
    const {lightSource}=checked.review;
    const explanation=lightSource?JSON.stringify({已揭示的当前光源:lightSource.feature+
      (lightSource.kind==="night-sun"?"上的引日阵照出日光":"上的映月阵照出月光")}):null;
    return frameFromHistory(claim,ctx,()=>checked.turns.map(t=>t.result),explanation);
  }
}
