import concurrent.futures
import copy
import datetime as dt
import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from batch import Ledger, RESERVE, LIMIT, attempt, blockers
from pilot import FIELDS, POLICY, SLOTS, TAG, history, project, request
from score import evaluate

def deny_net(event, args):
    if event.startswith("socket."): raise AssertionError("network denied in fake tests")
sys.addaudithook(deny_net)
NOW=dt.datetime.fromisoformat("2026-11-24T12:00:00+08:00")

def proposal():
    return {"tag":TAG,"exclusions":[],"claims":[{"field":f,"op":"unknown","status":"unknown",
        "previous":None,"values":None,"delta":[],"refs":[]} for f in FIELDS]}

def response():
    return {"model":POLICY["model"],"status":"completed","service_tier":"default",
            "usage":{"input_tokens":80,"output_tokens":220,"total_tokens":300},
            "output":[{"type":"message","role":"assistant","status":"completed",
            "content":[{"type":"output_text","text":json.dumps(proposal())}]}]}

def observed(group,rev,quote):
    return {"group":group,"rev":rev,"quote":quote,"layer":"current","visible":True}

class PilotChecks(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
    def ledger(self,name="fake.sqlite"):
        file=Path(self.tmp.name)/name
        db=Ledger(file)
        self.addCleanup(db.db.close)
        return db

    def test_configuration_and_amount_proof(self):
        with patch.dict(os.environ,{},clear=True):
            self.assertIn("API_KEY_NOT_CONFIGURED",blockers(NOW))
        self.assertIn("ALL_IN_COST_BOUND_UNVERIFIED",blockers(NOW))
        self.assertIn("PROJECT_STANDARD_WRITE_UNVERIFIED",blockers(NOW))
        self.assertLessEqual(9*RESERVE,LIMIT)

    def test_only_fixed_text_requests(self):
        for g,r in SLOTS:
            body=json.loads(request(g,r))
            data=json.loads(body["input"])
            self.assertEqual(data["group"],g)
            self.assertEqual([row["narrative"] for row in data["history"]],history(g,r))
            self.assertEqual(body["tools"],[])
            self.assertEqual(body["text"]["format"]["strict"],True)
            self.assertFalse(any(body[k] for k in ("store","stream","background")))
        db=self.ledger()
        with self.assertRaisesRegex(ValueError,"UNAPPROVED_BODY"):
            db.claim("A",1,b'{"model":"image"}',NOW)
        self.assertEqual(db.db.execute("SELECT count(*) FROM attempts").fetchone()[0],0)

    def test_nine_then_tenth_rejected(self):
        db=self.ledger()
        previous=None
        for g,r in SLOTS:
            previous=attempt(db,g,r,NOW,None if r==1 else previous,fake=lambda _: (200,response()))["projection"]
        self.assertEqual(db.db.execute("SELECT count(*),sum(reserved) FROM attempts").fetchone(),(9,9*RESERVE))
        with self.assertRaisesRegex(ValueError,"SLOT_OUT_OF_RANGE"):
            db.claim("D",1,b"",NOW)
        with self.assertRaisesRegex(ValueError,"ALREADY_CLAIMED"):
            db.claim("A",1,request("A",1),NOW)

    def test_budget_expiry_and_crash_reopen(self):
        db=self.ledger()
        with self.assertRaisesRegex(ValueError,"BUDGET_EXCEEDED"):
            db.claim("A",1,request("A",1),NOW,LIMIT+1)
        with self.assertRaisesRegex(ValueError,"EXPIRED"):
            db.claim("A",1,request("A",1),NOW+dt.timedelta(days=1))
        db.claim("A",1,request("A",1),NOW)
        db.db.close()
        reopened=self.ledger()
        for g,r in SLOTS[:2]:
            with self.assertRaisesRegex(ValueError,"ALREADY_CLAIMED"):
                reopened.claim(g,r,request(g,r),NOW)
        self.assertEqual(reopened.db.execute("SELECT phase,reserved FROM attempts").fetchone(),("POSSIBLE_SENT",RESERVE))

    def test_two_connections_compete(self):
        path=Path(self.tmp.name)/"compete.sqlite"
        Ledger(path).db.close()
        barrier=threading.Barrier(2)
        def compete(n):
            db=Ledger(path)
            try:
                barrier.wait(timeout=3)
                db.claim("A",1,request("A",1),NOW)
                return "won"
            except ValueError as exc: return str(exc)
            finally: db.db.close()
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            self.assertEqual(sorted(pool.map(compete,range(2))),["ALREADY_CLAIMED_OR_STOPPED","won"])

    def test_failures_stop_whole_batch(self):
        def timeout(_): raise TimeoutError()
        variants=[("timeout",timeout,"UNKNOWN_STOP"),("http",lambda _: (403,None),"HTTP_STOP")]
        for name,key,value,error in [("model","model","wrong","RESPONSE_STOP"),("tier","service_tier","fast","RESPONSE_STOP"),
                      ("truncated","status","incomplete","RESPONSE_STOP"),("usage","usage",None,"USAGE_STOP"),
                      ("output","usage",{"input_tokens":1,"output_tokens":4000,"total_tokens":4001},"USAGE_STOP"),
                      ("refusal","output",[{"type":"message","role":"assistant","status":"completed","content":[{"type":"refusal"}]}],"RESPONSE_STOP")]:
            variants.append((name,lambda _,k=key,v=value:(200,{**response(),k:v}),error))
        for name,fake,expected in variants:
            with self.subTest(name=name):
                db=self.ledger(name+".sqlite")
                with self.assertRaisesRegex(ValueError,expected): attempt(db,"A",1,NOW,fake=fake)
                with self.assertRaisesRegex(ValueError,"ALREADY_CLAIMED"): db.claim("A",2,request("A",2),NOW)
                self.assertEqual(db.db.execute("SELECT phase,reserved FROM attempts").fetchone(),(expected,RESERVE))

    def test_grounding_and_projection(self):
        p=proposal()
        c=p["claims"][0]
        c.update(status="complete",op="set",values=["听雨酒馆"],refs=[observed("A",1,"听雨酒馆")])
        first=project("A",1,p)
        self.assertEqual(first["values"]["place"],"听雨酒馆")
        self.assertIsNone(first["values"]["count"])
        self.assertFalse(first["send"] or first["sceneEligible"])
        p2=copy.deepcopy(p)
        p2["claims"][0].update(op="keep",previous=1,refs=[observed("A",2,"原处")])
        second=project("A",2,p2,first)
        self.assertEqual(first["candidateVisualHash"],second["candidateVisualHash"])
        self.assertEqual(second["changed"],[])
        # The verifier locates quotes; this deliberately insufficient quote cannot prove entailment.
        for field,value in (("group","B"),("rev",3),("quote","捏造引文"),("layer","dream"),("visible",False)):
            bad=copy.deepcopy(p);bad["claims"][0]["refs"][0][field]=value
            with self.assertRaises(ValueError): project("A",1,bad)
        wrong=copy.deepcopy(p);wrong["exclusions"]=[{**observed("A",1,"听雨酒馆"),"layer":"past"}]
        with self.assertRaisesRegex(ValueError,"OVERLAPPING_SCOPES"): project("A",1,wrong)
        self.assertIsNone(evaluate("A",1,None,None)["raw"])
        self.assertEqual(evaluate("A",1,p,first)["raw"]["place"],"wrong")

    def test_partial_and_exhaustive_rosters_and_deltas(self):
        def at(r, names, status, op, quote, delta=()):
            p=proposal()
            loc=next(c for c in p["claims"] if c["field"]=="place")
            loc.update(status="complete",op="set",values=["盐井值房"],
                       refs=[observed("C",r,"盐井值房" if r<3 else "整间值房")])
            c=next(c for c in p["claims"] if c["field"]=="people")
            c.update(status=status,op=op,values=names,delta=list(delta),previous=r-1 if op!="set" else None,
                     refs=[observed("C",r,quote)])
            return p
        partial=project("C",1,at(1,["乔麦"],"partial","set","只看得见帘前的乔麦"))
        self.assertIsNone(partial["values"]["count"])
        self.assertEqual(partial["partial"]["people"],["乔麦"])
        second=at(2,["乔麦"],"complete","set","除了她没有别人")
        baseline=project("C",2,second,partial)
        empty=at(3,[],"complete","remove","除我以外再无一人",["乔麦"])
        self.assertEqual(project("C",3,empty,baseline)["values"]["count"],0)
        with self.assertRaisesRegex(ValueError,"PREVIOUS_SCOPE"):
            project("C",3,empty,{**baseline,"group":"A"})
        empty["claims"][1]["delta"]=["无关人物"]
        with self.assertRaisesRegex(ValueError,"REMOVE_MISMATCH"):
            project("C",3,empty,baseline)

    def test_raw_invalid_json_stops_and_preserves_first_reply(self):
        db=self.ledger()
        data=response()
        data["output"][0]["content"][0]["text"]='{"tag":0,"tag":1}'
        with self.assertRaisesRegex(ValueError,"PROPOSAL_STOP"):
            attempt(db,"A",1,NOW,fake=lambda _:(200,data))
        row=db.db.execute("SELECT phase,receipt FROM attempts").fetchone()
        self.assertEqual(row[0],"PROPOSAL_STOP")
        self.assertEqual(json.loads(row[1])["response"],data)

if __name__=="__main__": unittest.main(verbosity=2)
