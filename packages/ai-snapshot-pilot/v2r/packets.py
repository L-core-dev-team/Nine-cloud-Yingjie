"""Prepare immutable, blind dialogue inputs. No evaluator or model imports."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "v2"))
from run import EVIDENCE as OLD, write_once
from scene import encoded, packet, prefix, sha
from dialogue import unique

OUT = OLD.parent / "YJ-P04-AI-SNAPSHOT-02R"
SUPPLEMENT = """本版本 features.values 只列物件身份（简短原文名称），所有当前可见物件单列到 objects。每项 id 为稳定名称，identityQuote 为本回合唯一、含该名的当前短引。state 为描述当前可见状态的连续原文片段，stateQuote 为唯一且含 state 的当前短引；mention 是该引文中与 id 一致的实际物件指称，可为唯一明确简称。状态可位于不同于身份引文的句子。只有出现或仍在、没有更具体状态时，state、stateQuote、mention 均填 null，不从旧帧继承状态。不要根据身份表自行断言覆盖所有状态。复核本回合整段。people 的 partial 保留可见支持及独立的未知限制引文，限制层 unknown/visible=false，不可证明人名。方位只写观察者物理朝向；用可核对的当前方位或同场景明确延续。"""
AUDIT = """请独立通读完整当前正文，再检查实际候选登记的物件及其当下可见状态。对照叙述层、所指实体、位置/动作/状态，识别遗漏、冲突或无据断言。其他字段引文提到一个状态并不等于物件字段已经记录。无新状态时不要补造。返回 JSON，格式为 {"verdict":"covered 或 needs-review","checked":[{"object":"物件身份","quote":"当前原文精确短引","registered":"候选物件字段的实际记录"}],"findings":[{"kind":"omitted 或 contradicted 或 unsupported","object":"物件身份","quote":"精确原文依据","detail":"具体说明"}]}。checked 逐项列出物件。只有所有可观察的物件状态均有记录且无矛盾才可 covered。"""

def read(path):
    return json.loads(path.read_bytes().decode("utf-8-sig"), object_pairs_hook=unique)

def build(rev, previous):
    p = packet("C", rev, previous)
    p["instructions"] += "\n" + SUPPLEMENT
    nullable = {"type": ["string", "null"]}
    props = {"id": {"type":"string"}, "identityQuote":{"type":"string"},
             "state":nullable, "stateQuote":nullable, "mention":nullable}
    p["schema"]["properties"]["objects"] = {"type":"array","items":{"type":"object",
        "properties":props,"required":list(props),"additionalProperties":False}}
    p["schema"]["required"].append("objects")
    if previous:
        p["previousCandidate"]["objects"] = previous.get("objects", [])
        p["previousCandidate"]["facilityCoverage"] = previous.get("facilityCoverage")
    return p

def audit_packet(path):
    return {"instructions":AUDIT, "group":"C","revision":2,
            "currentNarrative":prefix("C", 2)[-1], "candidateSha256":sha(path.read_bytes()),
            "candidate":read(path)}

def save(slot, p):
    write_once(OUT/"packets"/(slot+".json"), encoded(p))

if __name__ == "__main__":
    save("review-old", audit_packet(OLD/"raw/C2.json"))
    save("C1", build(1, None))
    (OUT/"raw").mkdir(exist_ok=True)
