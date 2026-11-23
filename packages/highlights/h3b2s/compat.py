"""Run legacy suites in temporary output trees and reproduce historical red gates."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[3]
old = root / "docs/reports/evidence/YJ-P04-H3B2"
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)

def read(path):
    return json.loads(path.read_bytes())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def save(name, value):
    (out / name).write_bytes((json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode())

spec = spec_from_file_location("legacy", root / "packages/highlights/h3b2/regression.py")
legacy = module_from_spec(spec)
spec.loader.exec_module(legacy)
with tempfile.TemporaryDirectory() as tmp:
    legacy.out = Path(tmp)
    legacy.main()
    reg = read(legacy.out / "regression.json")
    for f in legacy.out.glob("compat-*.json"):
        shutil.copyfile(f, out / f.name)
    reg["h3b2Safety"] = read(legacy.out / "safety.json")
    reg["h3b2Prefixes"] = read(legacy.out / "prefix-replay.json")["counts"]
    reg["legacyReproduction"] = {}
    for name in ["safety", "causal-audit", "public-errors", "prefix-replay"]:
        reg["legacyReproduction"][name] = digest(legacy.out / (name+".json")) == digest(old / "repair" / (name+".json"))

with tempfile.TemporaryDirectory() as tmp:
    copy = Path(tmp)
    script = copy / "packages/highlights/h3b2/accept.py"
    script.parent.mkdir(parents=True)
    shutil.copyfile(root / "packages/highlights/h3b2/accept.py", script)
    copy_evidence = copy / "docs/reports/evidence/YJ-P04-H3B2"
    shutil.copytree(old, copy_evidence)
    result = subprocess.run([sys.executable, "-B", str(script)], capture_output=True)
    reg["historicalH3B2Gate"] = dict(exit=result.returncode, output=result.stdout.decode().strip(),
                                    identical=digest(copy_evidence/"acceptance.json") == digest(old/"acceptance.json"))
historical = read(root / "docs/reports/evidence/YJ-P04-H3B2S/pre-fix.json")["historicalHashes"]
reg["historicalFilesChecked"] = len(historical)
reg["changedHistoricalFiles"] = [f for f, h in historical.items() if digest(old/f) != h]
save("regression.json", reg)
if reg["changedHistoricalFiles"] or not all(reg["legacyReproduction"].values()) or reg["historicalH3B2Gate"]["exit"] != 1:
    raise SystemExit(1)
