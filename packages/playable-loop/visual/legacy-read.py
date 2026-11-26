"""Read the existing formal v1 save and its bound PNGs through the host; no action or display ack."""
import hashlib,json,os,sqlite3
from pathlib import Path
from urllib.request import Request,build_opener,ProxyHandler
d=Path(os.environ["LOCALAPPDATA"])/"NineCloud-P05/visual-demo"
cfg=json.loads((d/"private.json").read_bytes())
with sqlite3.connect((d/"sidecar.sqlite").as_uri()+"?mode=ro",uri=True) as db:
    token=db.execute("SELECT v FROM kv WHERE k='session'").fetchone()[0]
op=build_opener(ProxyHandler({}))
def get(path):
    req=Request("http://127.0.0.1:"+str(cfg["httpPort"])+path,headers={"Cookie":"p05="+token})
    return op.open(req,timeout=10).read()
g=json.loads(get("/game"))
assert not g.get("continuing") and g["current"]["revision"]==8
assert g["visual"]["enabled"]
for rev in [1,3,4,5,8]:
    frame=g["visual"]["frames"][str(rev)]
    data=get("/pictures/history/"+str(rev)+"/"+frame["key"])
    assert hashlib.sha256(data).hexdigest()==frame["sha"]
print(json.dumps({"revision":8,"historicalImagesRead":[1,3,4,5,8],"bounded":True,"actions":0,"displayAcknowledgements":0}))
