import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {openSceneHost} from "../host.mjs";
import {digest} from "../../native-facts/admission.mjs";
import {createTestGames} from "../../native-reader-b2/test/real-history.mjs";

export async function runNativeScene(core,pool,url) {
    const {auth,accounts,games,turns,emails,mailbox,secret,login,databaseName,svc}=await createTestGames(core,pool,url);
    const host=await openSceneHost({pool,core,auth,created:accounts,databaseName},0);
    const [a,b]=accounts, saveId=a.result.save.saveId, frames=[],checks=[],captures=[];
    const ferry="loc_luhuadu", lookout="loc_wangqitai";
    let revision=0;
    const hidden=async(token,request)=>{
        const v=await host.present(token,request);
        assert.deepEqual([v.access,v.current,v.history,v.asset,v.send],["hidden",null,[],null,false]);
        return v;
    };
    async function frame(action,expected,request=null,reason=null) {
        const view=await host.present(a.token,request);
        const current=await games.read((await auth.resolve(a.token)).ownerId,saveId);
        assert.equal(current.save.revision,revision);
        assert.equal(current.save.state.locationId,expected);
        assert.equal(digest(current.save),captures[revision].stateSHA256);
        assert.equal(view.revision,revision);
        assert.equal(view.current.id,expected);
        assert.deepEqual([view.reason,view.send,view.sceneEligible,view.asset],[reason,false,false,null]);
        assert.ok(Object.values(view.current.visual).every(value=>value===null));
        frames.push({action,...view});
        return view;
    }
    async function act(kind,payload) {
        const key=randomUUID(), principal=await auth.resolve(a.token);
        const played=await turns.execute(principal.ownerId,{saveId,actorId:a.result.save.state.playerId,branchId:"root",
            kind,payload,expectedRevision:revision,idempotencyKey:key},false);
        assert.equal(played.status,"accepted");
        assert.equal(played.receipt.resultingRevision,++revision);
        captures.push(await host.capture(a.token,revision,key));
        return {saveId,key,branch:"root",r:revision};
    }
    const move=destinationId=>act("move",{destinationId});
    captures.push(await host.capture(a.token,0));
    await frame("create",ferry);
    const first=await move(lookout);
    assert.equal((await frame("move",lookout)).history.length,0);
    const block=await move(ferry);
    await frame("blocked",lookout,block,"blocked");
    const sub=await move("subloc_reef_ledge");
    await frame("sub",lookout,sub,"sublocation-change");
    const old=a.token;
    await auth.logout(old);
    await hidden(old);
    a.token=await login(emails[0]);
    const learned=await frame("learn",lookout,first);
    assert.deepEqual(learned.history.map(h=>[h.revision,h.learnedRevision,h.observedThroughRevision]),[[1,3,3]]);
    assert.deepEqual((await host.present(a.token,first)).history,learned.history);
    checks.push("R1 current from PG; first history learned at R3 after real reauthentication; duplicate adds zero");
    const back=await move(lookout);
    await frame("back",lookout,back,"sublocation-change");
    const inspect=await act("observe",{targetId:"obstacle_rockslide",method:"scan"});
    await frame("observe",lookout,inspect,"other-rule-event");
    const bypass=await move(ferry);
    await frame("bypass",ferry,bypass,"OUT_OF_SCOPE_SUPPORTED_EVENT");
    const late=await frame("late",ferry,first);
    assert.equal(late.history[0].to.id,lookout);
    assert.deepEqual(late.history,learned.history);
    const revisit=await move(lookout);
    const returned=await frame("revisit",lookout,revisit);
    assert.equal(returned.history.length,2);
    assert.equal(returned.current.id,frames[1].current.id);
    assert.deepEqual((await host.present(a.token,first)).history,returned.history);
    checks.push("R6 independent snapshot after bypass; old R1 does not rewind it; R7 revisit retains identity");
    await hidden(b.token,first);
    for (const wrong of [{...first,saveId:b.result.save.saveId},{...first,branch:"side"},{...first,r:9},
        {...first,key:randomUUID()},{...first,source:"local-test-pg-history/1",verified:true},
        {...first,narrative:"梦中有两位客人来到这里。"}]) await hidden(a.token,wrong);
    checks.push("wrong owner, save, branch, future, request key, forged proof and dream text hidden");
    const {hashToken}=await svc("email-auth"),{AccountLifecycle}=await svc("account-lifecycle");
    const life=new AccountLifecycle(pool,async(email,code)=>{assert.equal(email,emails[0]);mailbox.set(email,code);},
        secret,"B2-local-synthetic-close-only",false);
    const hash=hashToken(a.token),op=await life.begin(a.ownerId,hash,"close");
    assert.equal((await life.verify(a.ownerId,hash,op.operationId,mailbox.get(emails[0]))).phase,"ready");
    mailbox.delete(emails[0]);
    assert.equal((await life.complete(a.ownerId,hash,op.operationId,"CLOSE_ACCOUNT")).status,"account_closed");
    frames.push({action:"closed",...await hidden(a.token)});
    checks.push("logout and account closure hide current and previously verified history");
    await auth.logout(b.token);
    return {suite:"native-scene/1",trace:{version:"native-scene-demo/1",source:"isolated-authenticated-PG",frames},captures,checks};
}
