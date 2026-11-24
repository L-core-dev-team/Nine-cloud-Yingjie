// B2 test host only. No HTTP mount, model configuration, external proofs or caller-supplied SQL.
import {digest} from "../native-facts/admission.mjs";
import {genesis, requireProof, verifyPrefix} from "./history.mjs";

const liveScope = `FROM auth_sessions x JOIN auth_accounts a ON a.id=x.owner_id
  JOIN game_saves s ON s.owner_id=a.id WHERE x.token_hash=$1 AND x.expires_at>statement_timestamp()
  AND a.id=$2 AND NOT a.is_guest AND a.closed_at IS NULL AND s.id=$3 AND s.branch_id='root'
  AND NOT EXISTS (SELECT 1 FROM cloud_archive_trash t WHERE t.save_id=s.id)`;
const base = {sceneEligible:false, send:false, added:0};
const denied = () => ({...base, status:"DENIED"});
const uncertain = () => ({...base, status:"UNVERIFIED"});

async function readTransaction(pool, operation) {
    const client = await pool.connect();
    let discard = false;
    try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        await client.query("SET LOCAL statement_timeout='5s'");
        const result = await operation(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch { discard = true; }
        throw error;
    } finally { client.release(discard); }
}

export async function makeLocalReader({pool, auth, core, created, databaseName, barriers = {}}) {
    // Trusted bootstrap passes only normal create results for this newly provisioned
    // empty test database. Never accept this list, the pool or hooks in a request.
    requireProof(process.env.NODE_ENV === "test" && /^jiuxiao_test_b2_[0-9_]+$/.test(databaseName));
    const target = await pool.query("SELECT current_database() AS name, host(inet_server_addr()) AS host");
    requireProof(target.rows[0]?.name === databaseName && target.rows[0]?.host === "127.0.0.1");
    const {hashToken} = await core.load("apps/api/dist/services/email-auth.js");
    const {PostgresCloudSaveRepository} = await core.load("apps/api/dist/services/postgres-cloud-save-repository.js");
    const {computeCanonRuntimeArtifactHash} = await core.load("apps/api/dist/services/authoritative-game.js");
    const canonHash = await computeCanonRuntimeArtifactHash();
    requireProof(created.length === 2 && new Set(created.map(s => s.ownerId)).size === 2 &&
        new Set(created.map(s => s.result.save.saveId)).size === 2);
    const scopes = new Map();
    for (const {ownerId, result} of created) {
        requireProof(result.status === "created" && result.duplicate === false &&
            result.save.revision === 0 && result.save.branchId === "root" &&
            result.save.canonArtifactHash === canonHash && result.save.state.facts.creationRequestHash);
        scopes.set(result.save.saveId, {ownerId, initial:digest(result.save), history:new Map(), ledger:new Map()});
    }
    async function authorize(token, saveId) {
        const scope = scopes.get(saveId);
        if (!scope || typeof token !== "string") return;
        const session = await auth.resolve(token);
        if (session?.kind !== "email" || session.ownerId !== scope.ownerId) return;
        return {scope, args:[hashToken(token),scope.ownerId,saveId]};
    }
    const visible = async (db, args) => (await db.query("SELECT s.revision " + liveScope,args)).rows[0];
    async function capture(token, saveId, revision, key = null) {
        const authority = await authorize(token, saveId);
        requireProof(authority && Number.isSafeInteger(revision) && revision >= 0);
        const {scope,args} = authority;
        requireProof(scope.history.size === revision && (revision === 0 ? key === null : typeof key === "string"));
        const checkpoint = await readTransaction(pool, async client => {
            requireProof((await visible(client,args))?.revision === revision);
            const save = await new PostgresCloudSaveRepository(client).getForOwner(scope.ownerId,saveId);
            requireProof(save?.revision === revision && save.canonArtifactHash === canonHash &&
                (revision !== 0 || digest(save) === scope.initial));
            const endpoint = await client.query(`SELECT count(*)::int AS count,
              (array_agg(event_hash ORDER BY sequence DESC))[1] AS end,
              verify_turn_event_chain($1) AS intact, pg_current_snapshot()::text AS snapshot
              FROM turn_events WHERE save_id=$1`,[saveId]);
            const {count,end,intact,snapshot} = endpoint.rows[0];
            requireProof(intact && (revision === 0 ? count === 0 : count > scope.history.get(revision-1).count));
            let receiptDigest = null;
            if (revision > 0) {
                const row = (await client.query("SELECT expected_revision,result FROM turn_requests WHERE save_id=$1 AND idempotency_key=$2",
                    [saveId,key])).rows[0];
                requireProof(row?.expected_revision === revision-1 && row.result?.resultingRevision === revision &&
                    row.result.idempotencyKey === key && row.result.decision.status === "accepted");
                receiptDigest = digest(row.result);
            }
            return {save,key,receiptDigest,count,end:end ?? genesis,snapshot,capturedAt:new Date().toISOString()};
        });
        requireProof((await visible(pool,args))?.revision === revision);
        requireProof(scope.history.size === revision);
        scope.history.set(revision,checkpoint);
        return {revision, count:checkpoint.count, stateSHA256:digest(checkpoint.save), capturedAt:checkpoint.capturedAt};
    }

    async function read(token, locator) {
        if (!locator || Object.keys(locator).sort().join(",") !== "branch,key,r,saveId" ||
            locator.branch !== "root" || !Number.isSafeInteger(locator.r) || locator.r < 1 ||
            typeof locator.key !== "string" || locator.key.length > 128) return denied();
        const {saveId,r,key} = locator;
        try {
            const authority = await authorize(token,saveId);
            if (!authority) return denied();
            const {scope,args} = authority;
            let result, missing = false;
            try { result = await readTransaction(pool, async client => {
                const first = await visible(client,args);
                if (!first) return;
                await barriers.afterSnapshot?.();
                const tip = scope.history.get(first.revision);
                requireProof(r <= first.revision && tip && scope.history.get(r)?.key === key);
                const chain = (await client.query(`SELECT verify_turn_event_chain($1) AS ok, count(*)::int AS count,
                  (array_agg(event_hash ORDER BY sequence DESC))[1] AS end FROM turn_events WHERE save_id=$1`,[saveId])).rows[0];
                requireProof(chain.ok && chain.count === tip.count && (chain.end ?? genesis) === tip.end);
                const rows = (await client.query(`SELECT e.*,turn_event_digest(e,e.previous_hash) AS recomputed,
                  e.occurred_at=date_trunc('milliseconds',e.occurred_at) AS exact_millis
                  FROM turn_events e WHERE save_id=$1 AND after_revision <= $2 ORDER BY sequence`,[saveId,r])).rows;
                const requests = (await client.query(`SELECT save_id,idempotency_key,expected_revision,result
                  FROM turn_requests WHERE save_id=$1 AND expected_revision<$2 AND result->'decision'->>'status'='accepted'`,[saveId,r])).rows;
                return {...verifyPrefix(core,locator,scope.history,rows,requests), observedThroughRevision:first.revision};
            }); } catch { missing = true; }
            await barriers.beforeDelivery?.();
            // One fresh statement jointly tests this exact token, owner, account and save;
            // its snapshot is the authorization linearization point, even on repeated reads.
            const final = await visible(pool,args);
            if (!final) return denied();
            if (missing) return uncertain();
            if (!result) return denied();
            if (final.revision < result.observedThroughRevision) return uncertain();
            if (!result.location) return {...base,status:"NO_WHITELIST_FACT",reason:result.classification};
            const previous = scope.ledger.get(key);
            if (!previous) scope.ledger.set(key,{evidenceLearnedAt:new Date().toISOString(),
                learnedThroughRevision:final.revision, targetRevision:r, ...result.location});
            return {...base,status:"CONFIRMED_NATIVE_LOCATION",source:"local-test-pg-history/1",added:previous?0:1,
                observedThroughRevision:result.observedThroughRevision,...scope.ledger.get(key)};
        } catch { return denied(); }
    }
    return Object.freeze({capture,read});
}
