// Call only inside the disposable-cluster provisioner, never with a developer DB.
import assert from "node:assert/strict";
import {randomBytes, randomUUID} from "node:crypto";
import {makeLocalReader} from "../reader.mjs";
import {digest} from "../../native-facts/admission.mjs";
import {readFile} from "node:fs/promises";
import {openLoopbackReader} from "./loopback-reader.mjs";
import {measureDamagedReads} from "./pg-boundary.mjs";

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
    const http = await openLoopbackReader(reader);
    const cases = new Map();
    function record(name,observation,status="PASS") {
        assert.ok(!cases.has(name),name);
        assert.ok(!("name" in observation || "status" in observation));
        const row={name,status,...observation};
        cases.set(name,row);
        console.log(JSON.stringify({caseResult:row}));
    }
    try {
        const [a,b] = accounts;
        const saveId = a.result.save.saveId, actorId = a.result.save.state.playerId;
        const captures = [];
        for (const [i,account] of accounts.entries()) captures.push({account:i?"B":"A",
            ...await reader.capture(account.token,account.result.save.saveId,0)});
        let revision = 0;
        async function act(kind,payload,expected = "accepted",decision) {
            const key = randomUUID();
            const session = await auth.resolve(a.token);
            assert.equal(session?.ownerId,a.ownerId);
            const played = await turns.execute(session.ownerId,{saveId,actorId,branchId:"root",kind,
                expectedRevision:revision,idempotencyKey:key,payload},false);
            assert.equal(played.status,expected);
            if (expected === "decision") {
                assert.equal(played.receipt.resultingRevision,revision);
                assert.equal(played.receipt.decision.status,decision);
            } else {
                assert.equal(played.receipt.resultingRevision,revision+1);
                captures.push({account:"A",...await reader.capture(a.token,saveId,++revision,key)});
            }
            return {saveId,key,r:revision,branch:"root"};
        }
        const readCurrent = async () => (await games.read((await auth.resolve(a.token)).ownerId,saveId)).save.revision;
        const move = (destinationId,...args) => act("move",{destinationId},...args);
        const denied = {sceneEligible:false,send:false,added:0,status:"DENIED"};
        const first = await move("loc_wangqitai");
        assert.equal((await http.knownAt(a.token,first,1)).status,"NO_KNOWN_FACT");
        const blocked = await move("loc_luhuadu");
        const rejected = await move("loc_wangqitai","decision","rejected");
        const clarify = await act("free_text",{text:"该怎么办呢"},"decision","clarify");
        assert.equal(await readCurrent(),2);
        for (const ref of [rejected,clarify]) assert.equal((await http.read(a.token,ref)).status,"UNVERIFIED");
        record("noncommit",{decisions:["rejected","clarify"],dbRevision:2,newFacts:0});
        const sub = await move("subloc_reef_ledge");
        const originalToken=a.token;
        await auth.logout(originalToken);
        a.token=await login(emails[0]);
        assert.equal((await auth.resolve(a.token)).ownerId,a.ownerId);
        let matched;
        barriers.checkCopy = (s,settings) => {
            const cp=s.history.get(1), row=s.rows[0];
            matched={before:digest(s.history.get(0).save),after:digest(cp.save),rawReceipt:cp.receiptDigest,
                end:cp.end,pgEventDigest:row.recomputed,eventIdSHA256:digest(row.id),settings};
            assert.equal(matched.end,matched.pgEventDigest);
            assert.deepEqual(settings,{isolation:"repeatable read",readonly:"on"});
        };
        const proof=await http.read(a.token,first);
        delete barriers.checkCopy;
        assert.deepEqual([proof.status,proof.from,proof.to,proof.targetRevision,proof.observedThroughRevision,proof.added],
            ["CONFIRMED_NATIVE_LOCATION","loc_luhuadu","loc_wangqitai",1,3,1]);
        assert.equal(matched.before,captures[0].stateSHA256);
        assert.equal(matched.after,captures[2].stateSHA256);
        record("later-owner-read",{proof,matched});
        const second=await http.read(a.token,first);
        assert.equal(second.added,0);
        assert.equal(second.evidenceLearnedAt,proof.evidenceLearnedAt);
        record("repeat",{added:second.added,sameFirstLearnedAt:true});
        assert.equal((await http.knownAt(a.token,first,1)).status,"NO_KNOWN_FACT");
        assert.equal((await http.knownAt(a.token,first,3)).status,"KNOWN_LOCATION");
        record("knowledge",{beforeLearning:"NO_KNOWN_FACT",pastAfterLearning:"NO_KNOWN_FACT",atLearnedRevision:"KNOWN_LOCATION"});
        for(const [name,ref,reason] of [["sublocation",sub,"sublocation-change"],["blocked",blocked,"blocked"]]) {
            const result=await http.read(a.token,ref);
            assert.deepEqual(result,{sceneEligible:false,send:false,added:0,status:"NO_WHITELIST_FACT",reason});
            record(name,{reason,added:0});
        }
        const bref={...first,saveId:b.result.save.saveId};
        const badWire={...first,checkpoint:{verified:true,revision:1}};
        for(const [name,token,ref,status,headers] of [
            ["unauthenticated",null,first,"DENIED"],["forged owner header",null,first,"DENIED",{"x-jiuxiao-account":a.ownerId}],
            ["wrong session",b.token,first,"DENIED"],["A reads B",a.token,bref,"DENIED"],
            ["wrong save",a.token,{...first,saveId:randomUUID()},"DENIED"],
            ["wrong key",a.token,{...first,key:randomUUID()},"UNVERIFIED"],["non-root",a.token,{...first,branch:"child"},"DENIED"],
            ["wrong target revision",a.token,{...first,r:2},"UNVERIFIED"],["future",a.token,{...first,r:4},"UNVERIFIED"],
            ["untrusted checkpoint supplied on wire",a.token,badWire,"DENIED"]
        ]) {
            const result=await http.read(token,ref,headers);
            assert.deepEqual(result,{...denied,status});
            record(name,{result});
        }
        assert.deepEqual(await http.read(randomBytes(32).toString("base64url"),first),denied);
        assert.deepEqual(await http.read(b.token,first,{"x-jiuxiao-account":a.ownerId}),denied);
        assert.deepEqual(await http.read(originalToken,first),denied);
        assert.deepEqual(await http.knownAt(originalToken,first,3),denied);
        record("logout then cache read",{proofAndCache:"DENIED"});
        const splitBefore=await readCurrent();
        barriers.afterSnapshot=async()=>{await move("loc_wangqitai");};
        const overlap=await http.read(a.token,first);
        delete barriers.afterSnapshot;
        const splitAfter=await readCurrent();
        assert.deepEqual([splitBefore,overlap.observedThroughRevision,splitAfter],[3,3,4]);
        assert.equal((await http.read(a.token,first)).observedThroughRevision,4);
        record("overlapping commit",{splitBefore,splitAfter,repeatableReadHorizon:overlap.observedThroughRevision});
        await act("observe",{targetId:"obstacle_rockslide",method:"scan"});
        const bypass=await move("loc_luhuadu");
        const bypassed=await http.read(a.token,bypass);
        assert.deepEqual(bypassed,{...denied,status:"NO_WHITELIST_FACT",reason:"OUT_OF_SCOPE_SUPPORTED_EVENT"});
        record("bypass",{result:bypassed});
        const revisit=await move("loc_wangqitai");
        await measureDamagedReads({http,barriers,token:a.token,ref:revisit,record});
        let revisitEvent;
        barriers.checkCopy=s=>{revisitEvent=digest(s.rows.at(-1).id);};
        const returned=await http.read(a.token,revisit);
        delete barriers.checkCopy;
        assert.deepEqual([returned.status,returned.added,returned.from,returned.to,returned.targetRevision],
            ["CONFIRMED_NATIVE_LOCATION",1,proof.from,proof.to,7]);
        assert.notEqual(revisitEvent,matched.eventIdSHA256);
        record("return",{firstEventSHA256:matched.eventIdSHA256,revisitEventSHA256:revisitEvent,revision:7,added:1});
        assert.deepEqual(Object.keys(returned).sort(),["sceneEligible","send","added","status","source","observedThroughRevision",
            "evidenceLearnedAt","learnedThroughRevision","targetRevision","from","to"].sort());
        assert.equal(returned.sceneEligible,false);
        assert.equal(returned.send,false);
        record("projection",{fieldNames:Object.keys(returned),sceneEligible:false,send:false,modelCalls:0});
        const {CloudArchiveLifecycle}=await svc("cloud-archive-lifecycle");
        const archive=await new CloudArchiveLifecycle(pool,true).change((await auth.resolve(a.token)).ownerId,saveId,revision,"delete");
        assert.equal(archive.kind,"not_found");
        assert.equal(await readCurrent(),revision);
        for(const name of ["archived save","deleted save"])record(name,{schemaVersion:3,
            upstreamOperation:"CloudArchiveLifecycle.change/delete",actual:archive.kind,
            postLifecycleRead:"NOT_RUN",dependency:"authorized native save lifecycle operation"},"UPSTREAM_DEPENDENCY");
        let revoked=false;
        barriers.beforeDelivery=async()=>{await auth.logout(a.token);revoked=true;};
        assert.deepEqual(await http.read(a.token,first),denied);
        delete barriers.beforeDelivery;
        assert.ok(revoked);
        record("revoke before final check",{result:"DENIED",committedBeforeDelivery:true});
        assert.deepEqual(await http.knownAt(a.token,first,revision),denied);

        // Populate B's independent ledger before using upstream's close-only test
        // lifecycle. Erasure is disabled and has no role grants in this cluster.
        const bKey=randomUUID(), bSession=await auth.resolve(b.token);
        const bTurn=await turns.execute(bSession.ownerId,{saveId:bref.saveId,actorId:b.result.save.state.playerId,
            branchId:"root",kind:"move",expectedRevision:0,idempotencyKey:bKey,payload:{destinationId:"loc_wangqitai"}},false);
        assert.equal(bTurn.status,"accepted");
        captures.push({account:"B",...await reader.capture(b.token,bref.saveId,1,bKey)});
        const ownB={...bref,key:bKey};
        assert.equal((await http.read(b.token,ownB)).added,1);
        const snapshotReady=Promise.withResolvers(), release=Promise.withResolvers();
        barriers.beforeDelivery=async()=>{snapshotReady.resolve();await release.promise;};
        const inFlight=http.read(b.token,ownB);
        let timer;
        try {
            await Promise.race([snapshotReady.promise,new Promise((_,reject)=>{
                timer=setTimeout(()=>reject(Error("barrier-timeout")),5000);
            })]);
            await auth.logout(b.token);
        } finally { clearTimeout(timer);release.resolve();delete barriers.beforeDelivery; }
        assert.deepEqual(await inFlight,denied);
        assert.deepEqual(await http.knownAt(b.token,ownB,1),denied);
        record("revoke race",{separateAccount:"B",readerPausedBeforeDelivery:true,
            concurrentLogoutCommitted:true,inFlightAndCache:"DENIED"});
        b.token=await login(emails[1]);
        assert.equal((await auth.resolve(b.token)).ownerId,b.ownerId);
        assert.equal((await http.read(b.token,ownB)).added,0);
        const {hashToken}=await svc("email-auth");
        const {AccountLifecycle}=await svc("account-lifecycle");
        const life=new AccountLifecycle(pool,async(email,code)=>{assert.equal(email,emails[1]);mailbox.set(email,code);},
            secret,"B2-local-synthetic-close-only",false);
        const sessionHash=hashToken(b.token);
        const op=await life.begin(bSession.ownerId,sessionHash,"close");
        assert.equal((await life.verify(bSession.ownerId,sessionHash,op.operationId,mailbox.get(emails[1]))).phase,"ready");
        mailbox.delete(emails[1]);
        assert.equal((await life.complete(bSession.ownerId,sessionHash,op.operationId,"CLOSE_ACCOUNT")).status,"account_closed");
        assert.equal(await auth.resolve(b.token),null);
        assert.deepEqual(await http.read(b.token,ownB),denied);
        assert.deepEqual(await http.knownAt(b.token,ownB,1),denied);
        record("closed account",{formerlyCached:true,normalClose:"account_closed",proofAndCache:"DENIED"});
        const matrix=JSON.parse(await readFile(new URL("../../../docs/reports/evidence/YJ-P04-NATIVE-READER-B2/matrix.json",import.meta.url)));
        assert.deepEqual([...cases.keys()].sort(),matrix.cases.map(([name])=>name).sort());
        return {scope:"two-new-local-authenticated-saves",proof,captures,
            cases:matrix.cases.map(([name])=>cases.get(name)),httpReaderRequests:http.count(),
            acceptedPgTurns:captures.filter(c=>c.revision>0).length,loginSessions:4,
            matrixComplete:[...cases.values()].every(c=>c.status==="PASS")};
    } finally { await http.close(); }
}
