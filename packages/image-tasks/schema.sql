BEGIN;
CREATE SCHEMA IF NOT EXISTS yingjie_image;
CREATE TABLE IF NOT EXISTS yingjie_image.permit (
  id uuid PRIMARY KEY, scope text NOT NULL, serial bigint NOT NULL, enabled boolean NOT NULL
);
CREATE TABLE IF NOT EXISTS yingjie_image.task (
  id uuid PRIMARY KEY, scope text NOT NULL, event_key text UNIQUE NOT NULL,
  request_key text, plan jsonb NOT NULL, permit uuid NOT NULL REFERENCES yingjie_image.permit(id)
);
CREATE INDEX IF NOT EXISTS task_scope ON yingjie_image.task(scope);
CREATE TABLE IF NOT EXISTS yingjie_image.attempt (
  id uuid PRIMARY KEY, task uuid NOT NULL REFERENCES yingjie_image.task(id),
  ordinal integer NOT NULL, record jsonb NOT NULL, deadline timestamptz,
  UNIQUE(task,ordinal)
);
CREATE TABLE IF NOT EXISTS yingjie_image.asset (
  id uuid PRIMARY KEY REFERENCES yingjie_image.attempt(id), scope text NOT NULL, record jsonb NOT NULL,
  size_bytes integer NOT NULL CHECK(size_bytes>0)
);
CREATE INDEX IF NOT EXISTS asset_scope ON yingjie_image.asset(scope);
CREATE TABLE IF NOT EXISTS yingjie_image.conflict (
  task uuid NOT NULL REFERENCES yingjie_image.task(id), kind text NOT NULL, digest text NOT NULL,
  PRIMARY KEY(task,kind,digest)
);
COMMIT;
