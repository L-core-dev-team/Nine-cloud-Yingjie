"""Start only a freshly initialized B2 cluster, after the original managed loopback probe passes."""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile

PIN = "f1fe6ea561c5ef4d1ec670b7a406625ce5df774c"
root = Path(__file__).resolve().parents[3]
def main():
    upstream, runtime, pg_bin = map(lambda arg: Path(arg).resolve(), sys.argv[1:])
    env = {k:v for k,v in os.environ.items() if k.upper() in {
        "PATH","SYSTEMROOT","WINDIR","COMSPEC","PATHEXT","TEMP","TMP","LANG","LOCALAPPDATA"}}
    env["NODE_ENV"] = "test"
    probe = subprocess.run(["node","packages/luna-text/test/loopback-probe.mjs"],cwd=root,env=env,capture_output=True)
    evidence = json.loads(probe.stdout)
    print(json.dumps(evidence),flush=True)
    if probe.returncode or evidence["status"] != "LOOPBACK_PASS":
        return 1
    subprocess.run(["node","packages/native-reader-b2/test/rule-gate.mjs",str(runtime)],cwd=root,env=env,check=True)
    # The probe releases its test port. Select another ephemeral port for this cluster.
    import socket
    with socket.socket() as sock:
        sock.bind(("127.0.0.1",0))
        port = sock.getsockname()[1]
    parent = Path(tempfile.gettempdir()).resolve()
    folder = Path(tempfile.mkdtemp(prefix="yj-native-b2-",dir=parent)).resolve()
    assert folder.parent == parent and folder.name.startswith("yj-native-b2-")
    data = folder/"pgdata"
    pw = folder/"initial-password"
    ctl = str(pg_bin/"pg_ctl")
    own = secrets.token_hex(32)
    started = False
    def tool(args):
        subprocess.run(args,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True,timeout=90)
    try:
        with pw.open("x",encoding="ascii") as handle:
            handle.write(own+"\n")
        try:
            tool([str(pg_bin/"initdb"),"-D",str(data),"-U","b2_admin","-A","scram-sha-256",
                  "--no-locale","--encoding=UTF8","--pwfile="+str(pw)])
        finally:
            pw.unlink(missing_ok=True)
        tool([ctl,"-D",str(data),"-l",str(folder/"pg.log"),"-o",f"-h 127.0.0.1 -p {port}","-w","start"])
        started = True
        result = subprocess.run(["node","packages/native-reader-b2/test/cluster-run.mjs",str(upstream),str(runtime)],
                                cwd=root,env=env,input=json.dumps(dict(port=port,password=own,dataDirectory=str(data))).encode())
        return result.returncode
    finally:
        if started or (data/"postmaster.pid").exists():
            tool([ctl,"-D",str(data),"-m","fast","-w","stop"])
        # Delete only this invocation's newly created directory once the owned server is down.
        if not (data/"postmaster.pid").exists() and folder.parent == parent:
            shutil.rmtree(folder)

if __name__ == "__main__":
    sys.exit(main())
