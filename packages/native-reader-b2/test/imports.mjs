import assert from "node:assert/strict";
import {loadB2Rules} from "../runtime.mjs";
import {makeLocalReader} from "../reader.mjs";
import {runHistoricalPositive} from "./real-history.mjs";
const core = await loadB2Rules(process.argv[2]);
const required = {
    "card-import/local-runtime":"assertLocalCardDatabase","services/email-auth":"EmailAuthService",
    "services/postgres-email-auth":"PostgresEmailAuthRepository","services/authoritative-game":"AuthoritativeGameService",
    "services/postgres-cloud-save-repository":"PostgresCloudSaveRepository","services/postgres-server-turn":"createPostgresServerTurnRepository",
    "services/server-turn":"ServerTurnService"
};
for (const [file,name] of Object.entries(required)) {
    const mod = await core.load("apps/api/dist/"+file+".js");
    assert.equal(typeof mod[name],"function");
}
assert.equal(typeof makeLocalReader,"function");
assert.equal(typeof runHistoricalPositive,"function");
console.log(JSON.stringify({imports:Object.values(required),status:"MODULE_IMPORTS_ONLY",connections:0}));
