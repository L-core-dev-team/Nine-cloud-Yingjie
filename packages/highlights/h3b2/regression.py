"""Fresh compatibility replay. Existing acceptance files are read-only inputs."""
from pathlib import Path
from importlib.util import module_from_spec,spec_from_file_location
import hashlib,json,subprocess,sys,tempfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parents[3]
evidence=root/'docs/reports/evidence'
out=evidence/'YJ-P04-H3B2'
def save(file,data):
    (out/file).write_bytes((json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n').encode())
def node(script):
    cmd=['node','--permission','--allow-fs-read=*',f'packages/highlights/{script}.mjs']
    result=subprocess.run(cmd,cwd=root,capture_output=True)
    if result.returncode:
        save(script.split('/')[-1]+'-red.json',dict(cmd=cmd,exit=result.returncode,stderr=result.stderr.decode(errors='replace')[-3000:]))
        result.check_returncode()
    return json.loads(result.stdout)
def main():
    spec=spec_from_file_location('h3b_record',root/'packages/highlights/h3b/record.py')
    mod=module_from_spec(spec);spec.loader.exec_module(mod)
    with tempfile.TemporaryDirectory() as temp:
        mod.out=Path(temp)
        mod.gate_c()
        mod.gate_d()
        actual=json.loads((mod.out/'regression.json').read_bytes())
        checks={}
        for name in ['proposal-measurement','causal-admission','public-errors','prefix-replay','safety','failures']:
            data=(mod.out/(name+'.json')).read_bytes()
            checks[name]=dict(sameAsH3B=data==(evidence/'YJ-P04-H3B'/(name+'.json')).read_bytes(),sha256=hashlib.sha256(data).hexdigest())
        actual['h3bReplay']=checks
        for f in mod.out.glob('compat-*.json'):(out/f.name).write_bytes(f.read_bytes())
        save('regression.json',actual)
        assert all(v['sameAsH3B'] for v in checks.values())
    prefix=node('h3b2/prefix')
    save('public-errors.json',prefix.pop('publicErrors'))
    save('causal-audit.json',dict(targeted=prefix.pop('targeted'),historicalChanges=prefix['historicalChanges'],problems=prefix['problems']))
    save('prefix-replay.json',prefix)
    save('safety.json',node('h3b2/safety'))
    save('benchmark.json',node('h3b2/bench'))
if __name__=='__main__':
    if '--repair' in sys.argv:
        out=out/'repair'
        out.mkdir(exist_ok=True)
    main()
