"""Research acceptance over recorded results. Exit 1 for any hard failure."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[3]
e=root/'docs/reports/evidence/YJ-P04-H3B2'
def read(name):return json.loads((e/name).read_bytes())
m=read('repair/proposal.json')['totals']
prefix=read('repair/prefix-replay.json');causal=read('repair/causal-audit.json')
compat=read('repair/regression.json')
false=[]
for part in m:
    index=read('repair/propositions.json')['index'][part]
    for rec in index:
        detail=read('repair/'+rec['file'])
        for row in detail['rows']:
            if row['arm'] in ('local','oracle') and 'unmatched-confirmation' in row['errors']:
                false.append(dict(split=part,story=rec['id'],revision=row['n'],arm=row['arm'],trace='repair/'+rec['file']))
issues=[]
if false:issues.append('false-current-world-confirmation')
if prefix['problems'] or prefix['sends'] or any(g['local']['visual'] for g in m.values()):issues.append('prefix-or-visual')
if not all(t['sameTrace'] and t['unchanged'] for t in causal['targeted']):issues.append('historical-causality-regression')
if not all(t['pass'] for t in read('repair/safety.json')['tests']+read('repair-scope-controls.json')['tests']):issues.append('guard-regression')
if not all(t['expected']==t['observed'] for t in read('repair-discourse-audit.json')['results']):issues.append('first-red-still-open')
if compat['acceptance']['newCompatibilityFailures'] or not compat['acceptance']['preservedOriginalFailures']:issues.append('compatibility-regression')
held=m['reserve']['local'];state='FAIL' if issues else ('H3B2_OFFLINE_GROUNDING_RESEARCH_PASS' if held['fact'][0] else 'H3B2_PARTIAL')
verdict=dict(status=state,exit=1 if issues else 0,issues=issues,falseConfirmations=false,distinctFalseRevisions=len({(f['split'],f['story'],f['revision']) for f in false}),
    guardedEntry='research replay only',semantic='SEMANTIC_FACT_GROUNDING_NOT_VERIFIED',independentHuman='INDEPENDENT_HUMAN_BLIND_REVIEW_NOT_RUN',
    realModelQueries=0,realTextCalls=0,realImageCalls=0,usd=0)
(e/'acceptance.json').write_bytes((json.dumps(verdict,ensure_ascii=False,indent=2)+'\n').encode())
print(state,issues)
raise SystemExit(verdict['exit'])
