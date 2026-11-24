"""Build a new offline test runtime from pinned public Git objects and existing local packages."""
import io
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

PIN = "f1fe6ea561c5ef4d1ec670b7a406625ce5df774c"
repo, compiler, out = (Path(arg).resolve() for arg in sys.argv[1:])
out.mkdir(parents=True, exist_ok=False)
def git(*args):
    return subprocess.check_output(["git", "-C", str(repo), *args])

packages = ["packages/" + s for s in ("contracts", "domain", "content")]
paths = [p + suffix for p in packages for suffix in ("/src", "/package.json")]
paths += ["apps/api/src/services", "apps/api/src/card-import", "packages/db/drizzle/0013_event_integrity_ownership.sql",
          "scripts/p1-rule-semantic-source-digest.mjs", "scripts/p1-rule-candidate-digest.mjs",
          "scripts/p1-rule-candidate-bundle.files.json", "package.json"]
bundle = json.loads(git("show", PIN + ":scripts/p1-rule-candidate-bundle.files.json"))
with zipfile.ZipFile(io.BytesIO(git("archive", "--format=zip", PIN, *paths, *bundle["files"]))) as archive:
    archive.extractall(out)

def copy_package(source, name, version):
    manifest = json.loads((source / "package.json").read_bytes())
    assert manifest["version"] == version
    shutil.copytree(source, out / "node_modules" / name)

requested = json.loads((out / "package.json").read_bytes())["devDependencies"]["typescript-compiler-api"]
assert requested == "npm:typescript@6.0.2"
copy_package(compiler, "typescript-compiler-api", "6.0.2")
copy_package(repo / "node_modules/zod", "zod", json.loads((out/"packages/contracts/package.json").read_bytes())["dependencies"]["zod"])
# The upstream local-DB guard imports the offline tokenizer at module load.
api = json.loads(git("show", PIN + ":apps/api/package.json"))
copy_package(repo / "node_modules/js-tiktoken", "js-tiktoken", api["dependencies"]["js-tiktoken"])
assert "  base64-js@1.5.1:" in git("show", PIN + ":pnpm-lock.yaml").decode()
copy_package(repo / "node_modules/base64-js", "base64-js", "1.5.1")
(out / "package.json").write_bytes(b'{"type":"module"}\n')
transpiler = Path(__file__).resolve().parents[2] / "native-facts/test/transpile.cjs"
subprocess.run(["node", str(transpiler), str(repo), str(out)], check=True)
# Resolve each public export to the freshly built tree, including NLU subpaths.
for group in packages:
    manifest = json.loads((out / group / "package.json").read_bytes())
    dest = out / "node_modules" / manifest["name"]
    dest.mkdir(exist_ok=True, parents=True)
    exports = {}
    for index, (key, value) in enumerate(manifest["exports"].items()):
        target = value["default"] if isinstance(value, dict) else value
        if not target.endswith(".js"):
            continue
        shim = "export-" + str(index) + ".mjs"
        (dest / shim).write_text('export * from "../../../' + group + '/' + target[2:] + '";\n', encoding="utf-8")
        exports[key] = "./" + shim
    (dest / "package.json").write_text(json.dumps(dict(type="module", exports=exports)), encoding="utf-8")
    for resource in (out / group / "src").rglob("*.json"):
        target = out / group / "dist" / resource.relative_to(out / group / "src")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(resource, target)
(out / "b2-pin").write_text(PIN, encoding="ascii")
print("Prepared public sources", PIN)
