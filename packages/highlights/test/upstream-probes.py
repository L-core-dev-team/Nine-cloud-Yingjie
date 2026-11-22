"""Reproduce two source-level probes with local copies from the pinned upstream revisions."""
import argparse
import ast
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace


def pinned(path, oid):
    data = path.read_bytes().replace(b'\r\n', b'\n')
    header = b'blob ' + str(len(data)).encode() + b'\0'
    if hashlib.sha1(header + data).hexdigest() != oid:
        raise ValueError('Unexpected upstream source')
    return data.decode('utf8')


args = argparse.ArgumentParser()
args.add_argument('surface', type=Path)
args.add_argument('atlas', type=Path)
files = args.parse_args()
surface = pinned(files.surface, '21b1f84c270d3852b83be0f0c4c7abb00c529dd0')
atlas = pinned(files.atlas, '317c1dc74887ff6277b0f054ea1adb89d98c6392')
fn = next(node for node in ast.parse(surface).body
          if isinstance(node, ast.FunctionDef) and node.name == 'surface_tension_components')
scope = {'ParagraphMetricCounts': SimpleNamespace}
exec(compile(ast.Module([fn], type_ignores=[]), 'upstream-surface', 'exec'), scope)
graph = {}
exec(compile(atlas, 'upstream-atlas', 'exec'), graph)


def components(fight, marks):
    counts = SimpleNamespace(token_count=30, char_count=50, fight_weight_sum=fight,
                             exclaim_count=marks, question_count=0, dialogue_char_count=0, pause_count=1)
    return scope[fn.name](counts)


scene = {'id': 'tea', 'characters_present': ['lin'], 'location': 'tavern', 'summary': 'drinks tea'}
arc = {'id': 'debt', 'characters_involved': ['lin'], 'locations_involved': ['tavern'], 'key_events': ['repayment']}
result = {
    'NovelIQ': {
        'commit': '3c22f5a35ef7bbae5b88d137944f69097fbdf0ca',
        'unit': 'surface_tension_components only; controlled counts, no tokenizer or model',
        'loudNoChange': components(5, 4), 'quietTransfer': components(0, 0)
    },
    'NarrativeAtlas': {
        'commit': 'a6d837969af18774322b6f9782f96906b0a51988',
        'unit': 'graph.match_score + link_scenes_to_arcs', 'inputScene': scene, 'inputArc': arc,
        'matchScore': graph['match_score'](scene, arc),
        'linked': graph['link_scenes_to_arcs']([dict(scene)], [dict(arc)])[0][0]['arcs']
    }
}
print(json.dumps(result, indent=2))
