CREATE SCHEMA IF NOT EXISTS yingjie_world;
-- Curator-owned rows in the separate projection database. No browser writer.
CREATE TABLE IF NOT EXISTS yingjie_world.binding (
  scope text NOT NULL,
  card_id uuid NOT NULL,
  import_id uuid NOT NULL,
  import_sha text NOT NULL,
  book_sha text NOT NULL,
  entry_sha text NOT NULL,
  scene_id text NOT NULL,
  parent_id text NOT NULL,
  catalog text NOT NULL,
  tags text[] NOT NULL,
  fixed_features text[] NOT NULL,
  basis text NOT NULL CHECK (length(trim(basis)) > 0),
  PRIMARY KEY (scope,card_id,import_id,book_sha,entry_sha,scene_id,parent_id,catalog)
);
