"""Directed checks using only original or amended claims on the frozen narratives."""
import unittest
from copy import deepcopy

from replay import OUT, OLD, project, read, replay, audit_packet, review
from projection import bearing

def frame(r, old=False):
    return read((OLD if old else OUT)/"raw"/f"C{r}.json")

def claim(a, name):
    return next(c for c in a["claims"] if c["field"]==name)

class Repair(unittest.TestCase):
    def test_replay_b_and_d(self):
        rows = replay()["archived"]
        for slot in ("B1","B2","B3","D1","D2","D3"):
            self.assertTrue(all(s.startswith("correct") for s in rows[slot]["literalScore"].values()),slot)
        v = {k:r["projection"] for k,r in rows.items()}
        self.assertEqual(v["B2"]["changed"],["lighting"])
        self.assertEqual(v["B2"]["digest"],v["B3"]["digest"])
        self.assertEqual(v["D2"]["digest"],v["D3"]["digest"])
        self.assertEqual(v["D2"]["storyChangeCandidates"],[])
        self.assertIn({"field":"perspective","reason":"newly-grounded"},v["D2"]["corrections"])
        self.assertEqual(v["D3"]["changed"],[])

    def test_direction_vocabulary_and_subject(self):
        for d in ("东","西","南","北","东北","东南","西北","西南"):
            for marker in ("朝","向","面向","面","往","朝向"):
                self.assertEqual(bearing(marker+d,["我向"+d],"我向"+d,True),"向"+d)
        for v,q,t in [("面西","向东","我向东"),("第一人称","向东","我向东"),
                      ("向东","朝东","我朝东南"),("向南","南墙","我倚南墙"),
                      ("向东","朝东","他朝东"),("向东","朝东","他说：“朝东。”")]:
            self.assertIsNone(bearing(v,[q],t,True))
        self.assertIsNone(bearing("向东",["向西"],"我向西",False))

    def test_partial_roster(self):
        a=frame(1,True)
        v=project("C",1,a,archived=True)
        self.assertEqual(v["partial"]["people"],["乔麦"])
        self.assertIsNone(v["values"]["count"])
        self.assertEqual([s["layer"] for s in v["fields"]["people"]["refs"]],["current"])
        self.assertEqual(v["visibilityLimits"][0]["quote"],"帘后还有谁无从知道")
        self.assertIsNone(v["sceneId"])
        c=claim(a,"people")
        c["values"]=["孟川"]
        self.assertIsNone(project("C",1,a,archived=True)["fields"]["people"]["value"])
        c["status"]="complete"
        self.assertEqual(project("C",1,a,archived=True)["status"],"HIDDEN")

    def test_scope_tampering(self):
        for key,value in (("group","D"),("rev",2),("quote","伪引文"),("layer","dream")):
            a=frame(1,True)
            claim(a,"people")["refs"][1][key]=value
            self.assertEqual(project("C",1,a,archived=True)["status"],"HIDDEN")

    def test_current_object_evidence(self):
        prev=project("C",1,frame(1))
        for state,quote,mention in [("推翻","我梦见孟川推翻水桶","水桶"),
              ("好端端的","水桶好端端的，布帘还在","帘"),("坍塌","布帘还在","布帘")]:
            a=frame(2)
            obj=next(o for o in a["objects"] if o["id"]=="布帘")
            obj.update(state=state,stateQuote=quote,mention=mention)
            self.assertEqual(project("C",2,a,prev)["status"],"HIDDEN")

    def test_independent_coverage(self):
        v=project("C",2,frame(2),project("C",1,frame(1)))
        self.assertEqual(v["facilityCoverage"],"coverage-needs-review")
        path=OUT/"raw/C2.json"
        packet=audit_packet(path)
        good=read(OUT/"raw/review-new.json")
        self.assertEqual(review(packet,good,path,v),"model-reviewed-no-omission")
        bad=deepcopy(good)
        bad["checked"]=[]
        with self.assertRaises(ValueError):
            review(packet,bad,path,v)
        bad=deepcopy(good)
        bad["checked"][0]["quote"]="仍辨不出时辰"
        with self.assertRaises(ValueError):
            review(packet,bad,path,v)
        with self.assertRaises(ValueError):
            review(audit_packet(OLD/"raw/C2.json"),good,path,v)
        old=read(OUT/"raw/review-old.json")
        self.assertTrue(any("乔麦正掀帘" in f["quote"] and f["object"]=="布帘"
                            and f["kind"]=="omitted" for f in old["findings"]))
        self.assertEqual(replay()["reviews"]["review-old"]["coverage"],"coverage-needs-review")

    def test_recovery_and_state_expiry(self):
        rows=[row["projection"] for row in replay()["new"].values()]
        self.assertEqual([v["values"]["count"] for v in rows],[None,1,0])
        self.assertEqual([v["sceneId"] for v in rows],[None,"盐井值房","盐井值房"])
        self.assertTrue(all(v["values"]["timeOfDay"] is None and not v["sceneEligible"]
                            and not v["send"] for v in rows))
        self.assertEqual([[o["state"] for o in sorted(v["objects"],key=lambda x:x["id"])]
                          for v in rows],[[None,None],["正掀帘","好端端的"],["挂到钩上",None]])
        self.assertTrue(all(v["facilityCoverage"]=="coverage-needs-review" for v in (rows[0],rows[2])))

if __name__=="__main__":
    unittest.main(verbosity=2)
