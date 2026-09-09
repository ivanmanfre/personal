-- Down for 20260910_audn_02_tables.sql.
-- Drops only what the up file created, in reverse creation order, IF EXISTS.
-- Dropping the tables drops their indexes, constraints and the bigserial
-- sequence audn_post_metric_snapshots_id_seq with them.
drop table if exists public.audn_post_collection_coverage;
drop index if exists public.audn_post_metric_snapshots_post_idx;
drop table if exists public.audn_post_metric_snapshots;
