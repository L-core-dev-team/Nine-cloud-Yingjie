"""No arguments: read-only preflight; --live: enforce all gates before reserving."""
import datetime as dt
import json
import sqlite3
import sys
from batch import LIVE_FILE, Ledger, attempt, blockers, live_summary
from pilot import BATCH, POLICY, SLOTS, history, request, require, sha

def run(live=False):
    now=dt.datetime.now(dt.timezone.utc)
    reasons=blockers(now)
    try:
        ledger_summary=live_summary()
        if ledger_summary["exists"] or LIVE_FILE.parent.exists():
            reasons.append("EXISTING_BATCH_REQUIRES_RECONCILIATION")
    except (OSError,ValueError,TypeError,RuntimeError,sqlite3.Error):
        ledger_summary=None
        reasons.append("LEDGER_UNVERIFIED")
    frames=[{"slot":g+str(r),"sourceSha256":sha(history(g,r)[-1].encode()),
             "preparedRequestSha256":sha(request(g,r)),"requestBytes":len(request(g,r)),
             "status":"NOT_RUN","raw":None,"projection":None,"score":None} for g,r in SLOTS]
    report={"batch":POLICY["approval"],"freezeDigest":BATCH,
            "status":"LIVE_BLOCKED" if reasons else "PREFLIGHT_READY","blockers":reasons,
            "ledger":ledger_summary,"frames":frames,"thisRunPossibleSends":0,"success":0,"modelGET":0,
            "actualReturnedTokens":None,"estimatedCostUsd":None,"billingVerified":False,
            "humanReview":"HUMAN_REVIEW_NOT_RUN","imageCalls":0}
    if reasons or not live:
        return report
    ledger=Ledger()
    previous=None
    from score import evaluate  # Evaluation occurs after the response; never serialized into the request.
    try:
        for frame,(g,r) in zip(frames,SLOTS,strict=True):
            if r==1:
                previous=None
            try:
                receipt=attempt(ledger,g,r,dt.datetime.now(dt.timezone.utc),previous)
            except (ValueError,OSError):
                row=ledger.db.execute("SELECT phase FROM attempts WHERE logical=?",(g+str(r),)).fetchone()
                frame["status"]=row[0] if row else "LOCAL_STOP"
                report["status"]="AI_SNAPSHOT_PARTIAL"
                break
            previous=receipt["projection"]
            frame.update(status="ACK",raw=receipt["proposal"],projection=previous,
                         score=evaluate(g,r,receipt["proposal"],previous),usage=receipt["response"]["usage"],
                         usageCostUpperNanoUsd=receipt["worstUsageNanoUsd"])
            report["success"]+=1
        else:
            report["status"]="CANDIDATES_AWAITING_REVIEW"
        report["ledger"]=live_summary()
        report["thisRunPossibleSends"]=report["ledger"]["possibleSends"]
        usage=[x["usage"] for x in frames if "usage" in x]
        if usage:
            report["actualReturnedTokens"]=sum(u["total_tokens"] for u in usage)
    finally:
        ledger.db.close()
    return report

if __name__=="__main__":
    require(sys.argv[1:] in ([],["--live"]),"INVALID_MODE")
    result=run(sys.argv[1:]==["--live"])
    print(json.dumps(result,ensure_ascii=True,indent=2))
    sys.exit(2 if result["status"]=="LIVE_BLOCKED" else 0)
