"""Run the offline Node entry points and save their machine-readable measurements."""
import json
from pathlib import Path
import subprocess
import time

root = Path(__file__).resolve().parents[3]
out = root / "docs/reports/evidence/YJ-P04-H2"
out.mkdir(parents=True, exist_ok=True)
def record(name, value):
    (out / (name + ".json")).write_bytes((json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode())
def run(name):
    command = ["node", "--permission", "--allow-fs-read=*", "packages/highlights/v2/" + name + ".mjs"]
    process = subprocess.run(command, cwd=root, stdout=subprocess.PIPE)
    data = json.loads(process.stdout)
    if process.returncode:
        record(name + "-failed", data)
        process.check_returncode()
    return data

start = time.perf_counter()
compile_cmd = ["node", "--permission", "--allow-fs-read=*", "--allow-fs-write=packages/contracts/dist",
               "packages/contracts/node_modules/typescript/bin/tsc", "-p", "packages/contracts/tsconfig.json"]
subprocess.run(compile_cmd, cwd=root, check=True)
compile_ms = (time.perf_counter() - start) * 1000
data = run("measure")
for key, value in data.items():
    record(key, value)
record("guards", run("guards"))
benchmark = run("benchmark")
benchmark.update(compileCommand=compile_cmd, compileMs=compile_ms)
record("benchmark", benchmark)
