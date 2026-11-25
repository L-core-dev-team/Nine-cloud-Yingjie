"""Evidence access for the public, frozen fourteen-turn replay only."""
import re
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/"stability"))
import chain
from inputs import SCOPE, STORY, OUT as ORIGINAL, ROOT, TAG, encoded, locate, overlap, path, read, require, sha
OUT=ROOT/"docs/reports/evidence/YJ-P04-STABILITY-01R"
NONCURRENT=re.compile(r"梦见|梦中|做梦|记起|回忆|曾经|去年|听说|据说|转述|传闻|假如|要是|打算|将要|设想|假设|明天|或许|仿佛|[“”「」]")

class Source:
    def __init__(self,r,base):
        self.r=r
        self.text=STORY[r-1]["text"]
        self.layers=base["limits"]+base["excluded"]
    def span(self,q):
        return locate({"group":SCOPE,"rev":self.r,"quote":q,"layer":"current","visible":True},
                      SCOPE,self.r,[row["text"] for row in STORY[:self.r-1]]+[self.text])
    def sentence(self,q):
        if not isinstance(q,str) or not q or self.text.count(q)!=1: return ""
        start=self.text.index(q)
        before=re.split(r"[。！？；]",self.text[:start])[-1]
        after=re.split(r"[。！？；]",self.text[start+len(q):])[0]
        return before+q+after
    def current(self,q):
        span=self.span(q)
        require(not any(overlap(span,e) for e in self.layers),"EXCLUDED")
        sentence=self.sentence(q)
        require(sentence and not NONCURRENT.search(sentence) and not re.search(r"若|如果|据称|[说问道称]过|声称|说[，：]|说是",sentence),"NONCURRENT_CONTEXT")
        return span

def evidence(src,q):
    try: return src.current(q)
    except (ValueError,TypeError): return None
