"""Gate D only. Uses synthetic fixtures and the same no-network workers as H2."""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import tempfile
import time

root = Path(__file__).resolve().parents[3]
out = root / "docs/reports/evidence/YJ-P04-H2R"
old = root / "docs/reports/evidence/YJ-P04-H2"
def save(name, value):
    (out / (name + ".json")).write_bytes((json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode())

def run(key, cmd, tmp):
    args = cmd.split()
    receipts = []
    for i, arg in enumerate(args):
        if arg.startswith("../h2-reg-"):
            receipts.append(Path(tmp) / (key + ".json"))
            args[i] = str(receipts[-1])
    started = time.perf_counter()
    q = subprocess.run(args, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    txt = q.stdout.decode("utf-8", errors="replace").strip()
    result = {"command": cmd.replace("../h2-reg-", "<temp>/"), "exit": q.returncode,
              "elapsedMs": round((time.perf_counter() - started) * 1000, 1)}
    if key == "causalAudit" and txt.startswith("{"):
        data = json.loads(txt)
        save("causal-audit", data)
        result.update(count=len(data["results"]), failures=data["failed"])
        return key, result
    if q.returncode:
        result["error"] = q.stderr.decode(errors="replace")[-1800:]
        return key, result
    if receipts:
        result["receipt"] = json.loads(receipts[-1].read_bytes())
    if txt.startswith("{"):
        data = json.loads(txt)
        if key == "h2":
            original = json.loads((old / "measurement.json").read_bytes())
            result["sameMeasurement"] = data["measurement"] == original
            result["prefixes"] = data["measurement"]["prefixChecks"]
            assert result["sameMeasurement"]
        elif key == "originals":
            save("compatibility", data)
            result["summary"] = {k: {field:v for field,v in val.items() if field not in ("stories", "failures")} for k,val in data.items()}
        elif key == "bench":
            save("benchmark", data)
            result["medians"] = [row["median"] for row in data["rows"]]
        elif key == "h1":
            result["groups"] = data.get("groups")
            result["historicalFailures"] = data.get("failures")
        elif key == "s3":
            result["summary"] = {k:(len(v) if isinstance(v,list) else v) for k,v in data.items() if k in ("checks","turns")}
        else:
            result["summary"] = data
    else:
        result["stdout"] = txt if len(txt)<2000 else "\n".join(txt.splitlines()[-9:])
    return key, result

if __name__ == "__main__":
    commands = {key:val["cmd"] for key,val in json.loads((old / "regression.json").read_bytes()).items()}
    prefix = "node --permission --allow-fs-read=* packages/highlights/"
    commands.update(h2=prefix+"v2/measure.mjs", originals=prefix+"h2r/compatibility.mjs",
                    guards=prefix+"h2r/guards.mjs", causalAudit=prefix+"h2r/causal-audit.mjs")
    with tempfile.TemporaryDirectory() as temp, concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        jobs = [ex.submit(run,key,cmd,temp) for key,cmd in commands.items()]
        results = dict(job.result() for job in jobs)
    key, row = run("bench", prefix+"h2r/benchmark.mjs", None)
    results[key] = row
    for key, result in results.items():
        if "receipt" in result:
            save("reg-"+key,result.pop("receipt"))
            result["receiptFile"] = "reg-"+key+".json"
    save("regression", results)
    print({k:v["exit"] for k,v in results.items()})
    if any(x["exit"] for x in results.values()):
        raise SystemExit(1)
