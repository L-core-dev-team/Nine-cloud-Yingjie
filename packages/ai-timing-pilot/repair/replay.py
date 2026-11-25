"""Replay archived deliveries without regenerating a packet or using a transport."""
import json
import sqlite3
from grounding import HERE, OUTPUT, VERSION, pilot, source_view, validate

def digest(value):
    return pilot.sha(pilot.enc(value))


def archive(group, revision):
    slot = group + f"{revision:02}"
    def load(folder):
        return (pilot.EV / folder / (slot + ".json")).read_bytes()
    packet, raw, original = (load(folder) for folder in ("packets", "raw", "results"))
    p = json.loads(packet)
    pilot.req(p["revision"] == revision, "archive key")
    view = source_view(p)
    result = validate(p, raw, view)
    previous = p["previousRecommendation"]
    audit = pilot.EV / "results" / ("audit-" + slot + ".json")
    binding = {"packet": pilot.sha(packet), "raw": pilot.sha(raw), "originalResult": pilot.sha(original),
               "evidenceView": digest(view), "annotation": view["annotationHash"], "ruleVersion": VERSION,
               "ruleSha256": pilot.sha((HERE / "grounding.py").read_bytes()), "result": digest(result)}
    row = {"slot": slot, "group": group, "revision": revision, "scope": p["scope"], "bindings": binding,
           "previousRecommendationAsReceived": previous, "originalValid": json.loads(original)["valid"],
           "originalReason": json.loads(original)["reason"], "result": result, "intentAsReceived": json.loads(raw)["timingIntent"],
           "originalAuditResultSha256": pilot.sha(audit.read_bytes()) if audit.exists() else None,
           "repairIndependentAudits": 0}
    return row, view


class Journal:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.execute("CREATE TABLE IF NOT EXISTS replay (version TEXT, cohort TEXT, scope TEXT, rev INTEGER, record BLOB, chain TEXT, PRIMARY KEY(version,cohort,scope,rev))")

    def save(self, row):
        key = (VERSION, row["group"], row["scope"], row["revision"])
        body = pilot.enc(row)
        with self.db:
            self.db.execute("BEGIN IMMEDIATE")
            stored = self.db.execute("SELECT record,chain FROM replay WHERE version=? AND cohort=? AND scope=? AND rev=?",key).fetchone()
            if stored:
                pilot.req(stored[0] == body, "same-key conflict")
                return stored[1]
            prev = self.db.execute("SELECT rev,chain FROM replay WHERE version=? AND cohort=? AND scope=? ORDER BY rev DESC LIMIT 1",key[:3]).fetchone()
            pilot.req(key[-1] == (prev[0]+1 if prev else 1), "missing prefix")
            chain = digest([key, prev[1] if prev else None, pilot.sha(body)])
            self.db.execute("INSERT INTO replay VALUES (?,?,?,?,?,?)", (*key, body, chain))
        return chain

    def snapshot(self):
        return list(self.db.execute("SELECT record,chain FROM replay ORDER BY rev"))

    def close(self):
        self.db.close()


def run(path, group, first, last):
    journal = Journal(path)
    try:
        for revision in range(first, last+1):
            row, _ = archive(group, revision)
            journal.save(row)
    finally:
        journal.close()


if __name__ == "__main__":
    import sys
    path, group, start, end = sys.argv[1:]
    run(path, group, int(start), int(end))
