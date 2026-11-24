"""Sequential local research projection. No model invocation or image transport."""
import re
import sys
from inputs import *

FIELDS=("place","people","viewpoint","perspective","timeOfDay","lighting")
PLACES={"听泉堂":"hall","伏潮井":"well"}
class EvidenceError(ValueError): pass

def stable(kind,name,place=None):
    return sha(encoded([SCOPE,kind,place,name]))[:20]

def project(r,raw,prev=None,*,attribute_guard=False):
    require(isinstance(raw,dict) and raw["scope"]==SCOPE and type(raw["rev"]) is int
            and raw["rev"]==r and raw["tag"]==TAG,"ENVELOPE")
    require(set(raw["fields"])==set(FIELDS),"FIELDS")
    texts=[s["text"] for s in STORY[:r]]
    def ref(q,layer="current",visible=True):
        return locate(dict(group=SCOPE,rev=r,quote=q,layer=layer,visible=visible),SCOPE,r,texts)
    limits=[ref(q,"unknown",False) for q in raw["limits"]]
    excluded=[ref(q,layer,False) for layer,q in raw["excluded"]]
    require(all(e["layer"]!="current" for e in excluded),"BAD_EXCLUSION")
    def support(quotes):
        spans=[ref(q) for q in quotes]
        require(not any(overlap(s,e) for s in spans for e in limits+excluded),"SCOPE_OVERLAP")
        return spans
    def same():
        return bool(place and prev and place==prev["placeId"])
    fields={}; errors={}; place=None
    for f in FIELDS:
        try:
            v,op,quotes=raw["fields"][f]
            require(isinstance(quotes,list) and op in ("unknown","seen","partial","keep"),"OP")
            if op=="unknown":
                require(v is None,"FILLED_UNKNOWN")
                for q in quotes: ref(q,"unknown",False)
                fields[f]={"value":None,"status":"unknown","firstKnown":None,"refs":[]}
                continue
            require(op!="partial" or f=="people","BAD_PARTIAL")
            spans=support(quotes)
            old=prev["fields"].get(f) if prev else None
            if f=="perspective":
                v=bearing(v,quotes,texts[-1],op!="keep")
                require(v,"UNSUPPORTED_BEARING")
            if op=="keep":
                require(any(x in q for q in quotes for x in ("仍","还","没","原","依旧","一直","未","都在","只剩","照旧","还是")),"NO_CONTINUITY")
            claim={"field":f,"status":"partial" if op=="partial" else "complete","values":v if f=="people" else [v],
                   "op":"keep" if op=="keep" else "set","previous":r-1 if op=="keep" else None,"delta":[]}
            status,v=field_value(claim,spans,r,old,(bool(prev and prev["placeId"]) if f=="place" else same()))
            if f=="place":
                require(v in PLACES,"UNREGISTERED_PLACE")
                if op=="keep":
                    require(not any(n!=v and n in texts[-1] and any(n in q for q in quotes) for n in PLACES),"PLACE_CONFLICT")
                place=stable("place",PLACES[v])
            if f=="people" and status=="complete" and op!="keep":
                require(any(any(t in q for t in ("只","除","没有","无人","无一","没再","再无","没有第三","我们三个")) for q in quotes),"ROSTER_EXTENT")
            fields[f]={"value":v,"status":status,"refs":spans,"firstKnown":old["firstKnown"]
                       if same() and old and old["value"]==v and old["status"]==status else r}
        except (KeyError,ValueError,TypeError,IndexError) as e:
            errors[f]=str(e); fields[f]={"value":None,"status":"needs-review","firstKnown":None,"refs":[]}
            if f=="place": place=None
    objects=[]
    seen=set()
    names=[o[0] for o in raw["objects"] if isinstance(o,list) and len(o)==5]
    for i,item in enumerate(raw["objects"]):
        try:
            name,state,identity,quote,mention=item
            require(name not in seen and names.count(name)==1 and name in identity,"OBJECT_ID")
            ident=support([identity])[0]
        except (ValueError,KeyError,TypeError) as e:
            errors["object-"+str(i)]=str(e); continue
        seen.add(name)
        oid=stable("object",name,place) if place else None
        entry={"name":name,"id":oid,"state":None,"identityEvidence":ident,"stateEvidence":None}
        try:
            if state=="@keep":
                q=support([quote])[0]
                prior=next((o for o in (prev or {}).get("objects",[]) if o["id"]==oid),None)
                require(same() and prior and prior["state"] and mention and mention in name and mention in quote
                        and any(m in quote for m in ("原样","照旧","依旧","还是","未变","没变","仍旧")),"OBJECT_KEEP")
                if attribute_guard:
                    # Identical arrangement is not independent support for an old attribute.
                    atom=prior["state"].rstrip("了的着")
                    require(atom and atom in quote,"MISSING_ATTRIBUTE_CONTINUATION")
                entry.update(state=prior["state"],stateEvidence=q,fromRevision=r-1)
            else:
                if state is not None:
                    require(mention==name or (isinstance(mention,str) and [n for n in names if mention in n]==[name]),"AMBIGUOUS_REFERENT")
                obj={"id":name,"identityQuote":identity,"state":state,"stateQuote":quote,"mention":mention}
                checked=object_states([obj],{"group":SCOPE,"revision":r,"fields":{"features":{"value":[name]}},
                                           "excluded":limits+excluded},texts)[0]
                entry.update(state=checked["state"],stateEvidence=checked["stateEvidence"])
        except (ValueError,TypeError,KeyError) as e:
            errors["state:"+name]=str(e)
        objects.append(entry)
    events=[]
    for i,(kind,q) in enumerate(raw["events"]):
        try:
            require(kind in ("change","new-knowledge","correction","commitment","payoff"),"EVENT_KIND")
            events.append({"kind":kind,"evidence":support([q])[0],"id":stable("event",[r,kind,q])})
        except (ValueError,TypeError) as e: errors["event-"+str(i)]=str(e)
    values={f:v["value"] for f,v in fields.items()}
    values["count"]=len(values["people"]) if fields["people"]["status"]=="complete" else None
    visual=[place,values,fields["people"]["status"],sorted((o["name"],o["state"]) for o in objects)]
    return {"scope":SCOPE,"rev":r,"tag":TAG,"placeId":place,"fields":fields,"values":values,
            "personIds":{n:stable("person",n) for n in values["people"] or []},"objects":objects,
            "events":events,"limits":limits,"excluded":excluded,"errors":errors,"digest":sha(encoded(visual)),
            "sceneEligible":False,"send":False,"coverage":"not-independently-reviewed"}

def frames(end):
    prev=None
    for r in range(1,end+1):
        pkg=packet(r,prev)
        require(path("packets",r).read_bytes()==encoded(pkg),"PACKET_CHAIN")
        raw=read(path("raw",r))
        prev=project(r,raw,prev)
        yield raw,prev

def advance(r):
    raw,view=list(frames(r))[-1]
    write_once(path("states",r),encoded(view))
    if r in PROTOCOL["audits"]:
        write_once(path("audit-packets",r),encoded(audit_input(r,raw,view)))
    if r<len(STORY):
        write_once(path("packets",r+1),encoded(packet(r+1,view)))
    print(r,view["values"],[(o["name"],o["state"]) for o in view["objects"]],view["errors"])
if __name__=="__main__":
    advance(int(sys.argv[1]))
