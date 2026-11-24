"""Frozen literal score. Semantic equivalence is a separate, disclosed reading."""
def classify(got, wanted):
    if isinstance(got,list) and isinstance(wanted,list):
        got,wanted=sorted(got),sorted(wanted)
    if got==wanted:
        return "correct-unknown" if got is None else "correct"
    return "omitted" if got is None else "unsupported-or-different" if wanted is None else "different"

def measure(view, gold):
    fields={f:classify(view["values"].get(f),gold[f]) for f in
            ("place","viewpoint","perspective","people","count","timeOfDay","lighting")}
    items={o["name"]:o["state"] for o in view["objects"]}
    objects={name:(classify(items[name],state) if name in items else "omitted-object")
             for name,state in gold["objects"].items()}
    return {"fields":fields,"objects":objects,"additionalObjectNames":sorted(set(items)-set(gold["objects"]))}
