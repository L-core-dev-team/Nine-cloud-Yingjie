"""Validate immutable UTF-8 corpus before evaluating either split."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[4]
e=root/'docs/reports/evidence/YJ-P04-H3B/corpus-freeze.json'
def manifest():
    files={}
    for file in sorted(Path(__file__).parent.glob('*.json*')):
        data=file.read_bytes()
        meta={'sha256':hashlib.sha256(data).hexdigest()}
        if file.suffix=='.jsonl':
            stories=[json.loads(line) for line in data.splitlines()]
            rows=[r for story in stories for r in story['rows']]
            meta.update(stories=len(stories),revisions=len(rows),discovery=sum(r['review'] for r in rows),confirmation=sum(r['fact'] for r in rows),negative=sum(not r['review'] for r in rows))
        files[file.name]=meta
    return dict(files=files,split='whole family of expression and causal mechanism; dev explicit disposition, held action/ellipsis and concrete downstream use',independence='INDEPENDENT_HUMAN_BLIND_REVIEW_NOT_RUN',labels='candidate worthy of textual review includes pending petitions; confirmation requires a completed material change; agency/nominal possession alone excluded; annotated roles required for role-level scores',ranking='first active revision against ranked material outcomes, one annotated peak per positive story; cross-line ranking assessed on historical multi-peak stories')
if __name__=='__main__':
    m=manifest()
    if e.exists(): assert json.loads(e.read_bytes())==m
    else: e.write_bytes((json.dumps(m,ensure_ascii=False,indent=2)+'\n').encode())
