-- Dedicated offline installation. These tables share the ImageTasks transaction.
CREATE TABLE IF NOT EXISTS yingjie_image.image_money_batch (
  id text PRIMARY KEY CHECK (id='i2-mock-usd-v1'), total_micro_usd bigint NOT NULL CHECK(total_micro_usd>0)
);
CREATE TABLE IF NOT EXISTS yingjie_image.image_money_grant (
  id text PRIMARY KEY, batch text NOT NULL REFERENCES yingjie_image.image_money_batch(id),
  operation text NOT NULL CHECK(operation IN ('generate','edit')), terms text NOT NULL,
  revoked integer NOT NULL DEFAULT 0, UNIQUE(batch,operation)
);
CREATE TABLE IF NOT EXISTS yingjie_image.image_money_hold (
  grant_id text PRIMARY KEY REFERENCES yingjie_image.image_money_grant(id),
  event_hash text NOT NULL UNIQUE, run_hash text NOT NULL UNIQUE,
  micro_usd bigint NOT NULL CHECK(micro_usd>0)
);
CREATE TABLE IF NOT EXISTS yingjie_image.image_money_stage (
  run_hash text NOT NULL, grant_hash text NOT NULL, utc text NOT NULL, stage text NOT NULL,
  PRIMARY KEY(run_hash,stage)
);
