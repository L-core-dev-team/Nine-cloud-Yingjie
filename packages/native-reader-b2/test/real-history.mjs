// Call only inside the disposable-cluster provisioner, never with a developer DB.
import assert from "node:assert/strict";
import {randomBytes, randomUUID} from "node:crypto";
import {makeLocalReader} from "../reader.mjs";

export async function runHistoricalPositive(core, pool, dedicatedURL) {
    const svc = name => core.load("apps/api/dist/services/" + name + ".js");
    const {assertLocalCardDatabase} = await core.load("apps/api/dist/card-import/local-runtime.js");
    const databaseName = assertLocalCardDatabase(dedicatedURL,/^\/jiuxiao_test_b2_[0-9_]+$/).pathname.slice(1);
    const target = (await pool.query("SELECT current_database() AS name, host(inet_server_addr()) AS address")).rows[0];
    assert.deepEqual(target,{name:databaseName,address:"127.0.0.1"});
    const clean = await pool.query(`SELECT NOT EXISTS(SELECT 1 FROM auth_accounts) AND
      NOT EXISTS(SELECT 1 FROM game_saves) AND NOT EXISTS(SELECT 1 FROM turn_events) AS empty`);
    assert.equal(clean.rows[0].empty,true);
    const {EmailAuthService} = await svc("email-auth");
    const {PostgresEmailAuthRepository} = await svc("postgres-email-auth");
    const {AuthoritativeGameService} = await svc("authoritative-game");
    const {PostgresCloudSaveRepository} = await svc("postgres-cloud-save-repository");
    const {createPostgresServerTurnRepository} = await svc("postgres-server-turn");
    const {ServerTurnService} = await svc("server-turn");
    const emails = ["a@b2.invalid","b@b2.invalid"], mailbox = new Map();
    const secret = randomBytes(32).toString("hex");
    const lastIssue = new Map();
    const auth = new EmailAuthService(new PostgresEmailAuthRepository(pool,secret),async (email,code) => {
        assert.ok(emails.includes(email)); mailbox.set(email,code);
    },secret);
    async function login(email) {
        const delay = (lastIssue.get(email) ?? 0) + 61000 - Date.now();
        if (delay > 0) await new Promise(done => setTimeout(done,delay));
        assert.equal(await auth.requestCode(email,"127.0.0.1"),"sent");
        lastIssue.set(email,Date.now());
        const identity = await auth.verify(email,mailbox.get(email));
        mailbox.delete(email);
        assert.equal(identity?.session.kind,"email");
        return identity.token;
    }
    const games = new AuthoritativeGameService(new PostgresCloudSaveRepository(pool,true),core.runtime);
    const turns = new ServerTurnService(createPostgresServerTurnRepository(pool,true),core.runtime.rules);
    const accounts = [];
    for (const email of emails) {
        const token = await login(email), {ownerId} = await auth.resolve(token);
        const result = await games.create(ownerId,randomUUID(),{memoryMode:"continue"});
        assert.equal(result.status,"created");
        accounts.push({token,ownerId,result});
    }
    const barriers = {};
    const reader = await makeLocalReader({pool,auth,core,created:accounts,databaseName,barriers});
    const [a,b] = accounts;
    const saveId = a.result.save.saveId, actorId = a.result.save.state.playerId;
    const captures = [];
    for (const account of accounts) captures.push(await reader.capture(account.token,account.result.save.saveId,0));
    let revision = 0;
    async function act(kind,payload,expected = "accepted") {
        const key = randomUUID();
        const session = await auth.resolve(a.token);
        assert.equal(session?.ownerId,a.ownerId);
        const played = await turns.execute(session.ownerId,{saveId,actorId,branchId:"root",kind,
            expectedRevision:revision,idempotencyKey:key,payload},false);
        assert.equal(played.status,expected);
        if (expected === "decision") {
            assert.equal(played.receipt.resultingRevision,revision);
            return {saveId,key,r:revision,branch:"root"};
        }
        assert.equal(played.receipt.resultingRevision,revision+1);
        captures.push(await reader.capture(a.token,saveId,++revision,key));
        return {saveId,key,r:revision,branch:"root"};
    }
    const move = (destinationId,expected) => act("move",{destinationId},expected);
    const first = await move("loc_wangqitai");
    const blocked = await move("loc_luhuadu");
    const rejected = await move("loc_wangqitai","decision");
    const sub = await move("subloc_reef_ledge");
    const originalToken = a.token;
    await auth.logout(originalToken);
    a.token = await login(emails[0]);
    assert.equal((await reader.read(originalToken,first)).status,"DENIED");
    assert.equal((await reader.read(b.token,first)).status,"DENIED");
    const proof = await reader.read(a.token,first);
    assert.deepEqual([proof.status,proof.from,proof.to,proof.targetRevision,proof.observedThroughRevision,proof.added],
        ["CONFIRMED_NATIVE_LOCATION","loc_luhuadu","loc_wangqitai",1,3,1]);
    const second = await reader.read(a.token,first);
    assert.equal(second.added,0);
    assert.equal(second.evidenceLearnedAt,proof.evidenceLearnedAt);
    assert.equal((await reader.read(a.token,sub)).reason,"sublocation-change");
    assert.equal((await reader.read(a.token,blocked)).reason,"blocked");
    assert.equal((await reader.read(a.token,rejected)).added,0);
    for (const invalid of [{...first,ownerId:a.ownerId},{...first,branch:"child"},{...first,r:99},
        {...first,key:randomUUID()},{...first,saveId:b.result.save.saveId}]) {
        const result = await reader.read(a.token,invalid);
        assert.ok(["DENIED","UNVERIFIED"].includes(result.status));
        assert.equal(result.added,0);
    }
    const withoutCaptures = await makeLocalReader({pool,auth,core,created:accounts,databaseName});
    assert.equal((await withoutCaptures.read(a.token,first)).status,"UNVERIFIED");
    // A separate normal committed write happens between the reader's SQL statements.
    const readCurrent = async () => (await games.read((await auth.resolve(a.token)).ownerId,saveId)).save.revision;
    const splitBefore = await readCurrent();
    barriers.afterSnapshot = async () => { await move("loc_wangqitai"); };
    const overlap = await reader.read(a.token,first);
    delete barriers.afterSnapshot;
    assert.equal(overlap.observedThroughRevision,3);
    assert.deepEqual([splitBefore,await readCurrent()],[3,4]);
    assert.equal((await reader.read(a.token,first)).observedThroughRevision,4);
    await act("observe",{targetId:"obstacle_rockslide",method:"scan"});
    const bypass = await move("loc_luhuadu");
    assert.equal((await reader.read(a.token,bypass)).reason,"OUT_OF_SCOPE_SUPPORTED_EVENT");
    const revisit = await move("loc_wangqitai");
    assert.equal((await reader.read(a.token,revisit)).added,1);
    barriers.beforeDelivery = async () => { await auth.logout(a.token); };
    assert.deepEqual(await reader.read(a.token,first),{sceneEligible:false,send:false,added:0,status:"DENIED"});
    await auth.logout(b.token);
    return {proof,captures,scope:"new-local-test-saves",matrixComplete:false};
}
