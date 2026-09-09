-- Down for 20260910_audn_01_functions.sql.
-- Drops only what the up file created, in reverse creation order, IF EXISTS.
drop function if exists public.audn_cutoff();
drop function if exists public.audn_person_key(text, text, text, text);
drop function if exists public.audn_norm_urn(text);
drop function if exists public.audn_urn_digits(text);
drop function if exists public.audn_urn_kind(text);
