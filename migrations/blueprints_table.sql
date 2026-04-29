-- Blueprints: AI-generated $2,500 deliverable docs.
-- One row per generated draft. status flips draft → published when Ivan ships to buyer.
-- kind='test' rows are excluded from RAG so demo data doesn't pollute future generations.
-- Applied 2026-04-29 via Supabase MCP.

CREATE TABLE IF NOT EXISTS public.blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT NOT NULL REFERENCES public.paid_assessments(stripe_session_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  kind TEXT NOT NULL DEFAULT 'real' CHECK (kind IN ('real','test')),
  html TEXT NOT NULL DEFAULT '',
  json_sections JSONB DEFAULT '{}'::jsonb,
  share_token TEXT UNIQUE,
  version INT NOT NULL DEFAULT 1,
  embedding extensions.vector(1536),
  embedding_text TEXT,
  generation_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_blueprints_session ON public.blueprints(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_status_kind ON public.blueprints(status, kind);
CREATE INDEX IF NOT EXISTS idx_blueprints_token ON public.blueprints(share_token) WHERE share_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blueprints_embedding_rag
  ON public.blueprints USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 50)
  WHERE status = 'published' AND kind = 'real' AND embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_blueprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blueprints_touch ON public.blueprints;
CREATE TRIGGER trg_blueprints_touch
  BEFORE UPDATE ON public.blueprints
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_blueprints_updated_at();

CREATE OR REPLACE FUNCTION public.match_published_blueprints(
  query_embedding extensions.vector(1536),
  exclude_session TEXT DEFAULT NULL,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  stripe_session_id TEXT,
  embedding_text TEXT,
  json_sections JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    b.id,
    b.stripe_session_id,
    b.embedding_text,
    b.json_sections,
    1 - (b.embedding <=> query_embedding) AS similarity
  FROM public.blueprints b
  WHERE b.status = 'published'
    AND b.kind = 'real'
    AND b.embedding IS NOT NULL
    AND (exclude_session IS NULL OR b.stripe_session_id <> exclude_session)
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.blueprints
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_all" ON public.blueprints
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_update_html" ON public.blueprints
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "public_read_published_by_token" ON public.blueprints
  FOR SELECT TO anon USING (status = 'published' AND share_token IS NOT NULL);
