"""Open the completed formal run, or create/resume the user's own isolated reading slot."""
import json
import os
from pathlib import Path
import subprocess
import sys
from session import BASE,HERE

def main(mode):
    if mode not in ("reader","demo","visual-reader","visual-demo"):raise ValueError("unknown play mode")
    cmd=[sys.executable,"-B",str(HERE/"session.py")]
    if (BASE/mode/"p05-owned").is_file():
        subprocess.run(cmd+["resume",mode],check=True)
    elif mode in ("reader","visual-reader"):
        paths={}
        if (BASE/"demo/private.json").is_file():
            local=json.loads((BASE/"demo/private.json").read_bytes())
            paths={k:local[k] for k in ("upstream","runtime","bin")}
        for k,env in (("upstream","P05_UPSTREAM"),("runtime","P05_RUNTIME"),("bin","P05_PG_BIN")):
            if os.environ.get(env):paths[k]=os.environ[env]
        if not all(Path(paths.get(k,"")).is_dir() and paths.get(k) for k in ("upstream","runtime","bin")):
            raise RuntimeError("Set P05_UPSTREAM, P05_RUNTIME and P05_PG_BIN; see README.md")
        subprocess.run(cmd+["start",mode,"--upstream",paths["upstream"],"--runtime",paths["runtime"],"--pg-bin",paths["bin"]],check=True)
    else:raise RuntimeError("Formal local save is unavailable")
    subprocess.run(cmd+["open",mode],check=True)
if __name__=="__main__":main(sys.argv[1])
