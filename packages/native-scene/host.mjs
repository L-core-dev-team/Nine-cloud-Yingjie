import {digest} from "../native-facts/admission.mjs";
import {createSceneRegistry} from "../first-play/scene-registry.mjs";
import {makeLocalReader} from "../native-reader-b2/reader.mjs";

const version="native-partial-scene/1";
const noImage={sceneEligible:false,send:false,asset:null};
const hidden=()=>({version,access:"hidden",revision:null,current:null,history:[],...noImage});
const visual=()=>({people:null,features:null,timeOfDay:null,lighting:null,viewpoint:null,perspective:null});

// Installed by the isolated B2 provisioner after normal creation of both games.
// This factory and the capture method are never exposed to the browser.
export async function openSceneHost({pool,core,auth,created,databaseName},index) {
    const reader=await makeLocalReader({pool,core,auth,created,databaseName});
    const {ownerId,result}=created[index], saveId=result.save.saveId;
    const {approvedLabel}=await core.load("apps/api/dist/services/approved-player-actions.js");
    const {hashToken}=await core.load("apps/api/dist/services/email-auth.js");
    const names=new Map(["loc_luhuadu","loc_wangqitai"].map(id=>[id,approvedLabel(id)]));
    const directory=createSceneRegistry([...names].map(([id,name])=>({
        sceneId:id.replaceAll("_","-"),name,parentSceneId:"序章"
    })));
    const refs=new Map();
    function place(id) {
        if (!names.has(id)) return null;
        const entry=directory.resolve(names.get(id),"序章").place;
        return entry ? {id,name:entry.name} : null;
    }
    async function current(token) {
        const principal=await auth.resolve(token);
        if (principal?.kind!=="email" || principal.ownerId!==ownerId) return null;
        const {rows}=await pool.query(`SELECT s.revision,s.snapshot->>'locationId' AS location
          FROM game_saves s JOIN auth_accounts a ON a.id=s.owner_id JOIN auth_sessions x ON x.owner_id=a.id
          WHERE s.id=$1 AND s.owner_id=$2 AND x.token_hash=$3 AND x.expires_at>statement_timestamp()
          AND a.closed_at IS NULL AND NOT a.is_guest AND s.schema_version=3 AND s.branch_id='root'
          AND s.parent_branch_id IS NULL AND s.rule_version=$4 AND s.canon_version=$5
          AND s.canon_artifact_hash=$6 AND s.snapshot->'facts'->>'archiveKind' IS DISTINCT FROM 'local-untrusted-v1'
          AND NOT EXISTS(SELECT 1 FROM cloud_archive_trash t WHERE t.save_id=s.id)`,
          [saveId,ownerId,hashToken(token),core.approval.ruleVersion,core.approval.canonVersion,result.save.canonArtifactHash]);
        return rows[0]??null;
    }
    async function present(token,request=null) {
        const start=await current(token);
        if (!start) return hidden();
        let reason=null, learned=null;
        if (request!==null) {
            if (!request || Object.keys(request).sort().join(",")!=="branch,key,r,saveId" ||
                request.saveId!==saveId || request.branch!=="root" || !Number.isSafeInteger(request.r) ||
                request.r<1 || request.r>start.revision || typeof request.key!=="string") return hidden();
            const locator={...request};
            const proof=await reader.read(token,locator);
            if (proof.status==="CONFIRMED_NATIVE_LOCATION" && proof.observedThroughRevision===start.revision) {
                learned={locator,id:digest([ownerId,saveId,"root",locator.key,locator.r]),observed:proof.observedThroughRevision};
            } else if (proof.status==="NO_WHITELIST_FACT") reason=proof.reason;
            else return hidden();
        }
        const known=new Map(refs);
        if (learned && !known.has(learned.id)) known.set(learned.id,learned);
        const history=[];
        for (const [id,{locator:ref,observed}] of known) {
            const h=await reader.knownAt(token,ref,start.revision);
            if (h.status==="NO_KNOWN_FACT") continue;
            if (h.status!=="KNOWN_LOCATION" || !place(h.from) || !place(h.to)) return hidden();
            history.push({id,revision:ref.r,from:place(h.from),to:place(h.to),
                learnedAt:h.evidenceLearnedAt,learnedRevision:h.learnedThroughRevision,observedThroughRevision:observed});
        }
        // A new joint session/account/save check linearizes this whole view.
        const end=await current(token);
        if (!end || end.revision!==start.revision || end.location!==start.location) return hidden();
        if (learned && !refs.has(learned.id)) refs.set(learned.id,learned);
        const location=place(end.location);
        return {version,access:"authorized",revision:end.revision,current:location && {...location,
            source:"current-authorized-pg-snapshot",visual:visual()},history:history.sort((a,b)=>a.revision-b.revision),
            reason,...noImage};
    }
    return Object.freeze({present,capture:(token,r,key)=>reader.capture(token,saveId,r,key)});
}
