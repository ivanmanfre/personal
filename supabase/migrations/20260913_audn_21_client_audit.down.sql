drop function if exists public.operator_audn_client_audit(text,text);
drop function if exists public.audn_client_audit_payload(text);
-- Preserve additive columns, unique generation index and all new audit rows.
