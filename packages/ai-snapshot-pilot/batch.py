"""Reserve before the transport boundary. Only rehearsal can use a caller-supplied file."""
import datetime as dt
import json
import os
import sqlite3
from pathlib import Path
from pilot import POLICY, BATCH, SLOTS, request, sha, encoded, require, project

LIVE_FILE = Path.home()/".nine-cloud-yingjie"/"yj-p04-ai-snapshot-01"/"approval.sqlite"
EXPIRY = dt.datetime.fromisoformat(POLICY["expires"])
RESERVE = POLICY["plannedReserveNanoUsd"]
LIMIT = POLICY["ceilingNanoUsd"]
PRICE = POLICY["standardShortNanoPerToken"]

def blockers(now):
    reasons=[]
    key=os.environ.get("OPENAI_API_KEY","").strip()
    if not key:
        reasons.append("API_KEY_NOT_CONFIGURED")
    # Only reviewed records pinned with this batch may supply evidence; no CLI override.
    access=POLICY["projectWriteEvidence"]
    if not (key and isinstance(access,dict) and access.get("model")==POLICY["model"]
            and access.get("standardWrite") is True and access.get("asOf")==POLICY["asOf"]
            and access.get("projectId") and access.get("credentialFingerprint")==sha(key.encode())):
        reasons.append("PROJECT_STANDARD_WRITE_UNVERIFIED")
    bound=POLICY["verifiedFramingBound"]
    billing=POLICY["verifiedFailureBilling"]
    if not (isinstance(bound,dict) and type(bound.get("maxChargedInputTokens")) is int
            and 0<bound["maxChargedInputTokens"]<=POLICY["plannedMaxInputTokens"]
            and bound.get("requestHashes")==[sha(request(g,r)) for g,r in SLOTS]
            and isinstance(billing,dict) and billing.get("standardShortRates")==PRICE
            and billing.get("coversAllOutcomes") is True and billing.get("additionalNanoUsd")==0
            and isinstance(access,dict) and access.get("projectId")
            and billing.get("projectId")==access["projectId"] and billing.get("asOf")==POLICY["asOf"]):
        reasons.append("ALL_IN_COST_BOUND_UNVERIFIED")
    if now>=EXPIRY or now.astimezone(EXPIRY.tzinfo).date().isoformat()!=POLICY["asOf"]:
        reasons.append("PRICE_WINDOW_CLOSED")
    return reasons

def live_summary():
    # A blocked preflight must not create a new grant, directory, or ledger.
    if not LIVE_FILE.exists():
        return {"exists":False,"possibleSends":0,"reservedNanoUsd":0}
    with sqlite3.connect(LIVE_FILE.as_uri()+"?mode=ro",uri=True) as db:
        grant,binding=db.execute("SELECT grant_id,binding FROM grant_state").fetchone()
        require((grant,binding)==(POLICY["approval"],BATCH),"LEDGER_BINDING_MISMATCH")
        n,cost=db.execute("SELECT count(*),coalesce(sum(reserved),0) FROM attempts").fetchone()
    return {"exists":True,"possibleSends":n,"reservedNanoUsd":cost}

class Ledger:
    def __init__(self, file=None):
        live=file is None
        if live:
            require(not blockers(dt.datetime.now(dt.timezone.utc)),"LIVE_BLOCKED")
            file=LIVE_FILE
            if not file.is_file():
                # Existing task directory with a missing ledger is an uncertain previous run.
                file.parent.mkdir(mode=0o700,parents=True,exist_ok=False)
        else:
            require(file.resolve()!=LIVE_FILE.resolve(),"FAKE_LEDGER_SEPARATION")
        self.db=sqlite3.connect(file,isolation_level=None,timeout=4)
        self.db.executescript("""
          PRAGMA synchronous=FULL;
          CREATE TABLE IF NOT EXISTS grant_state(id INTEGER PRIMARY KEY CHECK(id=1), grant_id TEXT, binding TEXT);
          CREATE TABLE IF NOT EXISTS attempts(slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 9), logical TEXT UNIQUE,
            request_sha TEXT, binding TEXT, reserved INTEGER CHECK(reserved>0), phase TEXT, receipt TEXT);
        """)
        identity=POLICY["approval"] if live else POLICY["approval"]+"/fake"
        self.db.execute("INSERT OR IGNORE INTO grant_state VALUES(1,?,?)",(identity,BATCH))
        require(self.db.execute("SELECT grant_id,binding FROM grant_state WHERE id=1").fetchone()==(identity,BATCH),
                "LEDGER_BINDING_MISMATCH")
        self.live=live

    def claim(self, group, rev, body, now, reserve=RESERVE):
        require((group,rev) in SLOTS,"SLOT_OUT_OF_RANGE")
        require(now<EXPIRY and now.astimezone(EXPIRY.tzinfo).date().isoformat()==POLICY["asOf"],"EXPIRED")
        if self.live:
            require(not blockers(now),"LIVE_BLOCKED")
        require(body==request(group,rev),"UNAPPROVED_BODY")
        ordinal=SLOTS.index((group,rev))+1
        self.db.execute("BEGIN IMMEDIATE")
        try:
            n,held,stopped=self.db.execute("""SELECT count(*),coalesce(sum(reserved),0),
                count(*) FILTER(WHERE phase!='ACK') FROM attempts""").fetchone()
            require(n<9 and ordinal==n+1 and not stopped,"ALREADY_CLAIMED_OR_STOPPED")
            require(type(reserve) is int and 0<reserve<=LIMIT-held,"BUDGET_EXCEEDED")
            require(reserve==RESERVE and RESERVE==POLICY["plannedMaxInputTokens"]*max(PRICE[k] for k in
                    ("input","write30m","write12h"))+POLICY["maxOutputTokens"]*PRICE["output"],"BAD_RESERVATION")
            self.db.execute("INSERT INTO attempts VALUES(?,?,?,?,?,'POSSIBLE_SENT',NULL)",
                            (ordinal,group+str(rev),sha(body),BATCH,reserve))
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise

    def finish(self,group,rev,phase,receipt):
        require(phase in ("ACK","UNKNOWN_STOP","HTTP_STOP","USAGE_STOP","RESPONSE_STOP","PROPOSAL_STOP"),"PHASE")
        row=self.db.execute("UPDATE attempts SET phase=?,receipt=? WHERE logical=? AND phase='POSSIBLE_SENT'",
                            (phase,encoded(receipt).decode(),group+str(rev)))
        require(row.rowcount==1,"CLAIM_MISMATCH")

