BEGIN;
CREATE SCHEMA IF NOT EXISTS yingjie_history;
CREATE TABLE IF NOT EXISTS yingjie_history.report (
  id uuid PRIMARY KEY, scope text NOT NULL, command uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('asset','preset')),
  target text NOT NULL, revision integer NOT NULL, scene text NOT NULL, visual_version text NOT NULL,
  review_id text NOT NULL, generation bigint NOT NULL, category text NOT NULL, note text NOT NULL,
  actor text NOT NULL, source_ref jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(scope,command), FOREIGN KEY(scope,revision) REFERENCES yingjie_scene.event(scope,revision)
);
CREATE INDEX IF NOT EXISTS report_target ON yingjie_history.report(scope,kind,target);
CREATE TABLE IF NOT EXISTS yingjie_history.decision (
  report uuid PRIMARY KEY REFERENCES yingjie_history.report, outcome text NOT NULL CHECK(outcome IN ('invalidated','dismissed')),
  actor text NOT NULL, basis text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS yingjie_history.review_event (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, scope text NOT NULL, kind text NOT NULL,target text NOT NULL,
  previous jsonb,current jsonb NOT NULL, report uuid REFERENCES yingjie_history.report, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS review_target ON yingjie_history.review_event(scope,kind,target,seq DESC);
CREATE OR REPLACE FUNCTION yingjie_history.capture_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior jsonb; effective jsonb;
BEGIN
  effective=jsonb_build_object('review',NEW.record->'review','invalidated',NEW.record->'invalidated');
  IF TG_OP='UPDATE' THEN
    prior=jsonb_build_object('review',OLD.record->'review','invalidated',OLD.record->'invalidated');
    IF effective=prior THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO yingjie_history.review_event(scope,kind,target,previous,current,report)
    VALUES(NEW.scope,'asset',NEW.id::text,prior,effective,nullif(current_setting('yingjie_history.report_id',true),'')::uuid);
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER history_review AFTER INSERT OR UPDATE OF record ON yingjie_image.asset
  FOR EACH ROW EXECUTE FUNCTION yingjie_history.capture_review();
CREATE OR REPLACE FUNCTION yingjie_history.immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'append-only-history'; END $$;
CREATE OR REPLACE TRIGGER immutable_report BEFORE UPDATE OR DELETE ON yingjie_history.report FOR EACH ROW EXECUTE FUNCTION yingjie_history.immutable();
CREATE OR REPLACE TRIGGER immutable_decision BEFORE UPDATE OR DELETE ON yingjie_history.decision FOR EACH ROW EXECUTE FUNCTION yingjie_history.immutable();
CREATE OR REPLACE TRIGGER immutable_review BEFORE UPDATE OR DELETE ON yingjie_history.review_event FOR EACH ROW EXECUTE FUNCTION yingjie_history.immutable();
COMMIT;
