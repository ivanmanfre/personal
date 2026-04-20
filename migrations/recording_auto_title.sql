-- Auto-title pipeline columns + vault-backed secret reader
-- Deployed via Supabase MCP on 2026-04-19
-- Paired with edge function: recording-auto-title (AssemblyAI + Claude Haiku)

ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS transcript_text TEXT,
  ADD COLUMN IF NOT EXISTS auto_title TEXT,
  ADD COLUMN IF NOT EXISTS auto_title_status TEXT;

COMMENT ON COLUMN recordings.transcript_text IS 'Full AssemblyAI transcript. Populated async by recording-auto-title edge function.';
COMMENT ON COLUMN recordings.auto_title IS 'Suggested title generated from transcript by Claude Haiku. Surfaced when title is empty; double-click on card to override.';
COMMENT ON COLUMN recordings.auto_title_status IS 'null | pending | transcribing | titling | done | failed | no_audio';

-- SECURITY DEFINER wrapper so edge functions can read vault secrets without
-- needing a direct grant on the vault schema. Only service_role can call it.
CREATE OR REPLACE FUNCTION public.get_vault_secret(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vault_secret(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vault_secret(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.get_vault_secret(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(TEXT) TO service_role;

-- Required vault secrets (add via dashboard or SELECT vault.create_secret(...)):
--   ASSEMBLYAI_API_KEY    - transcription
--   ANTHROPIC_API_KEY     - title generation