def check_response(group,rev,data,previous):
    require(isinstance(data,dict) and data.get("model")==POLICY["model"] and
            data.get("service_tier")==POLICY["tier"] and data.get("status")=="completed" and not data.get("error"),
            "RESPONSE_STOP")
    usage=data.get("usage") or {}
    i,o,t=(usage.get(k) for k in ("input_tokens","output_tokens","total_tokens"))
    require(all(type(v) is int and v>0 for v in (i,o,t)) and i+o==t and
            i<=POLICY["plannedMaxInputTokens"] and o<=POLICY["maxOutputTokens"],"USAGE_STOP")
    items=data.get("output")
    require(isinstance(items,list) and all(isinstance(x,dict) and x.get("type") in ("message","reasoning")
            for x in items),"RESPONSE_STOP")
    messages=[x for x in items if x["type"]=="message"]
    require(len(messages)==1 and messages[0].get("role")=="assistant" and messages[0].get("status")=="completed",
            "RESPONSE_STOP")
    parts=messages[0].get("content")
    require(isinstance(parts,list) and len(parts)==1 and isinstance(parts[0],dict)
            and parts[0].get("type")=="output_text","RESPONSE_STOP")
    text=parts[0].get("text")
    require(isinstance(text,str) and len(text.encode())<=32768,"RESPONSE_STOP")
    try:
        def unique(pairs):
            obj=dict(pairs)
            require(len(obj)==len(pairs),"DUPLICATE_KEY")
            return obj
        candidate=json.loads(text,object_pairs_hook=unique)
        projection=project(group,rev,candidate,previous)
    except (ValueError,TypeError,KeyError,RecursionError):
        raise ValueError("PROPOSAL_STOP") from None
    return {"response":data,"proposal":candidate,"projection":projection,
            "worstUsageNanoUsd":i*max(PRICE["input"],PRICE["write30m"],PRICE["write12h"])+o*PRICE["output"]}

def attempt(ledger,group,rev,now,previous=None,*,fake=None):
    require((fake is None)==ledger.live,"TRANSPORT_BINDING")
    body=request(group,rev)
    ledger.claim(group,rev,body,now)
    try:
        status,data=official_response(body) if ledger.live else fake(body)
    except Exception:
        ledger.finish(group,rev,"UNKNOWN_STOP",{})
        raise ValueError("UNKNOWN_STOP") from None
    if status!=200:
        ledger.finish(group,rev,"HTTP_STOP",{"httpStatus":status})
        raise ValueError("HTTP_STOP")
    try:
        receipt=check_response(group,rev,data,previous)
    except ValueError as exc:
        ledger.finish(group,rev,str(exc),{"httpStatus":status,"response":data})
        raise
    ledger.finish(group,rev,"ACK",receipt)
    return receipt

def official_response(body):
    import http.client
    import ssl
    # Standard HTTPSConnection has no proxy, redirect following or retry loop.
    conn=http.client.HTTPSConnection("api.openai.com",443,timeout=45,context=ssl.create_default_context())
    try:
        conn.request("POST","/v1/responses",body,{"Content-Type":"application/json",
                     "OpenAI-Project":POLICY["projectWriteEvidence"]["projectId"],
                     "Authorization":"Bearer "+os.environ["OPENAI_API_KEY"]})
        res=conn.getresponse()
        if res.status!=200:
            return res.status,None
        payload=res.read(512001)
        require(len(payload)<=512000,"OVERSIZED_RESPONSE")
        return res.status,json.loads(payload)
    finally:
        conn.close()
