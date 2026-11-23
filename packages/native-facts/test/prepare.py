"""Read pinned public rule sources from a local git object store. No fetch or install."""
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

pin = "f1fe6ea561c5ef4d1ec670b7a406625ce5df774c"
repo, out = map(lambda s: Path(s).resolve(), sys.argv[1:])
out.mkdir(parents=True, exist_ok=False)
plugins = ["p1-prologue-plugin", "p1-review-rule-approval", "p1-rule-semantic-functions", "p1-memory-policy"]
paths = ["packages/" + p + "/src" for p in ("contracts","domain","content")]
paths += ["apps/api/src/services/" + p + ".ts" for p in plugins]
archive = subprocess.check_output(["git","-C",str(repo),"archive","--format=zip",pin,*paths])
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    z.extractall(out)
locked = json.loads(subprocess.check_output(["git","-C",str(repo),"show",pin+":packages/contracts/package.json"]))
zod = repo/"node_modules/zod"
version = json.loads((zod/"package.json").read_bytes())["version"]
assert version == locked["dependencies"]["zod"]
shutil.copytree(zod, out/"node_modules/zod")
(out/"package.json").write_text('{"type":"module"}', encoding="ascii")
subprocess.run(["node",str(Path(__file__).with_name("transpile.cjs")),str(repo),str(out)],check=True)
(out/"pin.json").write_text(json.dumps(dict(commit=pin,zod=version)), encoding="ascii")
print("Pinned public rule runtime prepared", pin, version)
