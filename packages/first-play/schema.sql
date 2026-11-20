BEGIN;
CREATE SCHEMA IF NOT EXISTS yingjie_play;
CREATE TABLE IF NOT EXISTS yingjie_play.extraction (
  scope text NOT NULL, revision integer NOT NULL, audit jsonb NOT NULL,
  PRIMARY KEY(scope,revision),
  FOREIGN KEY(scope,revision) REFERENCES yingjie_scene.event(scope,revision)
);
CREATE TABLE IF NOT EXISTS yingjie_play.choice (
  scope text NOT NULL, revision integer NOT NULL, permit uuid NOT NULL REFERENCES yingjie_image.permit(id),
  serial bigint NOT NULL, record jsonb NOT NULL, observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scope,revision,permit,serial,record)
);
COMMIT;
