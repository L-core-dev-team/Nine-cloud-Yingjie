"""Manage the dedicated local P05 cluster. No model credentials are consumed."""
import argparse
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
BASE = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "NineCloud-P05"
PIN = "f1fe6ea561c5ef4d1ec670b7a406625ce5df774c"

def port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1",0))
        return sock.getsockname()[1]

def private(d):
    if os.name == "nt":
        who = subprocess.check_output(["whoami"],text=True).strip()
        subprocess.run(["icacls",str(d),"/inheritance:r","/grant:r",who+":(OI)(CI)F"],check=True,stdout=subprocess.DEVNULL)
    else:
        d.chmod(0o700)

def save(path,obj):
    tmp=path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj),encoding="utf8")
    os.replace(tmp,path)

def pg(cfg,d,*args):
    tool,*rest=args
    subprocess.run([str(Path(cfg["bin"])/tool),*map(str,rest)],check=True,stdout=subprocess.DEVNULL,timeout=100)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("command",choices=["start","resume","stop","cleanup","open","entry"])
    ap.add_argument("instance",choices=["demo","rehearsal","reader","visual-reader","visual-demo"])
    ap.add_argument("--upstream",type=Path);ap.add_argument("--runtime",type=Path);ap.add_argument("--pg-bin",type=Path)
    a=ap.parse_args()
    d=BASE/a.instance
    if d.resolve().parent!=BASE.resolve() or BASE.is_symlink() or d.is_symlink() or getattr(d,"is_junction",lambda:False)():
        raise ValueError("unexpected instance directory")
    config=d/"private.json"; marker=d/"p05-owned"
    if a.command=="start":
        if not (a.upstream and a.runtime and a.pg_bin): ap.error("start requires --upstream, --runtime and --pg-bin")
        if d.exists():raise ValueError("existing instance: use resume")
        subprocess.run(["git","-C",str(a.upstream),"cat-file","-e",PIN+"^{commit}"],check=True)
        assert (a.runtime/"b2-pin").read_text()==PIN
        d.mkdir(parents=True);private(d);marker.write_text("P05/1:"+a.instance)
        cfg=dict(bin=str(a.pg_bin.resolve()),upstream=str(a.upstream.resolve()),runtime=str(a.runtime.resolve()),
                 pgPort=port(),httpPort=port(),admin=secrets.token_hex(32),app=secrets.token_hex(32),secret=secrets.token_hex(32))
        while cfg["pgPort"]==cfg["httpPort"]:cfg["httpPort"]=port()
        save(config,cfg)
        pw=d/"bootstrap-password"
        try:
            pw.write_text(cfg["admin"]+"\n",encoding="ascii")
            pg(cfg,d,"initdb","-D",d/"pgdata","-U","p05_admin","-A","scram-sha-256","--no-locale","--encoding=UTF8","--pwfile="+str(pw))
        finally:pw.unlink(missing_ok=True)
    if marker.read_text()!="P05/1:"+a.instance:raise ValueError("instance marker")
    cfg=json.loads(config.read_bytes())
    if a.command in ("entry","open"):
        entry=d/"open.html"
        if not entry.is_file():raise ValueError("start or resume the instance first")
        if a.command=="open":os.startfile(entry)
        else:print(entry)
        return
    if a.command in ("stop","cleanup"):
        # The private control channel is polled by this instance only.
        (d/"stop").touch()
        for _ in range(120):
            if not (d/"active").exists():break
            time.sleep(.1)
        if (d/"active").exists():raise RuntimeError("host did not acknowledge stop")
        if (d/"pgdata/postmaster.pid").exists():pg(cfg,d,"pg_ctl","-D",d/"pgdata","-m","fast","-w","stop")
        if a.command=="cleanup":
            if d.resolve().parent!=BASE.resolve() or (d/"pgdata/postmaster.pid").exists():raise RuntimeError("cleanup guard")
            shutil.rmtree(d)
        print(a.command,a.instance);return
    if (d/"active").exists():
        try:
            with urlopen("http://127.0.0.1:%d/health"%cfg["httpPort"],timeout=1) as r:
                if r.read()==b"P05": print("Already running",d/"open.html");return
        except OSError:pass
        # An abandoned marker contains a PID; never start a second living host.
        import ctypes
        if os.name=="nt":
            handle=ctypes.windll.kernel32.OpenProcess(0x1000,False,int((d/"active").read_text()))
            if handle:ctypes.windll.kernel32.CloseHandle(handle);raise RuntimeError("existing host requires inspection")
        else:raise RuntimeError("inspect stale host marker")
        (d/"active").unlink()
    (d/"stop").unlink(missing_ok=True)
    if not (d/"pgdata/postmaster.pid").exists():
        pg(cfg,d,"pg_ctl","-D",d/"pgdata","-l",d/"postgres.log","-o",f"-h 127.0.0.1 -p {cfg['pgPort']}","-w","start")
    env={k:v for k,v in os.environ.items() if k.upper() in {"PATH","SYSTEMROOT","WINDIR","COMSPEC","PATHEXT","TEMP","TMP","LOCALAPPDATA"}}
    env["NODE_ENV"]="test"
    with (d/"host.log").open("ab") as log:
        proc=subprocess.Popen(["node",str(HERE/"host.mjs"),str(d)],env=env,stdout=log,stderr=log,stdin=subprocess.DEVNULL,
                              creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
    for _ in range(160):
        if proc.poll() is not None:raise RuntimeError("host stopped; inspect private host.log")
        try:
            with urlopen("http://127.0.0.1:%d/health"%cfg["httpPort"],timeout=.4) as r:
                if r.read()==b"P05":print("Ready:",d/"open.html");return
        except OSError:time.sleep(.25)
    raise RuntimeError("host startup timeout")

if __name__=="__main__":main()
