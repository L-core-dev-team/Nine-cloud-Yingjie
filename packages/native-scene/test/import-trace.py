"""Extract only authorized public fields from a completed local B2 scene run."""
import json
from pathlib import Path
import sys
base=Path(__file__).resolve().parents[1]
rows=[json.loads(line) for line in Path(sys.argv[1]).read_bytes().splitlines() if line.startswith(b'{')]
assert rows[0]['status']=='LOOPBACK_PASS' and rows[-1]=={'cleanup':'complete','dedicatedDirectoryRemoved':True}
runs=[r for r in rows if r.get('suite')=='native-scene/1']
assert len(runs)==1
run=runs[0]
snapshots={c['revision']:c['stateSHA256'] for c in run['captures']}
trace=run['trace']
for frame in trace['frames']:
    assert set(frame)=={'action','version','access','revision','current','history','asset','sceneEligible','send'} | ({'reason'} if frame['access']=='authorized' else set())
    if frame['current']:
        assert set(frame['current'])=={'id','name','source','visual'}
        for h in frame['history']:
            assert set(h)=={'id','revision','from','to','learnedAt','learnedRevision','observedThroughRevision'}
            assert set(h['from'])==set(h['to'])=={'id','name'}
    frame['snapshotSHA256']=snapshots[frame['revision']] if frame['current'] else None
def save(p,v): p.write_bytes((json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode())
save(base/'trace.json',trace)
save(base.parents[1]/'docs/reports/evidence/YJ-P04-NATIVE-SCENE-01/host.json',
     dict(command='python -B packages/native-reader-b2/test/launch.py ../Nine-cloud ../b2-upstream-final <local-PG-bin> native-scene',
          probe=rows[0],captures=run['captures'],checks=run['checks'],pgConnections=run['appConnections'],cleanup=rows[-1]))
