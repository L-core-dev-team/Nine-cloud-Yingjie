import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

export async function loadB2Rules(directory) {
    if (process.env.NODE_ENV !== "test") throw Error("test-runtime-required");
    const root = resolve(directory);
    const pin = await readFile(resolve(root, "b2-pin"), "utf8");
    if (pin !== "f1fe6ea561c5ef4d1ec670b7a406625ce5df774c") throw Error("unrecognized-build");
    const load = file => import(pathToFileURL(resolve(root, file)).href);
    const {loadTurnPlugin, prepareTurnRuntime} = await load("apps/api/dist/services/turn-runtime.js");
    const plugin = await loadTurnPlugin(resolve(root, "apps/api/dist/services/p1-prologue-plugin.js"));
    if (plugin?.reviewApproval?.semanticSha256 !== "sha256:8b938f92e0427ef03b44a7fe6cb90f8fb208e9ca7140a316dae187dfdd422006")
        throw Error("rule-approval-missing");
    const runtime = prepareTurnRuntime(plugin);
    return {runtime, approval:plugin.reviewApproval, load, contracts:await load("packages/contracts/dist/index.js"),
        domain:await load("packages/domain/dist/index.js")};
}
