BEGIN;
CREATE SCHEMA IF NOT EXISTS yingjie_scene;
CREATE TABLE IF NOT EXISTS yingjie_scene.stream (
  scope text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state jsonb NOT NULL DEFAULT '{"current":null,"places":[],"reason":"no-history"}'
);
CREATE TABLE IF NOT EXISTS yingjie_scene.event (
  scope text NOT NULL REFERENCES yingjie_scene.stream(scope),
  revision integer NOT NULL CHECK (revision > 0),
  event_key text NOT NULL,
  input_hash text NOT NULL,
  raw_text_hash text NOT NULL,
  normalized_text_hash text NOT NULL,
  source jsonb NOT NULL,
  observations jsonb NOT NULL,
  versions jsonb NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY(scope, revision),
  UNIQUE(scope, event_key)
);
CREATE TABLE IF NOT EXISTS yingjie_scene.conflict (
  scope text NOT NULL, revision integer NOT NULL, event_key text NOT NULL,
  input_hash text NOT NULL, reason text NOT NULL,
  PRIMARY KEY(scope, revision, event_key, input_hash, reason)
);
COMMIT;
